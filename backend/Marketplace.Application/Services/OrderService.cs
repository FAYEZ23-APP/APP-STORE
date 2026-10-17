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

public class OrderService : IOrderService
{
    private readonly IUnitOfWork _uow;
    private readonly IDeliveryProvider _deliveryProvider;
    private readonly IConfiguration _configuration;

    public OrderService(IUnitOfWork uow, IDeliveryProvider deliveryProvider, IConfiguration configuration)
    {
        _uow = uow;
        _deliveryProvider = deliveryProvider;
        _configuration = configuration;
    }

    public async Task<OrderResponse> CreateOrderAsync(int buyerId, CreateOrderRequest request)
    {
        if (request.Items == null || !request.Items.Any())
            throw new BadRequestException("Order must contain at least one item.");

        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        if (buyer == null || buyer.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedException("الحساب غير موجود أو تم حذفه.");

        if (!Enum.TryParse<DeliveryMethod>(request.DeliveryMethod, true, out var deliveryMethod))
            throw new BadRequestException("DeliveryMethod must be 'Pickup' or 'Courier'.");

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            throw new BadRequestException("PaymentMethod must be 'OnReceipt'.");

        var normalizedPhone = EgyptianPhoneNormalizer.Normalize(request.RecipientPhone);

        // Refusal threshold check for Cash on Delivery (COD) - both by buyerId and phone
        if (paymentMethod == PaymentMethod.OnReceipt)
        {
            int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);
            var buyerShipments = await _uow.Shipments.FindAsync(s =>
                (s.Order.BuyerId == buyerId || s.Order.RecipientPhone == normalizedPhone) &&
                s.Status == ShipmentStatus.Returned &&
                s.ReturnReason == ReturnReason.RefusedByBuyer);

            int refusedCount = buyerShipments.Count();
            if (refusedCount >= maxCodRefusals)
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }

            // DoS Prevention: Maximum concurrent active/pending orders per buyer / phone
            var activeOrders = await _uow.Orders.FindAsync(o =>
                (o.BuyerId == buyerId || o.RecipientPhone == normalizedPhone) &&
                o.Status != OrderStatus.Delivered &&
                o.Status != OrderStatus.Cancelled);

            if (activeOrders.Count() >= 10)
            {
                throw new BadRequestException("لقد وصلت إلى الحد الأقصى للطلبات النشطة قيد التنفيذ (10 طلبات). يرجى انتظار استلام طلباتك السابقة.");
            }
        }

        string destinationGovernorate;
        string destinationCity;
        string destinationArea;
        string destinationStreetBuilding;
        string? addressLine;
        string? pickupPointId = null;

        if (deliveryMethod == DeliveryMethod.Pickup)
        {
            if (string.IsNullOrWhiteSpace(request.PickupPointId))
                throw new BadRequestException("PickupPointId is required for Pickup delivery.");

            var point = await _deliveryProvider.GetPickupPointByIdAsync(request.PickupPointId.Trim());
            if (point == null)
                throw new BadRequestException("Invalid PickupPointId.");

            if (!string.IsNullOrWhiteSpace(request.City) &&
                !string.Equals(request.City.Trim(), point.City, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Pickup point '{point.Id}' belongs to city '{point.City}', not '{request.City}'.");
            }

            pickupPointId = point.Id;
            destinationCity = point.City;
            destinationGovernorate = string.IsNullOrWhiteSpace(request.Governorate) ? point.City : request.Governorate.Trim();
            destinationArea = "نقطة استلام";
            destinationStreetBuilding = point.Address;
            addressLine = point.Address;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.City))
                throw new BadRequestException("City is required for Courier delivery.");

            if (!await _deliveryProvider.IsValidCityAsync(request.City.Trim()))
                throw new BadRequestException("Selected City is not supported by the delivery provider.");

            destinationCity = request.City.Trim();
            destinationGovernorate = string.IsNullOrWhiteSpace(request.Governorate) ? destinationCity : request.Governorate.Trim();
            destinationArea = string.IsNullOrWhiteSpace(request.Area) ? "غير محدد" : request.Area.Trim();
            destinationStreetBuilding = string.IsNullOrWhiteSpace(request.StreetBuilding)
                ? (request.AddressLine?.Trim() ?? string.Empty)
                : request.StreetBuilding.Trim();

            if (string.IsNullOrWhiteSpace(destinationStreetBuilding))
                throw new BadRequestException("StreetBuilding or AddressLine is required for Courier delivery.");

            addressLine = $"{destinationArea}، {destinationStreetBuilding}".Trim();
        }

        // Consolidate duplicate product IDs if any
        var consolidatedItems = request.Items
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        var loadedItems = new List<(Product Product, int Quantity)>();

        await _uow.BeginTransactionAsync();
        try
        {
            foreach (var reqItem in consolidatedItems)
            {
                if (reqItem.Quantity <= 0)
                    throw new BadRequestException("يجب أن تكون كمية المنتج أكبر من الصفر.");

                var product = await _uow.Products.GetByIdAsync(reqItem.ProductId);
                if (product == null)
                    throw new NotFoundException($"Product with ID {reqItem.ProductId} not found.");

                // Self-dealing prevention
                if (product.SellerId == buyerId)
                {
                    throw new BadRequestException($"لا يمكنك شراء منتجك الخاص '{product.Name}'.");
                }

                // Atomic conditional stock decrement: only succeeds if current Stock >= reqItem.Quantity
                var affected = await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" - {0} WHERE ""Id"" = {1} AND ""Stock"" >= {0}",
                    reqItem.Quantity,
                    reqItem.ProductId);

                if (affected == 0)
                {
                    throw new BadRequestException($"المخزون غير كافٍ للمنتج '{product.Name}'. المتوفر أقل من الكمية المطلوبة.");
                }

                // Keep tracked product entity unmodified so SaveChangesAsync doesn't overwrite atomic SQL update
                loadedItems.Add((product, reqItem.Quantity));
            }

            var sellerIds = loadedItems.Select(x => x.Product.SellerId).Distinct().ToList();
            var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);
            var sellerProfiles = (await _uow.SellerProfiles.FindAsync(sp => sellerIds.Contains(sp.UserId)))
                .ToDictionary(sp => sp.UserId);

            // normalizedPhone is already computed above

            var order = new Order
            {
                BuyerId = buyerId,
                DeliveryMethod = deliveryMethod,
                PickupPointId = pickupPointId,
                RecipientName = request.RecipientName.Trim(),
                RecipientPhone = normalizedPhone,
                Governorate = destinationGovernorate,
                City = destinationCity,
                Area = destinationArea,
                StreetBuilding = destinationStreetBuilding,
                PaymentMethod = paymentMethod,
                CreatedAt = DateTime.UtcNow,
                Shipments = new List<Shipment>(),
                Items = new List<OrderItem>()
            };

            decimal itemsSubtotal = 0m;
            decimal deliveryTotal = 0m;

            // Group items by seller -> 1 Shipment per seller
            var sellerGroups = loadedItems.GroupBy(x => x.Product.SellerId);

            foreach (var group in sellerGroups)
            {
                int sellerId = group.Key;
                string dispatchCity = sellerProfiles.TryGetValue(sellerId, out var profile) && !string.IsNullOrWhiteSpace(profile.DispatchCity)
                    ? profile.DispatchCity
                    : "القاهرة";

                int parcelWeightGrams = group.Sum(x => Math.Max(1, x.Product.WeightGrams) * x.Quantity);
                decimal parcelItemsSubtotal = group.Sum(x => x.Product.Price * x.Quantity);

                var carrierShipment = await _deliveryProvider.CreateShipmentAsync(new CreateCarrierShipmentRequest
                {
                    SellerId = sellerId,
                    FromCity = dispatchCity,
                    ToCity = destinationCity,
                    DeliveryMethod = deliveryMethod,
                    PickupPointId = pickupPointId,
                    TotalWeightGrams = parcelWeightGrams
                });

                // Per-shipment COD amount = that shipment's items subtotal + that shipment's delivery cost
                decimal shipmentCodAmount = paymentMethod == PaymentMethod.OnReceipt
                    ? parcelItemsSubtotal + carrierShipment.DeliveryCost
                    : 0m;

                var shipment = new Shipment
                {
                    Order = order,
                    SellerId = sellerId,
                    Status = carrierShipment.Status,
                    TrackingNumber = carrierShipment.TrackingNumber,
                    DeliveryCost = carrierShipment.DeliveryCost,
                    CodAmount = shipmentCodAmount,
                    EtaMinDays = carrierShipment.EtaMinDays,
                    EtaMaxDays = carrierShipment.EtaMaxDays,
                    CreatedAt = DateTime.UtcNow,
                    Items = new List<OrderItem>()
                };

                foreach (var (product, quantity) in group)
                {
                    var orderItem = new OrderItem
                    {
                        Order = order,
                        Shipment = shipment,
                        ProductId = product.Id,
                        Quantity = quantity,
                        UnitPrice = product.Price
                    };

                    itemsSubtotal += orderItem.UnitPrice * orderItem.Quantity;
                    shipment.Items.Add(orderItem);
                    order.Items.Add(orderItem);
                }

                deliveryTotal += shipment.DeliveryCost;
                order.Shipments.Add(shipment);
            }

            // Server is authoritative for prices, delivery costs, and totals
            order.TotalAmount = itemsSubtotal + deliveryTotal;
            order.Status = Order.DeriveStatus(order.Shipments.Select(s => s.Status));

            await _uow.Orders.AddAsync(order);
            await _uow.SaveChangesAsync();

            await _uow.CommitTransactionAsync();

            var productLookup = loadedItems.ToDictionary(x => x.Product.Id, x => x.Product);

            return MapOrderToResponse(order, order.Shipments.ToList(), order.Items.ToList(), productLookup, sellers);
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<IEnumerable<OrderResponse>> GetBuyerOrdersAsync(int buyerId)
    {
        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        if (buyer == null || buyer.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedException("الحساب غير موجود أو تم حذفه.");

        var orders = (await _uow.Orders.FindAsync(o => o.BuyerId == buyerId))
            .OrderByDescending(o => o.CreatedAt)
            .ToList();

        if (!orders.Any())
            return Enumerable.Empty<OrderResponse>();

        var orderIds = orders.Select(o => o.Id).ToList();
        var allShipments = (await _uow.Shipments.FindAsync(s => orderIds.Contains(s.OrderId))).ToList();
        var allItems = (await _uow.OrderItems.FindAsync(i => orderIds.Contains(i.OrderId))).ToList();

        var productIds = allItems.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var sellerIds = allShipments.Select(s => s.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);

        var response = new List<OrderResponse>();
        foreach (var order in orders)
        {
            var shipments = allShipments.Where(s => s.OrderId == order.Id).ToList();
            var items = allItems.Where(i => i.OrderId == order.Id).ToList();
            response.Add(MapOrderToResponse(order, shipments, items, products, sellers));
        }

        return response;
    }

    public async Task<OrderResponse> GetOrderByIdAsync(int userId, int orderId)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order with ID {orderId} not found.");

        var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();
        bool isBuyer = order.BuyerId == userId;
        bool isSeller = shipments.Any(s => s.SellerId == userId);

        if (!isBuyer && !isSeller)
            throw new ForbiddenException("You do not have permission to view this order.");

        var items = (await _uow.OrderItems.FindAsync(i => i.OrderId == orderId)).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        // If caller is a Seller (not the Buyer), filter out other vendors' shipments and items
        if (!isBuyer && isSeller)
        {
            shipments = shipments.Where(s => s.SellerId == userId).ToList();
            var sellerProductIds = products.Values.Where(p => p.SellerId == userId).Select(p => p.Id).ToHashSet();
            items = items.Where(i => sellerProductIds.Contains(i.ProductId)).ToList();
        }

        var sellerIds = shipments.Select(s => s.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);

        var mapped = MapOrderToResponse(order, shipments, items, products, sellers);

        // If seller caller, ensure TotalAmount only reflects that seller's items and delivery cost
        if (!isBuyer && isSeller)
        {
            mapped.TotalAmount = mapped.ItemsSubtotal + mapped.DeliveryCost;
        }

        return mapped;
    }

    public async Task<IEnumerable<SellerOrderResponse>> GetSellerOrdersAsync(int sellerId)
    {
        var shipments = (await _uow.Shipments.FindAsync(s => s.SellerId == sellerId)).ToList();
        if (!shipments.Any())
            return Enumerable.Empty<SellerOrderResponse>();

        var shipmentIds = shipments.Select(s => s.Id).ToList();
        var orderIds = shipments.Select(s => s.OrderId).Distinct().ToList();

        var orders = (await _uow.Orders.FindAsync(o => orderIds.Contains(o.Id))).ToDictionary(o => o.Id);
        var buyerIds = orders.Values.Select(o => o.BuyerId).Distinct().ToList();
        var buyers = (await _uow.Users.FindAsync(u => buyerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);

        var items = (await _uow.OrderItems.FindAsync(i => shipmentIds.Contains(i.ShipmentId))).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var response = new List<SellerOrderResponse>();
        foreach (var item in items)
        {
            if (!orders.TryGetValue(item.OrderId, out var order))
                continue;

            products.TryGetValue(item.ProductId, out var product);
            buyers.TryGetValue(order.BuyerId, out var buyerName);

            response.Add(new SellerOrderResponse
            {
                OrderId = order.Id,
                BuyerName = ExtractFirstName(order.RecipientName.Length > 0 ? order.RecipientName : buyerName),
                ProductName = product?.Name ?? "Unknown Product",
                Quantity = item.Quantity,
                TotalPrice = item.UnitPrice * item.Quantity,
                Status = order.Status.ToString(),
                Date = order.CreatedAt
            });
        }

        return response.OrderByDescending(r => r.Date);
    }

    public async Task UpdateOrderStatusAsync(int sellerId, int orderId, string status)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order with ID {orderId} not found.");

        var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId && s.SellerId == sellerId)).ToList();
        if (!shipments.Any())
            throw new ForbiddenException("You do not have permission to update this order.");

        if (!Enum.TryParse<OrderStatus>(status, true, out var newStatus))
            throw new BadRequestException($"Invalid status: {status}");

        var allShipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();
        if (allShipments.Count <= 1)
        {
            order.Status = newStatus;
        }
        else
        {
            // For multi-vendor orders, derive parent status safely so one seller cannot hijack other sellers' order state
            order.Status = Order.DeriveStatus(allShipments.Select(s => s.Status));
        }

        _uow.Orders.Update(order);
        await _uow.SaveChangesAsync();
    }

    private static OrderResponse MapOrderToResponse(
        Order order,
        List<Shipment> shipments,
        List<OrderItem> items,
        Dictionary<int, Product> products,
        Dictionary<int, string> sellers)
    {
        decimal itemsSubtotal = items.Sum(i => i.UnitPrice * i.Quantity);
        decimal deliveryCost = shipments.Sum(s => s.DeliveryCost);

        var shipmentResponses = shipments.Select(s =>
        {
            var shipmentItems = items
                .Where(i => i.ShipmentId == s.Id || (i.ShipmentId == 0 && products.TryGetValue(i.ProductId, out var p) && p.SellerId == s.SellerId))
                .Select(i => new OrderItemResponse
                {
                    ProductId = i.ProductId,
                    ProductName = products.TryGetValue(i.ProductId, out var prod) ? prod.Name : "Unknown",
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    WeightGrams = products.TryGetValue(i.ProductId, out var prodW) ? prodW.WeightGrams : 500
                })
                .ToList();

            return new BuyerShipmentResponse
            {
                Id = s.Id,
                OrderId = order.Id,
                SellerId = s.SellerId,
                SellerName = sellers.GetValueOrDefault(s.SellerId, "Unknown"),
                Status = s.Status.ToString(),
                TrackingNumber = s.TrackingNumber,
                DeliveryCost = s.DeliveryCost,
                CodAmount = s.CodAmount,
                ReturnReason = s.ReturnReason?.ToString(),
                EtaMinDays = s.EtaMinDays,
                EtaMaxDays = s.EtaMaxDays,
                CreatedAt = s.CreatedAt,
                Items = shipmentItems
            };
        }).ToList();

        var itemResponses = items.Select(i => new OrderItemResponse
        {
            ProductId = i.ProductId,
            ProductName = products.TryGetValue(i.ProductId, out var prod) ? prod.Name : "Unknown",
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            WeightGrams = products.TryGetValue(i.ProductId, out var prodW) ? prodW.WeightGrams : 500
        }).ToList();

        string computedAddressLine = $"{order.Area}، {order.StreetBuilding}".Trim();

        return new OrderResponse
        {
            Id = order.Id,
            ItemsSubtotal = itemsSubtotal,
            DeliveryCost = deliveryCost,
            TotalAmount = order.TotalAmount,
            Status = order.Status.ToString(),
            DeliveryMethod = order.DeliveryMethod.ToString(),
            PickupPointId = order.PickupPointId,
            RecipientName = order.RecipientName,
            RecipientPhone = order.RecipientPhone,
            Governorate = order.Governorate,
            City = order.City,
            Area = order.Area,
            StreetBuilding = order.StreetBuilding,
            AddressLine = computedAddressLine,
            PaymentMethod = order.PaymentMethod.ToString(),
            CreatedAt = order.CreatedAt,
            Shipments = shipmentResponses,
            Items = itemResponses
        };
    }

    private static string ExtractFirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return string.Empty;

        return fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
    }
}
