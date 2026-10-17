using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Services;

public class ShipmentService : IShipmentService
{
    private readonly IUnitOfWork _uow;
    private readonly IDeliveryProvider _deliveryProvider;
    private readonly IWalletService _walletService;

    public ShipmentService(IUnitOfWork uow, IDeliveryProvider deliveryProvider, IWalletService walletService)
    {
        _uow = uow;
        _deliveryProvider = deliveryProvider;
        _walletService = walletService;
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

        var consolidatedItems = request.Items
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        var loadedItems = new List<(Product Product, int Quantity)>();
        foreach (var item in consolidatedItems)
        {
            var product = await _uow.Products.GetByIdAsync(item.ProductId);
            if (product == null)
                throw new NotFoundException($"Product with ID {item.ProductId} not found.");

            loadedItems.Add((product, item.Quantity));
        }

        var sellerIds = loadedItems.Select(x => x.Product.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);
        var sellerProfiles = (await _uow.SellerProfiles.FindAsync(sp => sellerIds.Contains(sp.UserId)))
            .ToDictionary(sp => sp.UserId);

        var parcels = new List<SellerParcelQuoteDto>();

        foreach (var group in loadedItems.GroupBy(x => x.Product.SellerId))
        {
            int sellerId = group.Key;
            string dispatchCity = sellerProfiles.TryGetValue(sellerId, out var profile) && !string.IsNullOrWhiteSpace(profile.DispatchCity)
                ? profile.DispatchCity
                : "القاهرة";

            int totalWeightGrams = group.Sum(x => Math.Max(1, x.Product.WeightGrams) * x.Quantity);
            decimal parcelItemsSubtotal = group.Sum(x => x.Product.Price * x.Quantity);

            var tariff = await _deliveryProvider.CalculateTariffAsync(new DeliveryTariffRequest
            {
                FromCity = dispatchCity,
                ToCity = destinationCity,
                DeliveryMethod = deliveryMethod,
                TotalWeightGrams = totalWeightGrams
            });

            parcels.Add(new SellerParcelQuoteDto
            {
                SellerId = sellerId,
                SellerName = sellers.GetValueOrDefault(sellerId, "Unknown"),
                DispatchCity = dispatchCity,
                DestinationCity = destinationCity,
                TotalWeightGrams = totalWeightGrams,
                ItemsSubtotal = parcelItemsSubtotal,
                DeliveryCost = tariff.Cost,
                EtaMinDays = tariff.EtaMinDays,
                EtaMaxDays = tariff.EtaMaxDays,
                Items = group.Select(x => new ParcelItemQuoteDto
                {
                    ProductId = x.Product.Id,
                    ProductName = x.Product.Name,
                    Quantity = x.Quantity,
                    UnitPrice = x.Product.Price,
                    WeightGrams = x.Product.WeightGrams
                }).ToList()
            });
        }

        decimal itemsSubtotal = parcels.Sum(p => p.ItemsSubtotal);
        decimal totalDeliveryCost = parcels.Sum(p => p.DeliveryCost);

        return new DeliveryQuoteResponse
        {
            DeliveryMethod = deliveryMethod.ToString(),
            DestinationCity = destinationCity,
            PickupPointId = pickupPointId,
            Parcels = parcels,
            ItemsSubtotal = itemsSubtotal,
            TotalDeliveryCost = totalDeliveryCost,
            TotalAmount = itemsSubtotal + totalDeliveryCost
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

        if (shipment.Status != ShipmentStatus.Created && shipment.Status != ShipmentStatus.HandedToCarrier)
            throw new BadRequestException($"Cannot transition shipment from '{shipment.Status}' to 'HandedToCarrier'.");

        shipment.Status = ShipmentStatus.HandedToCarrier;
        _uow.Shipments.Update(shipment);

        await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.HandedToCarrier);
        await _uow.SaveChangesAsync();

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
                        await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                            item.Quantity,
                            item.ProductId);
                    }

                    await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.Returned);
                    await _uow.SaveChangesAsync();
                }

                await _uow.CommitTransactionAsync();
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

            if (targetStatus == ShipmentStatus.Delivered)
            {
                await _walletService.ProcessShipmentDeliveredAsync(shipment.Id);
            }
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
            ReturnReason = shipment.ReturnReason?.ToString(),
            EtaMinDays = shipment.EtaMinDays,
            EtaMaxDays = shipment.EtaMaxDays,
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
            ReturnReason = shipment.ReturnReason?.ToString(),
            EtaMinDays = shipment.EtaMinDays,
            EtaMaxDays = shipment.EtaMaxDays,
            CreatedAt = shipment.CreatedAt,
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
}
