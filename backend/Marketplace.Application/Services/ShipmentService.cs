using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class ShipmentService : IShipmentService
{
    private readonly IUnitOfWork _uow;
    private readonly IDeliveryProvider _deliveryProvider;
    private readonly IWalletService _walletService;
    private readonly INotificationService _notificationService;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private readonly IShippingDistanceService? _shippingDistanceService;

    public ShipmentService(
        IUnitOfWork uow,
        IDeliveryProvider deliveryProvider,
        IWalletService walletService,
        INotificationService notificationService,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        IShippingDistanceService? shippingDistanceService = null)
    {
        _uow = uow;
        _deliveryProvider = deliveryProvider;
        _walletService = walletService;
        _notificationService = notificationService;
        _configuration = configuration;
        _shippingDistanceService = shippingDistanceService;
    }

    public async Task<DeliveryQuoteResponse> CalculateQuoteAsync(DeliveryQuoteRequest request)
    {
        if (!Enum.TryParse<DeliveryMethod>(request.DeliveryMethod, true, out var deliveryMethod))
            throw new BadRequestException("DeliveryMethod must be 'Pickup' or 'Courier'.");

        string destinationCity;
        string? pickupPointId = null;
        var effectiveCity = request.EffectiveCity;

        if (!string.IsNullOrWhiteSpace(request.PickupPointId))
        {
            var point = await _deliveryProvider.GetPickupPointByIdAsync(request.PickupPointId.Trim());
            if (point == null)
                throw new BadRequestException("Invalid PickupPointId.");

            pickupPointId = point.Id;
            destinationCity = point.City;
        }
        else if (!string.IsNullOrWhiteSpace(effectiveCity))
        {
            if (!await _deliveryProvider.IsValidCityAsync(effectiveCity))
                throw new BadRequestException("Selected City is not supported by the delivery provider.");

            destinationCity = effectiveCity;
        }
        else
        {
            throw new BadRequestException("Either City or PickupPointId is required.");
        }

        double? destLat = request.Latitude;
        double? destLng = request.Longitude;
        if ((!destLat.HasValue || !destLng.HasValue || (destLat.Value == 0 && destLng.Value == 0)) && !string.IsNullOrWhiteSpace(destinationCity))
        {
            var destCoords = EgyptianGovernorates.GetCoordinates(destinationCity);
            if (destCoords.HasValue)
            {
                destLat = destCoords.Value.Latitude;
                destLng = destCoords.Value.Longitude;
            }
        }

        var consolidatedItems = request.Items
            .GroupBy(i => (i.ProductId, i.VariantId))
            .Select(g => new { g.Key.ProductId, g.Key.VariantId, Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        var loadedItems = new List<(Product Product, ProductVariant? Variant, int Quantity, decimal UnitPrice)>();
        foreach (var item in consolidatedItems)
        {
            var product = await _uow.Products.GetByIdAsync(item.ProductId);
            if (product == null)
                throw new NotFoundException($"Product with ID {item.ProductId} not found.");

            ProductVariant? variant = null;
            decimal unitPrice = product.Price;
            if (item.VariantId.HasValue)
            {
                variant = await _uow.ProductVariants.GetByIdAsync(item.VariantId.Value);
                if (variant != null && variant.ProductId == product.Id)
                {
                    unitPrice = variant.PriceOverride ?? product.Price;
                }
            }

            loadedItems.Add((product, variant, item.Quantity, unitPrice));
        }

        var sellerIds = loadedItems.Select(x => x.Product.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);
        var sellerProfiles = (await _uow.SellerProfiles.FindAsync(sp => sellerIds.Contains(sp.UserId)))
            .ToDictionary(sp => sp.UserId);

        var parcels = new List<SellerParcelQuoteDto>();
        decimal freeShippingThreshold = _configuration.GetValue<decimal>("Orders:FreeShippingThreshold", 1000m);
        decimal overallItemsSubtotal = loadedItems.Sum(x => x.UnitPrice * x.Quantity);

        foreach (var group in loadedItems.GroupBy(x => x.Product.SellerId))
        {
            int sellerId = group.Key;
            string dispatchCity = sellerProfiles.TryGetValue(sellerId, out var profile) && !string.IsNullOrWhiteSpace(profile.DispatchCity)
                ? profile.DispatchCity
                : "القاهرة";

            double? originLat = null;
            double? originLng = null;
            if (profile != null)
            {
                if (profile.DispatchLatitude.HasValue && profile.DispatchLongitude.HasValue && profile.DispatchLatitude.Value != 0)
                {
                    originLat = profile.DispatchLatitude.Value;
                    originLng = profile.DispatchLongitude.Value;
                }
                else
                {
                    var originCoords = EgyptianGovernorates.GetCoordinates(dispatchCity);
                    if (originCoords.HasValue)
                    {
                        originLat = originCoords.Value.Latitude;
                        originLng = originCoords.Value.Longitude;
                    }
                }
            }

            int totalWeightGrams = group.Sum(x => Math.Max(1, x.Product.WeightGrams) * x.Quantity);
            decimal parcelItemsSubtotal = group.Sum(x => x.UnitPrice * x.Quantity);

            var tariff = await _deliveryProvider.CalculateTariffAsync(new DeliveryTariffRequest
            {
                FromCity = dispatchCity,
                ToCity = destinationCity,
                DeliveryMethod = deliveryMethod,
                TotalWeightGrams = totalWeightGrams
            });

            decimal deliveryCost = tariff.Cost;

            if (_shippingDistanceService != null && destLat.HasValue && destLng.HasValue)
            {
                try
                {
                    var feeCalculation = await _shippingDistanceService.CalculateShippingFeeAsync(
                        destLat.Value,
                        destLng.Value,
                        originLat,
                        originLng
                    );
                    if (feeCalculation != null && feeCalculation.TotalShippingCost > 0)
                    {
                        deliveryCost = feeCalculation.TotalShippingCost;
                    }
                }
                catch
                {
                    // Fall back cleanly to tariff.Cost
                }
            }

            if (parcelItemsSubtotal >= freeShippingThreshold || overallItemsSubtotal >= freeShippingThreshold)
            {
                deliveryCost = 0m;
            }

            parcels.Add(new SellerParcelQuoteDto
            {
                SellerId = sellerId,
                SellerName = sellers.GetValueOrDefault(sellerId, "Unknown"),
                DispatchCity = dispatchCity,
                DestinationCity = destinationCity,
                TotalWeightGrams = totalWeightGrams,
                ItemsSubtotal = parcelItemsSubtotal,
                DeliveryCost = deliveryCost,
                EtaMinDays = tariff.EtaMinDays,
                EtaMaxDays = tariff.EtaMaxDays,
                Items = group.Select(x => new ParcelItemQuoteDto
                {
                    ProductId = x.Product.Id,
                    ProductName = x.Product.Name,
                    Quantity = x.Quantity,
                    UnitPrice = x.UnitPrice,
                    WeightGrams = x.Product.WeightGrams
                }).ToList()
            });
        }

        decimal itemsSubtotal = parcels.Sum(p => p.ItemsSubtotal);
        decimal totalDeliveryCost = parcels.Sum(p => p.DeliveryCost);
        bool isFreeShippingApplied = (overallItemsSubtotal >= freeShippingThreshold && itemsSubtotal > 0) ||
                                     parcels.Any(p => p.DeliveryCost == 0m && p.ItemsSubtotal > 0);

        return new DeliveryQuoteResponse
        {
            DeliveryMethod = deliveryMethod.ToString(),
            DestinationCity = destinationCity,
            PickupPointId = pickupPointId,
            Parcels = parcels,
            ItemsSubtotal = itemsSubtotal,
            TotalDeliveryCost = totalDeliveryCost,
            TotalAmount = itemsSubtotal + totalDeliveryCost,
            FreeShippingThreshold = freeShippingThreshold,
            IsFreeShippingApplied = isFreeShippingApplied
        };
    }

    public async Task<IEnumerable<SellerShipmentResponse>> GetSellerShipmentsAsync(int sellerId)
    {
        var shipments = (await _uow.Shipments.FindAsync(s => s.SellerId == sellerId))
            .OrderByDescending(s => s.CreatedAt)
            .ToList();

        if (!shipments.Any())
            return Enumerable.Empty<SellerShipmentResponse>();

        var orderIds = shipments.Select(s => s.OrderId).Distinct().ToList();
        var orders = (await _uow.Orders.FindAsync(o => orderIds.Contains(o.Id))).ToDictionary(o => o.Id);

        var shipmentIds = shipments.Select(s => s.Id).ToList();
        var items = (await _uow.OrderItems.FindAsync(i => shipmentIds.Contains(i.ShipmentId))).ToList();

        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        return shipments.Select(s =>
        {
            orders.TryGetValue(s.OrderId, out var order);
            var shipmentItems = items.Where(i => i.ShipmentId == s.Id).ToList();
            return MapSellerShipment(s, order, shipmentItems, products);
        }).ToList();
    }

    public async Task<SellerShipmentResponse> GetSellerShipmentByIdAsync(int sellerId, int shipmentId)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException("Shipment not found.");

        if (shipment.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to view this shipment.");

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        return MapSellerShipment(shipment, order, items, products);
    }

    public async Task<CarrierShippingLabelResponse> GetCarrierShippingLabelAsync(int userId, string role, int shipmentId)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException("Shipment not found.");

        var isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        var isSeller = string.Equals(role, "Seller", StringComparison.OrdinalIgnoreCase);

        if (!isAdmin)
        {
            if (!isSeller || shipment.SellerId != userId)
                throw new ForbiddenException("You do not have permission to generate a shipping label for this shipment.");

            if (shipment.Status == ShipmentStatus.Cancelled)
                throw new BadRequestException("Cannot generate shipping label for a cancelled shipment.");
        }

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId)
            ?? throw new NotFoundException("Associated order not found.");

        var buyer = await _uow.Users.GetByIdAsync(order.BuyerId);
        var seller = await _uow.Users.GetByIdAsync(shipment.SellerId);

        var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var recipientName = !string.IsNullOrWhiteSpace(order.RecipientName) ? order.RecipientName : (buyer?.Name ?? "Customer");
        var recipientPhone = !string.IsNullOrWhiteSpace(order.RecipientPhone) ? order.RecipientPhone : (buyer?.Phone ?? string.Empty);

        var itemResponses = items.Select(i => new OrderItemResponse
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductName = products.TryGetValue(i.ProductId, out var p) ? p.Name : "Unknown",
            VariantId = i.VariantId,
            VariantSummary = i.VariantSummary,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            WeightGrams = products.TryGetValue(i.ProductId, out var pw) ? pw.WeightGrams : 500
        }).ToList();

        return new CarrierShippingLabelResponse
        {
            ShipmentId = shipment.Id,
            OrderId = shipment.OrderId,
            TrackingNumber = shipment.TrackingNumber,
            CarrierName = "Bosta",
            Barcode = $"EGY-SHP-{shipment.TrackingNumber}",
            Status = shipment.Status.ToString(),
            RecipientName = recipientName,
            RecipientPhone = recipientPhone,
            Governorate = order.Governorate,
            City = order.City,
            Area = order.Area,
            StreetBuilding = order.StreetBuilding,
            BuildingNumber = order.BuildingNumber ?? shipment.BuildingNumber,
            Floor = order.Floor ?? shipment.Floor,
            Apartment = order.Apartment ?? shipment.Apartment,
            Landmark = order.Landmark ?? shipment.Landmark,
            SenderName = seller?.Name ?? "Egypt Shop Merchant",
            SenderCity = "Cairo",
            DeliveryMethod = order.DeliveryMethod.ToString(),
            CodAmount = shipment.CodAmount,
            DeliveryCost = shipment.DeliveryCost,
            TotalParcelDue = shipment.CodAmount,
            AllowInspection = shipment.AllowInspection,
            ItemsCount = itemResponses.Sum(i => i.Quantity),
            Items = itemResponses,
            CreatedAt = DateTime.UtcNow
        };
    }

    public async Task<SellerShipmentResponse> UpdateSellerShipmentStatusAsync(
        int sellerId,
        int shipmentId,
        UpdateShipmentStatusRequest request)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException("Shipment not found.");

        if (shipment.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to update this shipment.");

        var targetStatusString = request.Status?.Trim();

        // Rule: Sellers may ONLY set HandedToCarrier on their own shipments.
        // Trying to set Returned, Delivered, or other carrier statuses throws 403 Forbidden.
        if (!string.Equals(targetStatusString, nameof(ShipmentStatus.HandedToCarrier), StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Sellers may only set 'HandedToCarrier' on their own shipments. Status updates such as 'Returned' or 'Delivered' must come from the carrier.");
        }

        // Concurrency (D-004): take the same order row lock as OrderService.CancelOrderAsync, then re-read the
        // shipment so the status check sees the committed state (a concurrent cancel can no longer be overwritten).
        var orderIdForLock = shipment.OrderId;
        await _uow.BeginTransactionAsync();
        try
        {
            await _uow.ExecuteSqlRawAsync(@"SELECT 1 FROM ""Orders"" WHERE ""Id"" = {0} FOR UPDATE", orderIdForLock);
            _uow.ClearChangeTracker();

            shipment = await _uow.Shipments.GetByIdAsync(shipmentId)
                ?? throw new NotFoundException("Shipment not found.");

            if (shipment.Status != ShipmentStatus.Created && shipment.Status != ShipmentStatus.HandedToCarrier)
                throw new BadRequestException($"Cannot transition shipment from '{shipment.Status}' to 'HandedToCarrier'.");

            shipment.Status = ShipmentStatus.HandedToCarrier;
            if (!string.IsNullOrWhiteSpace(request.TrackingNumber)) shipment.TrackingNumber = request.TrackingNumber.Trim();
            _uow.Shipments.Update(shipment);

            await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.HandedToCarrier);
            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            throw;
        }

        await _notificationService.NotifyShipmentStatusChangedAsync(shipment.Id, ShipmentStatus.HandedToCarrier);

        var refreshedItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
        var prodIds = refreshedItems.Select(i => i.ProductId).Distinct().ToList();
        var prods = (await _uow.Products.FindAsync(p => prodIds.Contains(p.Id))).ToDictionary(p => p.Id);
        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);

        return MapSellerShipment(shipment, order, refreshedItems, prods);
    }

    public async Task<BuyerShipmentResponse> UpdateCarrierShipmentStatusAsync(
        int shipmentId,
        UpdateShipmentStatusRequest request)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException("Shipment not found.");

        var targetStatusString = request.Status?.Trim();
        if (string.IsNullOrWhiteSpace(targetStatusString) ||
            !Enum.TryParse<ShipmentStatus>(targetStatusString, true, out var targetStatus))
        {
            throw new BadRequestException($"Invalid carrier shipment status: '{request.Status}'.");
        }

        if (shipment.Status == ShipmentStatus.Delivered && targetStatus != ShipmentStatus.Delivered)
        {
            throw new BadRequestException("Cannot change status of an already delivered shipment.");
        }

        if ((shipment.Status == ShipmentStatus.Returned && targetStatus != ShipmentStatus.Returned) ||
            (shipment.Status == ShipmentStatus.Cancelled && targetStatus != ShipmentStatus.Cancelled))
        {
            throw new BadRequestException($"Cannot modify shipment status from terminal state '{shipment.Status}'.");
        }

        if (targetStatus == ShipmentStatus.Returned)
        {
            // Idempotent: If already Returned, return current state without restoring stock again
            if (shipment.Status == ShipmentStatus.Returned)
            {
                var curItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
                return MapBuyerShipment(shipment, curItems);
            }

            var allowedPreviousStates = new[]
            {
                ShipmentStatus.HandedToCarrier,
                ShipmentStatus.InTransit,
                ShipmentStatus.ReadyForPickup
            };

            if (!allowedPreviousStates.Contains(shipment.Status))
            {
                throw new BadRequestException($"Cannot transition shipment from '{shipment.Status}' to 'Returned'. Allowed previous states: HandedToCarrier, InTransit, ReadyForPickup.");
            }

            ReturnReason returnReason = ReturnReason.RefusedByBuyer;
            if (!string.IsNullOrWhiteSpace(request.ReturnReason) &&
                Enum.TryParse<ReturnReason>(request.ReturnReason.Trim(), true, out var parsedReason))
            {
                returnReason = parsedReason;
            }

            // Concurrency-safe: Atomic conditional SQL UPDATE ensuring only ONE parallel request can transition the row
            await _uow.BeginTransactionAsync();
            try
            {
                var affected = await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Shipments"" SET ""Status"" = 'Returned', ""ReturnReason"" = {0} WHERE ""Id"" = {1} AND ""Status"" IN ('HandedToCarrier', 'InTransit', 'ReadyForPickup')",
                    returnReason.ToString(),
                    shipment.Id);

                if (affected > 0)
                {
                    // This request won the atomic transition: restore stock for shipment items via atomic SQL increment
                    var shipmentItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
                    foreach (var item in shipmentItems)
                    {
                        if (item.VariantId.HasValue)
                        {
                            await _uow.ExecuteSqlRawAsync(
                                @"UPDATE ""ProductVariants"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                                item.Quantity,
                                item.VariantId.Value);
                        }
                        else
                        {
                            await _uow.ExecuteSqlRawAsync(
                                @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                                item.Quantity,
                                item.ProductId);
                        }
                    }

                    if (returnReason == ReturnReason.RefusedByBuyer || string.Equals(request.ReturnReason?.Trim(), "CustomerUnreachable", StringComparison.OrdinalIgnoreCase))
                    {
                        await RecordCodRefusalAsync(shipment.OrderId, shipment.Id, returnReason);
                    }
                    await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.Returned);
                    await _uow.SaveChangesAsync();
                }

                await _uow.CommitTransactionAsync();

                if (affected > 0)
                {
                    await _notificationService.NotifyShipmentStatusChangedAsync(shipment.Id, ShipmentStatus.Returned);
                }
            }
            catch
            {
                await _uow.RollbackTransactionAsync();
                throw;
            }
        }
        else if (targetStatus == ShipmentStatus.Delivered)
        {
            // Idempotent: If already Delivered, return current state without re-settling
            if (shipment.Status == ShipmentStatus.Delivered)
            {
                var curItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
                return MapBuyerShipment(shipment, curItems);
            }

            var allowedPreviousStates = new[]
            {
                ShipmentStatus.HandedToCarrier,
                ShipmentStatus.InTransit,
                ShipmentStatus.ReadyForPickup
            };

            if (!allowedPreviousStates.Contains(shipment.Status))
            {
                throw new BadRequestException($"Cannot transition shipment from '{shipment.Status}' to 'Delivered'. Allowed previous states: HandedToCarrier, InTransit, ReadyForPickup.");
            }

            // Concurrency-safe: Atomic conditional SQL UPDATE ensuring only ONE parallel request can transition the row
            await _uow.BeginTransactionAsync();
            try
            {
                var affected = await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Shipments"" SET ""Status"" = 'Delivered', ""DeliveredAt"" = {0} WHERE ""Id"" = {1} AND ""Status"" IN ('HandedToCarrier', 'InTransit', 'ReadyForPickup')",
                    DateTime.UtcNow,
                    shipment.Id);

                if (affected > 0)
                {
                    await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.Delivered);
                    await _uow.SaveChangesAsync();
                    await _walletService.ProcessShipmentDeliveredAsync(shipment.Id);
                }

                await _uow.CommitTransactionAsync();

                if (affected > 0)
                {
                    await _notificationService.NotifyShipmentStatusChangedAsync(shipment.Id, ShipmentStatus.Delivered);
                }
            }
            catch
            {
                await _uow.RollbackTransactionAsync();
                throw;
            }
        }
        else
        {
            shipment.Status = targetStatus;
            _uow.Shipments.Update(shipment);
            await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, targetStatus);
            await _uow.SaveChangesAsync();

            await _notificationService.NotifyShipmentStatusChangedAsync(shipment.Id, targetStatus);
        }

        var refreshedShipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        var finalItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();
        return MapBuyerShipment(refreshedShipment ?? shipment, finalItems);
    }

    private async Task UpdateParentOrderStatusAsync(int orderId, int updatedShipmentId, ShipmentStatus newStatus)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order != null)
        {
            var allOrderShipments = (await _uow.Shipments.FindAsync(s => s.OrderId == order.Id)).ToList();
            foreach (var s in allOrderShipments)
            {
                if (s.Id == updatedShipmentId)
                    s.Status = newStatus;
            }
            order.Status = Order.DeriveStatus(allOrderShipments.Select(s => s.Status));
            _uow.Orders.Update(order);
        }
    }

    private static SellerShipmentResponse MapSellerShipment(
        Shipment shipment,
        Order? order,
        List<OrderItem> items,
        Dictionary<int, Product> products)
    {
        var itemDtos = items.Select(i => new OrderItemResponse
        {
            ProductId = i.ProductId,
            ProductName = products.TryGetValue(i.ProductId, out var p) ? p.Name : "Unknown",
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            WeightGrams = products.TryGetValue(i.ProductId, out var pw) ? pw.WeightGrams : 500
        }).ToList();

        return new SellerShipmentResponse
        {
            Id = shipment.Id,
            OrderId = shipment.OrderId,
            Status = shipment.Status.ToString(),
            TrackingNumber = shipment.TrackingNumber,
            DeliveryMethod = order?.DeliveryMethod.ToString() ?? nameof(DeliveryMethod.Pickup),
            DeliveryCost = shipment.DeliveryCost,
            CodAmount = shipment.CodAmount,
            IsCodSettled = shipment.IsCodSettled,
            CodSettledAt = shipment.CodSettledAt,
            FlaggedForReview = shipment.FlaggedForReview,
            ReceivedAmount = shipment.ReceivedAmount,
            SettlementReference = shipment.SettlementReference,
            ReturnReason = shipment.ReturnReason?.ToString(),
            EtaMinDays = shipment.EtaMinDays,
            EtaMaxDays = shipment.EtaMaxDays,
            BuildingNumber = null,
            Floor = null,
            Apartment = null,
            Landmark = null,
            AllowInspection = shipment.AllowInspection,
            CourierName = shipment.CourierName,
            CourierPhone = shipment.CourierPhone,
            EstimatedDeliveryAt = shipment.EstimatedDeliveryAt,
            PickupPointCode = shipment.PickupPointCode,
            // Privacy rule (PDPL Law 151/2020): ONLY recipient's first name, city, and governorate
            RecipientFirstName = ExtractFirstName(order?.RecipientName),
            RecipientGovernorate = order?.Governorate ?? string.Empty,
            RecipientCity = order?.City ?? string.Empty,
            ItemsSubtotal = itemDtos.Sum(i => i.UnitPrice * i.Quantity),
            CreatedAt = shipment.CreatedAt,
            Items = itemDtos
        };
    }

    private static string ExtractFirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return string.Empty;

        return fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
    }

    private static BuyerShipmentResponse MapBuyerShipment(Shipment shipment, List<OrderItem> items)
    {
        return new BuyerShipmentResponse
        {
            Id = shipment.Id,
            OrderId = shipment.OrderId,
            SellerId = shipment.SellerId,
            SellerName = shipment.Seller?.Name ?? $"Seller {shipment.SellerId}",
            Status = shipment.Status.ToString(),
            TrackingNumber = shipment.TrackingNumber,
            DeliveryCost = shipment.DeliveryCost,
            CodAmount = shipment.CodAmount,
            IsCodSettled = shipment.IsCodSettled,
            CodSettledAt = shipment.CodSettledAt,
            FlaggedForReview = shipment.FlaggedForReview,
            ReceivedAmount = shipment.ReceivedAmount,
            SettlementReference = shipment.SettlementReference,
            ReturnReason = shipment.ReturnReason?.ToString(),
            EtaMinDays = shipment.EtaMinDays,
            EtaMaxDays = shipment.EtaMaxDays,
            CreatedAt = shipment.CreatedAt,
            BuildingNumber = shipment.BuildingNumber,
            Floor = shipment.Floor,
            Apartment = shipment.Apartment,
            Landmark = shipment.Landmark,
            DeliveryLatitude = shipment.DeliveryLatitude,
            DeliveryLongitude = shipment.DeliveryLongitude,
            EscrowReleaseAt = shipment.EscrowReleaseAt,
            AllowInspection = shipment.AllowInspection,
            Items = items.Select(i => new OrderItemResponse
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "Item",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                WeightGrams = i.Product?.WeightGrams ?? 500
            }).ToList()
        };
    }

    public async Task<AdminShipmentPagedResponse> GetAdminShipmentsAsync(string? status, int? orderId, int? sellerId, int page, int pageSize)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 || pageSize > 100 ? 20 : pageSize;

        var query = _uow.Shipments.Query();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ShipmentStatus>(status.Trim(), true, out var filterStatus))
        {
            query = query.Where(s => s.Status == filterStatus);
        }

        if (orderId.HasValue && orderId.Value > 0)
        {
            query = query.Where(s => s.OrderId == orderId.Value);
        }

        if (sellerId.HasValue && sellerId.Value > 0)
        {
            query = query.Where(s => s.SellerId == sellerId.Value);
        }

        int totalCount = query.Count();

        var shipments = query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        if (!shipments.Any())
        {
            return new AdminShipmentPagedResponse
            {
                Items = new List<AdminShipmentDetailResponse>(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }

        var shipmentIds = shipments.Select(s => s.Id).ToList();
        var orderIds = shipments.Select(s => s.OrderId).Distinct().ToList();
        var sellerIds = shipments.Select(s => s.SellerId).Distinct().ToList();

        var orders = (await _uow.Orders.FindAsync(o => orderIds.Contains(o.Id))).ToDictionary(o => o.Id);
        var buyerIds = orders.Values.Select(o => o.BuyerId).Distinct().ToList();

        var userIds = sellerIds.Concat(buyerIds).Distinct().ToList();
        var users = (await _uow.Users.FindAsync(u => userIds.Contains(u.Id))).ToDictionary(u => u.Id);

        var allItems = (await _uow.OrderItems.FindAsync(i => shipmentIds.Contains(i.ShipmentId))).ToList();
        var productIds = allItems.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var shipmentDetails = shipments.Select(s =>
        {
            orders.TryGetValue(s.OrderId, out var order);
            User? buyer = null;
            if (order != null) users.TryGetValue(order.BuyerId, out buyer);
            users.TryGetValue(s.SellerId, out var seller);
            var items = allItems.Where(i => i.ShipmentId == s.Id).ToList();

            return MapAdminShipmentDetail(s, order, buyer, seller, items, products);
        }).ToList();

        return new AdminShipmentPagedResponse
        {
            Items = shipmentDetails,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<AdminShipmentDetailResponse> UpdateAdminShipmentStatusAsync(int adminId, int shipmentId, AdminUpdateShipmentStatusRequest request)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment with ID {shipmentId} not found.");

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        if (order == null)
            throw new NotFoundException($"Parent Order with ID {shipment.OrderId} not found.");

        var oldStatus = shipment.Status;
        ShipmentStatus targetStatus = shipment.Status;

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (!Enum.TryParse<ShipmentStatus>(request.Status.Trim(), true, out targetStatus))
                throw new BadRequestException($"Invalid shipment status: '{request.Status}'.");
        }

        ReturnReason? parsedReturnReason = null;
        if (!string.IsNullOrWhiteSpace(request.ReturnReason) && Enum.TryParse<ReturnReason>(request.ReturnReason.Trim(), true, out var reasonVal))
        {
            parsedReturnReason = reasonVal;
        }

        if (targetStatus == ShipmentStatus.Returned)
        {
            shipment.ReturnReason = parsedReturnReason ?? ReturnReason.RefusedByBuyer;

            if (shipment.ReturnReason == ReturnReason.RefusedByBuyer || string.Equals(request.ReturnReason?.Trim(), "CustomerUnreachable", StringComparison.OrdinalIgnoreCase))
            {
                await RecordCodRefusalAsync(order.Id, shipment.Id, shipment.ReturnReason.Value);
            }

            if (oldStatus != ShipmentStatus.Returned)
            {
                var shipmentItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
                foreach (var item in shipmentItems)
                {
                    if (item.VariantId.HasValue)
                    {
                        await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""ProductVariants"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                            item.Quantity,
                            item.VariantId.Value);
                    }
                    else
                    {
                        await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                            item.Quantity,
                            item.ProductId);
                    }
                }
            }
        }
        else if (targetStatus == ShipmentStatus.Delivered)
        {
            shipment.DeliveredAt ??= DateTime.UtcNow;
            int holdDays = _configuration.GetValue<int>("Wallet:SettlementHoldDays", 7);
            shipment.EscrowReleaseAt ??= DateTime.UtcNow.AddDays(holdDays);
        }

        shipment.Status = targetStatus;

        if (!string.IsNullOrWhiteSpace(request.TrackingNumber))
        {
            shipment.TrackingNumber = request.TrackingNumber.Trim();
        }

        if (request.SettleCod)
        {
            shipment.IsCodSettled = true;
            shipment.CodSettledAt = DateTime.UtcNow;
            shipment.SettledByAdminId = adminId;
            shipment.ReceivedAmount = request.ReceivedAmount ?? shipment.CodAmount;
            if (!string.IsNullOrWhiteSpace(request.SettlementReference))
            {
                shipment.SettlementReference = request.SettlementReference.Trim();
            }
        }

        _uow.Shipments.Update(shipment);
        await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, targetStatus);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "AdminUpdateShipmentStatus",
            EntityType = "Shipment",
            EntityId = shipment.Id.ToString(),
            Details = $"Shipment #{shipment.Id} updated from {oldStatus} to {targetStatus}. Tracking: '{shipment.TrackingNumber}'. SettleCod: {request.SettleCod}. Notes: {request.AdminNotes}",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();

        if (targetStatus == ShipmentStatus.Delivered && oldStatus != ShipmentStatus.Delivered)
        {
            await _walletService.ProcessShipmentDeliveredAsync(shipment.Id);
        }

        if (oldStatus != targetStatus)
        {
            await _notificationService.NotifyShipmentStatusChangedAsync(shipment.Id, targetStatus);
        }

        var buyerUser = await _uow.Users.GetByIdAsync(order.BuyerId);
        var sellerUser = await _uow.Users.GetByIdAsync(shipment.SellerId);
        var itemsList = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipment.Id)).ToList();
        var pIds = itemsList.Select(i => i.ProductId).Distinct().ToList();
        var prods = (await _uow.Products.FindAsync(p => pIds.Contains(p.Id))).ToDictionary(p => p.Id);

        return MapAdminShipmentDetail(shipment, order, buyerUser, sellerUser, itemsList, prods);
    }

    private static AdminShipmentDetailResponse MapAdminShipmentDetail(
        Shipment s,
        Order? order,
        User? buyer,
        User? seller,
        List<OrderItem> items,
        Dictionary<int, Product> products)
    {
        var itemDtos = items.Select(i => new OrderItemResponse
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductName = products.TryGetValue(i.ProductId, out var p) ? p.Name : "Unknown",
            VariantId = i.VariantId,
            VariantSummary = i.VariantSummary,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            WeightGrams = products.TryGetValue(i.ProductId, out var pw) ? pw.WeightGrams : 500
        }).ToList();

        return new AdminShipmentDetailResponse
        {
            Id = s.Id,
            OrderId = s.OrderId,
            SellerId = s.SellerId,
            SellerName = seller?.Name ?? $"Seller {s.SellerId}",
            BuyerId = order?.BuyerId ?? 0,
            BuyerName = buyer?.Name ?? "Buyer",
            BuyerPhone = buyer?.Phone ?? string.Empty,
            Status = s.Status.ToString(),
            TrackingNumber = s.TrackingNumber,
            DeliveryMethod = order?.DeliveryMethod.ToString() ?? "Courier",
            DeliveryCost = s.DeliveryCost,
            CodAmount = s.CodAmount,
            IsCodSettled = s.IsCodSettled,
            CodSettledAt = s.CodSettledAt,
            FlaggedForReview = s.FlaggedForReview,
            ReceivedAmount = s.ReceivedAmount,
            SettlementReference = s.SettlementReference,
            ReturnReason = s.ReturnReason?.ToString(),
            EtaMinDays = s.EtaMinDays,
            EtaMaxDays = s.EtaMaxDays,
            RecipientName = order?.RecipientName ?? string.Empty,
            RecipientPhone = order?.RecipientPhone ?? string.Empty,
            Governorate = order?.Governorate ?? string.Empty,
            City = order?.City ?? string.Empty,
            Area = order?.Area ?? string.Empty,
            StreetBuilding = order?.StreetBuilding ?? string.Empty,
            BuildingNumber = s.BuildingNumber ?? order?.BuildingNumber,
            Floor = s.Floor ?? order?.Floor,
            Apartment = s.Apartment ?? order?.Apartment,
            Landmark = s.Landmark ?? order?.Landmark,
            DeliveryLatitude = s.DeliveryLatitude ?? order?.DeliveryLatitude,
            DeliveryLongitude = s.DeliveryLongitude ?? order?.DeliveryLongitude,
            EscrowReleaseAt = s.EscrowReleaseAt,
            AllowInspection = s.AllowInspection,
            CreatedAt = s.CreatedAt,
            DeliveredAt = s.DeliveredAt,
            CourierName = s.CourierName,
            CourierPhone = s.CourierPhone,
            EstimatedDeliveryAt = s.EstimatedDeliveryAt,
            PickupPointCode = s.PickupPointCode,
            Items = itemDtos
        };
    }

    private async Task RecordCodRefusalAsync(int orderId, int shipmentId, ReturnReason returnReason)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null) return;

        var buyer = await _uow.Users.GetByIdAsync(order.BuyerId);
        if (buyer != null)
        {
            buyer.CodRefusalCount += 1;
            _uow.Users.Update(buyer);
        }

        var normalizedPhone = Marketplace.Application.Common.EgyptianPhoneNormalizer.Normalize(order.RecipientPhone)
            ?? (buyer != null ? Marketplace.Application.Common.EgyptianPhoneNormalizer.Normalize(buyer.Phone) : null)
            ?? order.RecipientPhone;

        var existing = await _uow.CodBlacklistEntries.FindAsync(e =>
            e.PhoneNormalized == normalizedPhone || (e.UserId.HasValue && e.UserId == order.BuyerId));

        var entry = existing.FirstOrDefault();
        int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);

        if (entry == null)
        {
            entry = new Marketplace.Domain.Entities.CodBlacklistEntry
            {
                PhoneNormalized = normalizedPhone,
                UserId = order.BuyerId,
                Reason = $"Refusal on shipment #{shipmentId} (Reason: {returnReason})",
                RefusalCount = buyer?.CodRefusalCount ?? 1,
                CreatedAt = DateTime.UtcNow
            };
            entry.RiskScore = entry.RefusalCount * 35;
            if (entry.RefusalCount >= maxCodRefusals)
            {
                entry.IsBlocked = true;
            }
            await _uow.CodBlacklistEntries.AddAsync(entry);
        }
        else
        {
            entry.RefusalCount = Math.Max(entry.RefusalCount + 1, buyer?.CodRefusalCount ?? 1);
            entry.RiskScore = entry.RefusalCount * 35;
            entry.Reason = $"Refusal on shipment #{shipmentId} (Reason: {returnReason}); Previous: {entry.Reason}";
            if (entry.RefusalCount >= maxCodRefusals)
            {
                entry.IsBlocked = true;
            }
            _uow.CodBlacklistEntries.Update(entry);
        }
    }


    public async Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.BatchReference))
            throw new BadRequestException("BatchReference is required.");

        var response = new SettleRemittanceBatchResponse
        {
            BatchReference = request.BatchReference.Trim()
        };

        foreach (var item in request.Items)
        {
            response.TotalProcessed++;
            Shipment? shipment = null;

            if (item.ShipmentId.HasValue)
            {
                shipment = await _uow.Shipments.GetByIdAsync(item.ShipmentId.Value);
            }
            else if (!string.IsNullOrWhiteSpace(item.TrackingNumber))
            {
                var tn = item.TrackingNumber.Trim();
                shipment = (await _uow.Shipments.FindAsync(s => s.TrackingNumber == tn)).FirstOrDefault();
            }

            if (shipment == null)
            {
                response.Errors.Add($"Shipment with tracking/ID '{item.TrackingNumber ?? item.ShipmentId?.ToString()}' not found.");
                continue;
            }

            if (shipment.IsCodSettled)
            {
                response.Errors.Add($"Shipment #{shipment.Id} is already settled under reference '{shipment.SettlementReference}'.");
                continue;
            }

            shipment.IsCodSettled = true;
            shipment.CodSettledAt = DateTime.UtcNow;
            shipment.SettlementReference = response.BatchReference;
            shipment.RemittanceBatchReference = response.BatchReference;
            shipment.ReceivedAmount = item.CollectedAmount;
            shipment.SettledByAdminId = adminId;
            shipment.EscrowReleaseAt = DateTime.UtcNow;

            _uow.Shipments.Update(shipment);
            response.TotalSettled++;
            response.TotalAmount += item.CollectedAmount;
        }

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "SettleRemittanceBatch",
            EntityType = "RemittanceBatch",
            EntityId = response.BatchReference,
            Details = $"Settled {response.TotalSettled}/{response.TotalProcessed} shipments in batch '{response.BatchReference}'. Total: {response.TotalAmount} EGP.",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();
        return response;
    }

    public async Task<CarrierRemittanceBatchDto> ReconcileCarrierSheetAsync(int adminId, ReconcileCarrierSheetRequest request)
    {
        var discrepancies = new List<string>();
        int matchedCount = 0;
        int mismatchCount = 0;
        decimal expectedCodTotal = 0;
        decimal actualRemittedTotal = 0;
        decimal carrierFeesTotal = 0;

        foreach (var item in request.Items)
        {
            var shipments = await _uow.Shipments.FindAsync(s => s.TrackingNumber == item.TrackingNumber);
            var shipment = shipments.FirstOrDefault();

            if (shipment == null)
            {
                mismatchCount++;
                discrepancies.Add($"الشحنة برقم التتبع {item.TrackingNumber} غير موجودة في النظام.");
                continue;
            }

            expectedCodTotal += shipment.CodAmount;
            actualRemittedTotal += item.CollectedAmount;
            carrierFeesTotal += item.ShippingFee;

            if (shipment.CodAmount == item.CollectedAmount)
            {
                matchedCount++;
                shipment.IsCodSettled = true;
                shipment.RemittanceBatchReference = request.BatchReference;
                shipment.ReceivedAmount = item.CollectedAmount;
                if (item.Status.Equals("Delivered", StringComparison.OrdinalIgnoreCase))
                {
                    shipment.Status = ShipmentStatus.Delivered;
                    shipment.DeliveredAt ??= DateTime.UtcNow;
                }
                _uow.Shipments.Update(shipment);
            }
            else
            {
                mismatchCount++;
                discrepancies.Add($"فروقات مالية في الشحنة {item.TrackingNumber}: المتوقع {shipment.CodAmount} ج.م، المحصل الفعلي {item.CollectedAmount} ج.م.");
            }
        }

        var netSettled = actualRemittedTotal - carrierFeesTotal;
        var batchStatus = mismatchCount > 0 ? "DiscrepancyDetected" : "Reconciled";

        var batch = new CarrierRemittanceBatch
        {
            BatchReference = request.BatchReference,
            CarrierName = request.CarrierName,
            UploadedByAdminId = adminId,
            TotalShipmentsCount = request.Items.Count,
            MatchedCount = matchedCount,
            MismatchCount = mismatchCount,
            ExpectedCodTotal = expectedCodTotal,
            ActualRemittedTotal = actualRemittedTotal,
            CarrierFeesTotal = carrierFeesTotal,
            NetSettledTotal = netSettled,
            DiscrepanciesJson = discrepancies.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(discrepancies) : null,
            Status = batchStatus,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.CarrierRemittanceBatches.AddAsync(batch);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "ReconcileCarrierSheet",
            EntityType = "CarrierRemittanceBatch",
            EntityId = request.BatchReference,
            Details = $"Reconciled {request.Items.Count} shipments for carrier {request.CarrierName}. Matched: {matchedCount}, Mismatched: {mismatchCount}",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();

        return new CarrierRemittanceBatchDto
        {
            Id = batch.Id,
            BatchReference = batch.BatchReference,
            CarrierName = batch.CarrierName,
            UploadedByAdminId = batch.UploadedByAdminId,
            TotalShipmentsCount = batch.TotalShipmentsCount,
            MatchedCount = batch.MatchedCount,
            MismatchCount = batch.MismatchCount,
            ExpectedCodTotal = batch.ExpectedCodTotal,
            ActualRemittedTotal = batch.ActualRemittedTotal,
            CarrierFeesTotal = batch.CarrierFeesTotal,
            NetSettledTotal = batch.NetSettledTotal,
            DiscrepanciesJson = batch.DiscrepanciesJson,
            Status = batch.Status,
            CreatedAt = batch.CreatedAt
        };
    }

    public async Task<SellerShipmentResponse> ProcessPartialDeliveryAsync(int shipmentId, PartialDeliveryRequest request, int adminId)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment {shipmentId} not found");

        var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();
        if (!items.Any())
            throw new BadRequestException("No items found for this shipment");

        decimal acceptedItemsTotal = 0;

        foreach (var reqItem in request.Items)
        {
            var orderItem = items.FirstOrDefault(i => i.Id == reqItem.OrderItemId);
            if (orderItem == null)
                throw new NotFoundException($"OrderItem {reqItem.OrderItemId} does not belong to shipment {shipmentId}");

            if (reqItem.AcceptedQuantity + reqItem.RefusedQuantity != orderItem.Quantity)
                throw new BadRequestException($"Accepted ({reqItem.AcceptedQuantity}) + Refused ({reqItem.RefusedQuantity}) must equal total order quantity ({orderItem.Quantity}) for item {orderItem.Id}");

            orderItem.AcceptedQuantity = reqItem.AcceptedQuantity;
            orderItem.RefusedQuantity = reqItem.RefusedQuantity;
            _uow.OrderItems.Update(orderItem);

            acceptedItemsTotal += reqItem.AcceptedQuantity * orderItem.UnitPrice;

            // Restock refused quantity
            if (reqItem.RefusedQuantity > 0)
            {
                var product = await _uow.Products.GetByIdAsync(orderItem.ProductId);
                if (product != null)
                {
                    product.Stock += reqItem.RefusedQuantity;
                    _uow.Products.Update(product);
                }

                if (orderItem.VariantId.HasValue)
                {
                    var variant = await _uow.ProductVariants.GetByIdAsync(orderItem.VariantId.Value);
                    if (variant != null)
                    {
                        variant.Stock += reqItem.RefusedQuantity;
                        _uow.ProductVariants.Update(variant);
                    }
                }
            }
        }

        var newCodAmount = acceptedItemsTotal + shipment.DeliveryCost;
        shipment.IsPartiallyDelivered = true;
        shipment.AdjustedCodAmount = newCodAmount;
        shipment.CodAmount = newCodAmount;
        shipment.Status = ShipmentStatus.Delivered;
        shipment.DeliveredAt = DateTime.UtcNow;

        _uow.Shipments.Update(shipment);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "PartialDeliveryProcessed",
            EntityType = "Shipment",
            EntityId = shipmentId.ToString(),
            Details = $"Processed partial delivery for shipment {shipment.TrackingNumber}. Adjusted COD: {newCodAmount} EGP.",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id, p => p);
        return MapSellerShipment(shipment, order!, items, products);
    }

    public async Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment {shipmentId} not found");

        var isAdmin = userRole.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        var isSeller = userRole.Equals("Seller", StringComparison.OrdinalIgnoreCase);

        if (!isAdmin && isSeller && shipment.SellerId != requestingUserId)
            throw new ForbiddenException("You are not authorized to view the waybill for this shipment");

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == shipment.SellerId)).FirstOrDefault();
        var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();

        var barcodeSvg = GenerateBarcode128Svg(shipment.TrackingNumber);
        var inspectionText = shipment.AllowInspection 
            ? "✓ مسموح بالمعاينة والفحص قبل الاستلام (قانون حماية المستهلك)" 
            : "✗ غير مسموح بالفتح قبل الاستلام";
        var inspectionBadgeClass = shipment.AllowInspection ? "badge-success" : "badge-danger";

        var maskedPhone = MaskPhone(order?.RecipientPhone ?? "");
        var codFormatted = (shipment.AdjustedCodAmount ?? shipment.CodAmount).ToString("N2");

        var html = $@"<!DOCTYPE html>
<html lang=""ar"" dir=""rtl"">
<head>
<meta charset=""utf-8"">
<title>بوليصة شحن - {shipment.TrackingNumber}</title>
<style>
  @page {{ size: 4in 6in; margin: 0; }}
  body {{ font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 16px; background: #fff; color: #000; box-sizing: border-box; }}
  .waybill {{ border: 2px solid #000; padding: 12px; height: calc(100% - 24px); display: flex; flex-direction: column; justify-content: space-between; }}
  .header {{ border-bottom: 2px solid #000; padding-bottom: 8px; text-align: center; }}
  .title {{ font-size: 20px; font-weight: 900; margin: 0; }}
  .barcode {{ margin: 10px 0; text-align: center; }}
  .tracking {{ font-size: 16px; font-weight: bold; letter-spacing: 2px; }}
  .badge {{ display: block; padding: 6px; text-align: center; font-weight: bold; font-size: 13px; margin: 8px 0; border: 1px solid #000; }}
  .badge-success {{ background: #e6f4ea; color: #137333; }}
  .badge-danger {{ background: #fce8e6; color: #c5221f; }}
  .section {{ margin: 8px 0; padding: 6px; border: 1px dashed #666; font-size: 12px; }}
  .label {{ font-weight: bold; display: inline-block; width: 80px; }}
  .cod-box {{ background: #000; color: #fff; padding: 10px; text-align: center; border-radius: 6px; margin-top: 8px; }}
  .cod-title {{ font-size: 12px; }}
  .cod-amount {{ font-size: 26px; font-weight: 900; }}
</style>
</head>
<body>
  <div class=""waybill"">
    <div>
      <div class=""header"">
        <h1 class=""title"">سوق مصر - بوليصة شحن قياسية</h1>
      </div>
      <div class=""barcode"">
        {barcodeSvg}
        <div class=""tracking"">{shipment.TrackingNumber}</div>
      </div>
      <div class=""badge {inspectionBadgeClass}"">{inspectionText}</div>
      
      <div class=""section"">
        <div><span class=""label"">المرسل:</span> {sellerProfile?.DispatchCity ?? "القاهرة"} - {sellerProfile?.ContactPhone ?? ""}</div>
        <div><span class=""label"">المرسل إليه:</span> {order?.RecipientName ?? "العميل"}</div>
        <div><span class=""label"">الهاتف:</span> {maskedPhone}</div>
        <div><span class=""label"">العنوان:</span> {order?.Governorate} - {order?.City} - {order?.StreetBuilding}</div>
        <div><span class=""label"">عدد البنود:</span> {items.Count}</div>
      </div>
    </div>

    <div class=""cod-box"">
      <div class=""cod-title"">المبلغ المطلوب تحصيله نقداً عند الاستلام (COD)</div>
      <div class=""cod-amount"">{codFormatted} ج.م</div>
    </div>
  </div>
</body>
</html>";

        return html;
    }

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone) || phone.Length < 7) return phone;
        return phone.Substring(0, 3) + "****" + phone.Substring(phone.Length - 4);
    }

    private static string GenerateBarcode128Svg(string text)
    {
        // Simple and robust SVG barcode representation
        return $@"<svg width=""280"" height=""60"" xmlns=""http://www.w3.org/2000/svg"">
            <rect width=""100%"" height=""100%"" fill=""white""/>
            <g fill=""black"">
                <rect x=""10"" y=""5"" width=""3"" height=""50""/>
                <rect x=""16"" y=""5"" width=""2"" height=""50""/>
                <rect x=""22"" y=""5"" width=""4"" height=""50""/>
                <rect x=""29"" y=""5"" width=""1"" height=""50""/>
                <rect x=""34"" y=""5"" width=""3"" height=""50""/>
                <rect x=""42"" y=""5"" width=""5"" height=""50""/>
                <rect x=""50"" y=""5"" width=""2"" height=""50""/>
                <rect x=""55"" y=""5"" width=""4"" height=""50""/>
                <rect x=""63"" y=""5"" width=""3"" height=""50""/>
                <rect x=""70"" y=""5"" width=""2"" height=""50""/>
                <rect x=""76"" y=""5"" width=""4"" height=""50""/>
                <rect x=""84"" y=""5"" width=""1"" height=""50""/>
                <rect x=""89"" y=""5"" width=""5"" height=""50""/>
                <rect x=""98"" y=""5"" width=""2"" height=""50""/>
                <rect x=""104"" y=""5"" width=""3"" height=""50""/>
                <rect x=""112"" y=""5"" width=""4"" height=""50""/>
                <rect x=""120"" y=""5"" width=""2"" height=""50""/>
                <rect x=""126"" y=""5"" width=""5"" height=""50""/>
                <rect x=""135"" y=""5"" width=""1"" height=""50""/>
                <rect x=""140"" y=""5"" width=""4"" height=""50""/>
                <rect x=""148"" y=""5"" width=""3"" height=""50""/>
                <rect x=""155"" y=""5"" width=""2"" height=""50""/>
                <rect x=""161"" y=""5"" width=""5"" height=""50""/>
                <rect x=""170"" y=""5"" width=""3"" height=""50""/>
                <rect x=""177"" y=""5"" width=""1"" height=""50""/>
                <rect x=""182"" y=""5"" width=""4"" height=""50""/>
                <rect x=""190"" y=""5"" width=""2"" height=""50""/>
                <rect x=""196"" y=""5"" width=""5"" height=""50""/>
                <rect x=""205"" y=""5"" width=""3"" height=""50""/>
                <rect x=""212"" y=""5"" width=""2"" height=""50""/>
                <rect x=""218"" y=""5"" width=""4"" height=""50""/>
                <rect x=""226"" y=""5"" width=""2"" height=""50""/>
                <rect x=""232"" y=""5"" width=""5"" height=""50""/>
                <rect x=""241"" y=""5"" width=""3"" height=""50""/>
                <rect x=""248"" y=""5"" width=""2"" height=""50""/>
                <rect x=""254"" y=""5"" width=""4"" height=""50""/>
                <rect x=""262"" y=""5"" width=""3"" height=""50""/>
            </g>
        </svg>";
    }


    public async Task<AdminShipmentDetailResponse> UpdateCourierDetailsAsync(int shipmentId, UpdateCourierDetailsRequest request)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment with ID {shipmentId} not found.");

        shipment.CourierName = request.CourierName?.Trim();
        shipment.CourierPhone = request.CourierPhone?.Trim();
        shipment.EstimatedDeliveryAt = request.EstimatedDeliveryAt;

        await _uow.SaveChangesAsync();

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        var seller = await _uow.Users.GetByIdAsync(shipment.SellerId);
        var buyer = order != null ? await _uow.Users.GetByIdAsync(order.BuyerId) : null;
        var items = _uow.OrderItems.Query().Where(i => i.OrderId == shipment.OrderId).ToList();
        var pIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = _uow.Products.Query().Where(p => pIds.Contains(p.Id)).ToDictionary(p => p.Id);

        return MapAdminShipmentDetail(shipment, order, seller, buyer, items, products);
    }

}
