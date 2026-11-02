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

            // Concurrency-safe: Atomic conditional SQL UPDATE ensuring only ONE parallel request can transition the row
            await _uow.BeginTransactionAsync();
            try
            {
                var affected = await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Shipments"" SET ""Status"" = 'Delivered', ""DeliveredAt"" = {0} WHERE ""Id"" = {1} AND ""Status"" != 'Delivered'",
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
            BuildingNumber = shipment.BuildingNumber,
            Floor = shipment.Floor,
            Apartment = shipment.Apartment,
            Landmark = shipment.Landmark,
            AllowInspection = shipment.AllowInspection,
            // Privacy rule: ONLY recipient's first name and city — never phone, email, or full address
            RecipientFirstName = ExtractFirstName(order?.RecipientName),
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

            if (shipment.ReturnReason == ReturnReason.RefusedByBuyer)
            {
                var buyer = await _uow.Users.GetByIdAsync(order.BuyerId);
                if (buyer != null)
                {
                    buyer.CodRefusalCount += 1;
                    _uow.Users.Update(buyer);
                }
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
            Items = itemDtos
        };
    }
}
