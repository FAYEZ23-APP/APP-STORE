using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Marketplace.Application.Common;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class OrderService : IOrderService
{
    private readonly IUnitOfWork _uow;
    private readonly IDeliveryProvider _deliveryProvider;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly IShippingDistanceService? _shippingDistanceService;

    public OrderService(
        IUnitOfWork uow,
        IDeliveryProvider deliveryProvider,
        IConfiguration configuration,
        INotificationService notificationService,
        IShippingDistanceService? shippingDistanceService = null)
    {
        _uow = uow;
        _deliveryProvider = deliveryProvider;
        _configuration = configuration;
        _notificationService = notificationService;
        _shippingDistanceService = shippingDistanceService;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (DateTime Timestamp, int OrderId)> _recentOrderSubmissions = new();

    public async Task<OrderResponse> CreateOrderAsync(int buyerId, CreateOrderRequest request, string? idempotencyKey = null)
    {
        if (request.Items == null || !request.Items.Any())
            throw new BadRequestException("Order must contain at least one item.");

        var effectiveKey = !string.IsNullOrWhiteSpace(idempotencyKey)
            ? idempotencyKey.Trim()
            : (!string.IsNullOrWhiteSpace(request.IdempotencyKey) ? request.IdempotencyKey.Trim() : null);

        if (!string.IsNullOrWhiteSpace(effectiveKey))
        {
            var existingOrder = (await _uow.Orders.FindAsync(o => o.BuyerId == buyerId && o.IdempotencyKey == effectiveKey)).FirstOrDefault();
            if (existingOrder != null)
            {
                return await GetOrderByIdAsync(buyerId, existingOrder.Id);
            }
        }

        string? submissionKey = null;
        // Short-window double-tap duplicate guard per buyer (10 seconds) for requests without explicit Idempotency-Key
        if (string.IsNullOrWhiteSpace(effectiveKey))
        {
            var itemsFingerprint = string.Join(";", request.Items.OrderBy(i => i.ProductId).ThenBy(i => i.VariantId).Select(i => $"{i.ProductId}:{i.VariantId}:{i.Quantity}"));
            submissionKey = $"{buyerId}:{itemsFingerprint}:{request.DeliveryMethod}:{request.PaymentMethod}";
            if (_recentOrderSubmissions.TryGetValue(submissionKey, out var recent) && (DateTime.UtcNow - recent.Timestamp).TotalSeconds < 10)
            {
                try
                {
                    return await GetOrderByIdAsync(buyerId, recent.OrderId);
                }
                catch
                {
                    // Fallback to normal flow if lookup fails
                }
            }
        }

        // Feature gating checks for checkout
        var walletEnabled = _configuration.GetValue<bool?>("Features:EnableWallet")
            ?? _configuration.GetValue<bool?>("Features:WalletEnabled")
            ?? _configuration.GetValue<bool?>("Wallet:Enabled")
            ?? false;
        if (request.UseWalletBalance && !walletEnabled)
        {
            throw new BadRequestException("Wallet feature is currently disabled.");
        }

        var couponsEnabled = _configuration.GetValue<bool?>("Features:EnableCoupons")
            ?? _configuration.GetValue<bool?>("Features:CouponsEnabled")
            ?? _configuration.GetValue<bool?>("Coupons:Enabled")
            ?? false;
        if (!string.IsNullOrWhiteSpace(request.CouponCode) && !couponsEnabled)
        {
            throw new BadRequestException("Coupons feature is currently disabled.");
        }

        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        if (buyer == null || (buyer.Email != null && buyer.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase)))
            throw new UnauthorizedException("الحساب غير موجود أو تم حذفه.");

        var requireVerification = _configuration.GetValue<bool>("Auth:RequireVerification", true);
        if (requireVerification && buyer.EmailVerifiedAt == null && buyer.PhoneVerifiedAt == null)
        {
            throw new ForbiddenException("يجب تأكيد البريد الإلكتروني أو رقم الهاتف لإتمام الطلب (User must have a verified email or phone to place orders).");
        }

        if (!Enum.TryParse<DeliveryMethod>(request.DeliveryMethod, true, out var deliveryMethod))
            throw new BadRequestException("DeliveryMethod must be 'Pickup' or 'Courier'.");

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            throw new BadRequestException("Invalid PaymentMethod.");

        var enableOnlinePayments = _configuration.GetValue<bool>("Features:EnableOnlinePayments");
        if (paymentMethod != PaymentMethod.OnReceipt && !enableOnlinePayments)
        {
            throw new BadRequestException("Online payments are currently disabled. Please select Cash on Delivery (OnReceipt).");
        }

        var normalizedPhone = EgyptianPhoneNormalizer.Normalize(request.RecipientPhone);

        // Refusal threshold check for Cash on Delivery (COD) - check CodBlacklistEntries table, refusal counter, and phone
        if (paymentMethod == PaymentMethod.OnReceipt)
        {
            var buyerPhoneNormalized = !string.IsNullOrWhiteSpace(buyer.Phone)
                ? EgyptianPhoneNormalizer.Normalize(buyer.Phone)
                : null;

            var blacklistEntries = await _uow.CodBlacklistEntries.FindAsync(e =>
                (e.PhoneNormalized == normalizedPhone ||
                 (buyerPhoneNormalized != null && e.PhoneNormalized == buyerPhoneNormalized) ||
                 (e.UserId.HasValue && e.UserId.Value == buyerId)) &&
                e.IsBlocked);

            if (blacklistEntries.Any())
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }

            int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);
            if (buyer.CodRefusalCount >= maxCodRefusals)
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }

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

        UserAddress? selectedAddress = null;
        if (request.AddressId.HasValue && request.AddressId.Value > 0)
        {
            var addr = await _uow.UserAddresses.GetByIdAsync(request.AddressId.Value);
            if (addr != null && addr.UserId == buyerId)
            {
                selectedAddress = addr;
            }
        }
        else
        {
            var defaultAddrs = await _uow.UserAddresses.FindAsync(a => a.UserId == buyerId && a.IsDefault);
            selectedAddress = defaultAddrs.FirstOrDefault();
        }

        string? buildingNumber = !string.IsNullOrWhiteSpace(request.BuildingNumber)
            ? request.BuildingNumber.Trim()
            : selectedAddress?.BuildingNumber?.Trim();

        string? floor = !string.IsNullOrWhiteSpace(request.Floor)
            ? request.Floor.Trim()
            : selectedAddress?.Floor?.Trim();

        string? apartment = !string.IsNullOrWhiteSpace(request.Apartment)
            ? request.Apartment.Trim()
            : selectedAddress?.Apartment?.Trim();

        string? landmark = !string.IsNullOrWhiteSpace(request.Landmark)
            ? request.Landmark.Trim()
            : selectedAddress?.Landmark?.Trim();

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
            var effectiveCity = !string.IsNullOrWhiteSpace(request.City)
                ? request.City.Trim()
                : request.Governorate?.Trim();

            if (string.IsNullOrWhiteSpace(effectiveCity))
                throw new BadRequestException("City or Governorate is required for Courier delivery.");

            if (!await _deliveryProvider.IsValidCityAsync(effectiveCity))
                throw new BadRequestException("Selected City or Governorate is not supported by the delivery provider.");

            destinationCity = effectiveCity;
            destinationGovernorate = string.IsNullOrWhiteSpace(request.Governorate) ? destinationCity : request.Governorate.Trim();
            destinationArea = string.IsNullOrWhiteSpace(request.Area) ? "غير محدد" : request.Area.Trim();
            destinationStreetBuilding = string.IsNullOrWhiteSpace(request.StreetBuilding)
                ? (request.AddressLine?.Trim() ?? string.Empty)
                : request.StreetBuilding.Trim();

            if (string.IsNullOrWhiteSpace(destinationStreetBuilding))
                throw new BadRequestException("StreetBuilding or AddressLine is required for Courier delivery.");

            addressLine = $"{destinationArea}، {destinationStreetBuilding}".Trim();
        }

        double? destLat = request.DeliveryLatitude ?? request.Latitude;
        if ((!destLat.HasValue || destLat.Value == 0) && selectedAddress != null && selectedAddress.Latitude != 0)
        {
            destLat = selectedAddress.Latitude;
        }

        double? destLng = request.DeliveryLongitude ?? request.Longitude;
        if ((!destLng.HasValue || destLng.Value == 0) && selectedAddress != null && selectedAddress.Longitude != 0)
        {
            destLng = selectedAddress.Longitude;
        }
        if ((!destLat.HasValue || !destLng.HasValue || (destLat.Value == 0 && destLng.Value == 0)) && !string.IsNullOrWhiteSpace(destinationCity))
        {
            var destCoords = EgyptianGovernorates.GetCoordinates(destinationCity) ?? EgyptianGovernorates.GetCoordinates(destinationGovernorate);
            if (destCoords.HasValue)
            {
                destLat = destCoords.Value.Latitude;
                destLng = destCoords.Value.Longitude;
            }
        }

        // Group duplicate order items by (ProductId, VariantId)
        var consolidatedItems = request.Items
            .GroupBy(i => (i.ProductId, i.VariantId))
            .Select(g => new { g.Key.ProductId, g.Key.VariantId, Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        var loadedItems = new List<(Product Product, ProductVariant? Variant, int Quantity, decimal UnitPrice, string? VariantSummary)>();

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

                ProductVariant? variant = null;
                decimal unitPrice = product.Price;
                string? variantSummary = null;

                if (reqItem.VariantId.HasValue)
                {
                    variant = await _uow.ProductVariants.GetByIdAsync(reqItem.VariantId.Value);
                    if (variant == null || variant.ProductId != product.Id)
                    {
                        throw new BadRequestException($"المتغير المطلوب غير موجود للمنتج '{product.Name}'.");
                    }

                    unitPrice = variant.PriceOverride ?? product.Price;

                    var parts = new List<string>();
                    if (!string.IsNullOrWhiteSpace(variant.Size)) parts.Add($"المقاس: {variant.Size}");
                    if (!string.IsNullOrWhiteSpace(variant.Color)) parts.Add($"اللون: {variant.Color}");
                    if (!string.IsNullOrWhiteSpace(variant.AttributeName) && !string.IsNullOrWhiteSpace(variant.AttributeValue))
                        parts.Add($"{variant.AttributeName}: {variant.AttributeValue}");
                    variantSummary = parts.Any() ? string.Join(" | ", parts) : null;

                    var affected = await _uow.ExecuteSqlRawAsync(
                        @"UPDATE ""ProductVariants"" SET ""Stock"" = ""Stock"" - {0} WHERE ""Id"" = {1} AND ""ProductId"" = {2} AND ""Stock"" >= {0}",
                        reqItem.Quantity,
                        variant.Id,
                        product.Id);

                    if (affected == 0)
                    {
                        throw new BadRequestException($"المخزون غير كافٍ للمنتج '{product.Name}' (المتغير: {variantSummary ?? variant.Sku ?? "المحدد"}).");
                    }
                }
                else
                {
                    var affected = await _uow.ExecuteSqlRawAsync(
                        @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" - {0} WHERE ""Id"" = {1} AND ""Stock"" >= {0}",
                        reqItem.Quantity,
                        reqItem.ProductId);

                    if (affected == 0)
                    {
                        throw new BadRequestException($"المخزون غير كافٍ للمنتج '{product.Name}'. المتوفر أقل من الكمية المطلوبة.");
                    }
                }

                loadedItems.Add((product, variant, reqItem.Quantity, unitPrice, variantSummary));
            }

            var sellerIds = loadedItems.Select(x => x.Product.SellerId).Distinct().ToList();
            var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);
            var sellerProfiles = (await _uow.SellerProfiles.FindAsync(sp => sellerIds.Contains(sp.UserId)))
                .ToDictionary(sp => sp.UserId);

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
                BuildingNumber = buildingNumber,
                Floor = floor,
                Apartment = apartment,
                Landmark = landmark,
                DeliveryLatitude = destLat,
                DeliveryLongitude = destLng,
                IsBuyerConfirmed = false,
                PaymentMethod = paymentMethod,
                IdempotencyKey = effectiveKey,
                CreatedAt = DateTime.UtcNow,
                Shipments = new List<Shipment>(),
                Items = new List<OrderItem>()
            };

            decimal itemsSubtotal = 0m;
            decimal deliveryTotal = 0m;
            decimal freeShippingThreshold = _configuration.GetValue<decimal>("Orders:FreeShippingThreshold", 1000m);
            decimal overallOrderItemsSubtotal = loadedItems.Sum(x => x.UnitPrice * x.Quantity);

            // Group items by seller -> 1 Shipment per seller
            var sellerGroups = loadedItems.GroupBy(x => x.Product.SellerId);

            foreach (var group in sellerGroups)
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

                int parcelWeightGrams = group.Sum(x => Math.Max(1, x.Product.WeightGrams) * x.Quantity);
                decimal parcelItemsSubtotal = group.Sum(x => x.UnitPrice * x.Quantity);

                var carrierShipment = await _deliveryProvider.CreateShipmentAsync(new CreateCarrierShipmentRequest
                {
                    SellerId = sellerId,
                    FromCity = dispatchCity,
                    ToCity = destinationCity,
                    DeliveryMethod = deliveryMethod,
                    PickupPointId = pickupPointId,
                    TotalWeightGrams = parcelWeightGrams
                });

                decimal deliveryCost = carrierShipment.DeliveryCost;

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
                        // Fall back cleanly to carrier shipment delivery cost
                    }
                }

                if (parcelItemsSubtotal >= freeShippingThreshold || overallOrderItemsSubtotal >= freeShippingThreshold)
                {
                    deliveryCost = 0m;
                }

                decimal shipmentCodAmount = paymentMethod == PaymentMethod.OnReceipt
                    ? parcelItemsSubtotal + deliveryCost
                    : 0m;

                var shipment = new Shipment
                {
                    Order = order,
                    SellerId = sellerId,
                    Status = carrierShipment.Status,
                    TrackingNumber = carrierShipment.TrackingNumber,
                    DeliveryCost = deliveryCost,
                    CodAmount = shipmentCodAmount,
                    EtaMinDays = carrierShipment.EtaMinDays,
                    EtaMaxDays = carrierShipment.EtaMaxDays,
                    BuildingNumber = buildingNumber,
                    Floor = floor,
                    Apartment = apartment,
                    Landmark = landmark,
                    DeliveryLatitude = destLat,
                    DeliveryLongitude = destLng,
                    AllowInspection = group.All(g => g.Product.AllowInspection),
                    CreatedAt = DateTime.UtcNow,
                    Items = new List<OrderItem>()
                };

                foreach (var (product, variant, quantity, unitPrice, variantSummary) in group)
                {
                    var orderItem = new OrderItem
                    {
                        Order = order,
                        Shipment = shipment,
                        ProductId = product.Id,
                        VariantId = variant?.Id,
                        VariantSummary = variantSummary,
                        Quantity = quantity,
                        UnitPrice = unitPrice
                    };

                    itemsSubtotal += orderItem.UnitPrice * orderItem.Quantity;
                    shipment.Items.Add(orderItem);
                    order.Items.Add(orderItem);
                }

                deliveryTotal += shipment.DeliveryCost;
                order.Shipments.Add(shipment);
            }

            // Coupon Processing
            decimal totalDiscount = 0m;
            Coupon? coupon = null;

            if (!string.IsNullOrWhiteSpace(request.CouponCode))
            {
                var code = request.CouponCode.Trim().ToUpperInvariant();
                await _uow.ExecuteSqlRawAsync(@"SELECT 1 FROM ""Coupons"" WHERE ""Code"" = {0} FOR UPDATE", code);
                _uow.ClearChangeTracker();
                coupon = (await _uow.Coupons.FindAsync(c => c.Code == code)).FirstOrDefault();
                if (coupon == null || !coupon.IsActive || coupon.ExpiresAt < DateTime.UtcNow)
                {
                    throw new BadRequestException("كوبون الخصم غير صالح أو منتهي الصلاحية.");
                }

                if (coupon.UsedCount >= coupon.MaxUsage)
                {
                    throw new BadRequestException("تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.");
                }

                var userUsageCount = (await _uow.CouponUsages.FindAsync(u => u.CouponId == coupon.Id && u.BuyerId == buyerId)).Count();
                if (userUsageCount >= coupon.PerUserLimit)
                {
                    throw new BadRequestException("لقد استخدمت هذا الكوبون الحد الأقصى المسموح به.");
                }

                var applicableItems = loadedItems.Where(x => !coupon.SellerId.HasValue || x.Product.SellerId == coupon.SellerId.Value).ToList();
                if (!applicableItems.Any())
                {
                    throw new BadRequestException("كوبون الخصم غير قابل للتطبيق على أي من منتجات هذا الطلب.");
                }

                decimal applicableSubtotal = applicableItems.Sum(x => x.UnitPrice * x.Quantity);
                if (applicableSubtotal < coupon.MinOrderSubtotal)
                {
                    throw new BadRequestException($"الحد الأدنى لتطبيق هذا الكوبون هو {coupon.MinOrderSubtotal} ج.م.");
                }

                // Atomic update to avoid race conditions
                var couponAffected = await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Coupons"" SET ""UsedCount"" = ""UsedCount"" + 1 WHERE ""Id"" = {0} AND ""IsActive"" = TRUE AND ""UsedCount"" < ""MaxUsage""",
                    coupon.Id);

                if (couponAffected == 0)
                {
                    throw new BadRequestException("كوبون الخصم غير صالح أو تم استنفاد الحد الأقصى لاستخدامه.");
                }

                if (coupon.DiscountType == DiscountType.Percentage)
                {
                    totalDiscount = applicableSubtotal * (coupon.DiscountValue / 100m);
                    if (coupon.MaxDiscountAmount.HasValue && totalDiscount > coupon.MaxDiscountAmount.Value)
                    {
                        totalDiscount = coupon.MaxDiscountAmount.Value;
                    }
                }
                else
                {
                    totalDiscount = Math.Min(coupon.DiscountValue, applicableSubtotal);
                }

                totalDiscount = Math.Round(totalDiscount, 2);
                order.DiscountAmount = totalDiscount;
                order.CouponCode = coupon.Code;

                if (totalDiscount > 0)
                {
                    decimal remainingDiscount = totalDiscount;
                    var applicableShipments = order.Shipments
                        .Where(s => !coupon.SellerId.HasValue || s.SellerId == coupon.SellerId.Value)
                        .ToList();

                    decimal totalCod = applicableShipments.Sum(s => s.CodAmount);

                    for (int i = 0; i < applicableShipments.Count; i++)
                    {
                        var s = applicableShipments[i];
                        decimal deduct = (i == applicableShipments.Count - 1 || totalCod == 0)
                            ? remainingDiscount
                            : Math.Round(totalDiscount * (s.CodAmount / totalCod), 2);

                        deduct = Math.Min(deduct, s.CodAmount);
                        s.CodAmount = Math.Max(0m, s.CodAmount - deduct);
                        remainingDiscount -= deduct;
                    }

                    var couponUsage = new CouponUsage
                    {
                        CouponId = coupon.Id,
                        BuyerId = buyerId,
                        Order = order,
                        DiscountApplied = totalDiscount,
                        UsedAt = DateTime.UtcNow
                    };
                    await _uow.CouponUsages.AddAsync(couponUsage);
                }
            }

            // Buyer Wallet Processing
            decimal walletUsed = 0m;
            if (request.UseWalletBalance)
            {
                var wallet = (await _uow.BuyerWallets.FindAsync(w => w.BuyerId == buyerId)).FirstOrDefault();
                if (wallet != null && wallet.Balance > 0)
                {
                    decimal payableCodTotal = order.Shipments.Sum(s => s.CodAmount);
                    walletUsed = Math.Min(wallet.Balance, payableCodTotal);

                    if (walletUsed > 0)
                    {
                        var walletAffected = await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""BuyerWallets"" SET ""Balance"" = ""Balance"" - {0}, ""UpdatedAt"" = {1} WHERE ""BuyerId"" = {2} AND ""Balance"" >= {0}",
                            walletUsed,
                            DateTime.UtcNow,
                            buyerId);

                        if (walletAffected == 0)
                        {
                            throw new BadRequestException("حدث تعارض أثناء خصم رصيد المحفظة أو الرصيد غير كافٍ.");
                        }

                        var walletTx = new BuyerWalletTransaction
                        {
                            BuyerId = buyerId,
                            Order = order,
                            Amount = -walletUsed,
                            Type = BuyerWalletTransactionType.OrderRedemption,
                            Description = $"استخدام الرصيد في الطلب",
                            CreatedAt = DateTime.UtcNow
                        };
                        await _uow.BuyerWalletTransactions.AddAsync(walletTx);

                        order.WalletAmountUsed = walletUsed;

                        decimal remainingWallet = walletUsed;
                        foreach (var s in order.Shipments)
                        {
                            if (remainingWallet <= 0) break;
                            decimal sDeduct = Math.Min(s.CodAmount, remainingWallet);
                            s.CodAmount = Math.Max(0m, s.CodAmount - sDeduct);
                            remainingWallet -= sDeduct;
                        }
                    }
                }
            }

            // Authoritative total
            order.TotalAmount = Math.Max(0m, itemsSubtotal + deliveryTotal - order.DiscountAmount);
            order.Status = Order.DeriveStatus(order.Shipments.Select(s => s.Status));

            await _uow.Orders.AddAsync(order);
            await _uow.SaveChangesAsync();

            await _uow.CommitTransactionAsync();

            if (!string.IsNullOrWhiteSpace(submissionKey))
            {
                _recentOrderSubmissions[submissionKey] = (DateTime.UtcNow, order.Id);
            }
            if (!string.IsNullOrWhiteSpace(effectiveKey))
            {
                _recentOrderSubmissions[$"key:{buyerId}:{effectiveKey}"] = (DateTime.UtcNow, order.Id);
            }

            if (_recentOrderSubmissions.Count > 1000)
            {
                var staleTime = DateTime.UtcNow.AddMinutes(-5);
                foreach (var kvp in _recentOrderSubmissions.Where(k => k.Value.Timestamp < staleTime).Take(200).ToList())
                {
                    _recentOrderSubmissions.TryRemove(kvp.Key, out _);
                }
            }

            await _notificationService.NotifyOrderPlacedAsync(order.Id);

            var productLookup = loadedItems
                .GroupBy(x => x.Product.Id)
                .ToDictionary(g => g.Key, g => g.First().Product);

            return MapOrderToResponse(order, order.Shipments.ToList(), order.Items.ToList(), productLookup, sellers);
        }
        catch (Exception ex) when (!string.IsNullOrEmpty(effectiveKey) && IsOrderIdempotencyUniqueViolation(ex))
        {
            // A concurrent request with the same (BuyerId, IdempotencyKey) committed first.
            // Roll back this duplicate transaction (restores stock/wallet/coupon changes) and
            // return the order that was already created.
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();

            var existing = (await _uow.Orders.FindAsync(o => o.BuyerId == buyerId && o.IdempotencyKey == effectiveKey)).FirstOrDefault();
            if (existing == null)
                throw;

            return await GetOrderByIdAsync(buyerId, existing.Id);
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            throw;
        }
    }

    private static bool IsOrderIdempotencyUniqueViolation(Exception ex)
    {
        for (var e = ex; e != null; e = e.InnerException!)
        {
            if (e.GetType().Name == "PostgresException")
            {
                var t = e.GetType();
                var sqlState = t.GetProperty("SqlState")?.GetValue(e) as string;
                var constraint = t.GetProperty("ConstraintName")?.GetValue(e) as string;
                return sqlState == "23505" && constraint == "IX_Orders_BuyerId_IdempotencyKey";
            }
            if (e.InnerException == null) break;
        }
        return false;
    }

    public async Task<OrderResponse> CancelOrderAsync(int buyerId, int orderId)
    {
        // Concurrency (D-004): all status checks run INSIDE the transaction, after taking a row lock on the
        // order (SELECT ... FOR UPDATE). The seller hand-over path takes the same lock, so a cancel and a
        // hand-to-carrier on the same order are strictly serialized and the loser re-reads the committed state.
        await _uow.BeginTransactionAsync();
        try
        {
            await _uow.ExecuteSqlRawAsync(@"SELECT 1 FROM ""Orders"" WHERE ""Id"" = {0} FOR UPDATE", orderId);
            _uow.ClearChangeTracker();

            var order = await _uow.Orders.GetByIdAsync(orderId);
            if (order == null)
                throw new NotFoundException($"Order with ID {orderId} not found.");

            if (order.BuyerId != buyerId)
                throw new ForbiddenException("You do not have permission to cancel this order.");

            // Idempotent: If already Cancelled, return current state
            if (order.Status == OrderStatus.Cancelled)
            {
                await _uow.RollbackTransactionAsync();
                return await GetOrderByIdAsync(buyerId, orderId);
            }

            if (order.Status == OrderStatus.Shipped || order.Status == OrderStatus.Delivered)
            {
                throw new BadRequestException("لا يمكن إلغاء طلب تم شحنه أو توصيله بالفعل (Cannot cancel an order that has already been shipped or delivered).");
            }

            var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();

            // Check if all shipments are in Created or Cancelled status (before HandedToCarrier)
            bool canCancel = shipments.Count > 0 && shipments.All(s => s.Status == ShipmentStatus.Created || s.Status == ShipmentStatus.Cancelled);
            if (!canCancel)
            {
                throw new BadRequestException("لا يمكن إلغاء الطلب لأن الشحنة تم تسليمها لشركة الشحن أو جاري نقلها بالفعل (Cannot cancel order after shipments are handed to carrier).");
            }
            var items = (await _uow.OrderItems.FindAsync(oi => oi.OrderId == orderId)).ToList();

            // 1. Atomically restore product/variant stock
            foreach (var item in items)
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

            // 2. Refund any BuyerWallet amount used at checkout
            if (order.WalletAmountUsed > 0)
            {
                var buyerWallets = (await _uow.BuyerWallets.FindAsync(w => w.BuyerId == buyerId)).ToList();
                if (!buyerWallets.Any())
                {
                    var newWallet = new BuyerWallet
                    {
                        BuyerId = buyerId,
                        Balance = 0m,
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _uow.BuyerWallets.AddAsync(newWallet);
                    await _uow.SaveChangesAsync();
                }

                await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""BuyerWallets"" SET ""Balance"" = ""Balance"" + {0}, ""UpdatedAt"" = {1} WHERE ""BuyerId"" = {2}",
                    order.WalletAmountUsed,
                    DateTime.UtcNow,
                    buyerId);

                var walletRefundTx = new BuyerWalletTransaction
                {
                    BuyerId = buyerId,
                    OrderId = order.Id,
                    Amount = order.WalletAmountUsed,
                    Type = BuyerWalletTransactionType.RefundCredit,
                    Description = $"استرداد رصيد المحفظة لإلغاء الطلب #{order.Id}",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.BuyerWalletTransactions.AddAsync(walletRefundTx);
            }

            // 3. Revert coupon usage if applied
            if (!string.IsNullOrWhiteSpace(order.CouponCode))
            {
                await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""Coupons"" SET ""UsedCount"" = GREATEST(0, ""UsedCount"" - 1) WHERE ""Code"" = {0}",
                    order.CouponCode.Trim().ToUpperInvariant());
            }

            // 4. Mark shipments as Cancelled
            foreach (var shipment in shipments)
            {
                shipment.Status = ShipmentStatus.Cancelled;
                _uow.Shipments.Update(shipment);
            }

            // 5. Mark order as Cancelled
            order.Status = OrderStatus.Cancelled;
            _uow.Orders.Update(order);

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();

            return await GetOrderByIdAsync(buyerId, orderId);
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
        if (buyer == null || (buyer.Email != null && buyer.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase)))
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

    public async Task<OrderResponse> GetOrderByIdAsync(int userId, int orderId, string? role = null)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order with ID {orderId} not found.");

        var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();
        bool isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        bool isBuyer = order.BuyerId == userId;
        bool isSeller = shipments.Any(s => s.SellerId == userId);

        if (!isBuyer && !isSeller && !isAdmin)
            throw new ForbiddenException("You do not have permission to view this order.");

        var items = (await _uow.OrderItems.FindAsync(i => i.OrderId == orderId)).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        if (!isBuyer && isSeller && !isAdmin)
        {
            shipments = shipments.Where(s => s.SellerId == userId).ToList();
            var sellerProductIds = products.Values.Where(p => p.SellerId == userId).Select(p => p.Id).ToHashSet();
            items = items.Where(i => sellerProductIds.Contains(i.ProductId)).ToList();
        }

        var sellerIds = shipments.Select(s => s.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);

        var mapped = MapOrderToResponse(order, shipments, items, products, sellers);

        if (!isBuyer && isSeller && !isAdmin)
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
                VariantId = item.VariantId,
                VariantSummary = item.VariantSummary,
                Quantity = item.Quantity,
                TotalPrice = item.UnitPrice * item.Quantity,
                Status = order.Status.ToString(),
                Date = order.CreatedAt,
                Governorate = order.Governorate,
                City = order.City,
                BuildingNumber = null,
                Floor = null,
                Apartment = null,
                Landmark = null,
                IsBuyerConfirmed = order.IsBuyerConfirmed,
                ConfirmationChannel = order.ConfirmationChannel
            });
        }

        return response.OrderByDescending(r => r.Date);
    }

    public async Task<SellerOrderDetailResponse> GetSellerOrderDetailsAsync(int sellerId, int orderId)
    {
        var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId && s.SellerId == sellerId)).ToList();
        if (!shipments.Any())
        {
            throw new NotFoundException($"Order with ID {orderId} not found or you do not have permission to view it.");
        }

        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order with ID {orderId} not found.");

        var shipmentIds = shipments.Select(s => s.Id).ToList();
        var items = (await _uow.OrderItems.FindAsync(i => shipmentIds.Contains(i.ShipmentId))).ToList();
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var buyerName = (await _uow.Users.GetByIdAsync(order.BuyerId))?.Name;
        var rawName = order.RecipientName.Length > 0 ? order.RecipientName : buyerName;

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

        return new SellerOrderDetailResponse
        {
            OrderId = order.Id,
            BuyerFirstName = ExtractFirstName(rawName),
            Governorate = order.Governorate,
            City = order.City,
            MaskedPhone = LogMasking.MaskPhone(order.RecipientPhone),
            Status = order.Status.ToString(),
            CreatedAt = order.CreatedAt,
            TotalSellerAmount = items.Sum(i => i.UnitPrice * i.Quantity),
            Items = itemResponses
        };
    }

    public async Task UpdateOrderStatusAsync(int orderId, string status)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException($"Order with ID {orderId} not found.");

        if (!Enum.TryParse<OrderStatus>(status, true, out var newStatus))
            throw new BadRequestException($"Invalid status: {status}");

        order.Status = newStatus;
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
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = products.TryGetValue(i.ProductId, out var prod) ? prod.Name : "Unknown",
                    VariantId = i.VariantId,
                    VariantSummary = i.VariantSummary,
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
                BuildingNumber = s.BuildingNumber,
                Floor = s.Floor,
                Apartment = s.Apartment,
                Landmark = s.Landmark,
                DeliveryLatitude = s.DeliveryLatitude,
                DeliveryLongitude = s.DeliveryLongitude,
                EscrowReleaseAt = s.EscrowReleaseAt,
                AllowInspection = s.AllowInspection,
                CourierName = s.CourierName,
                CourierPhone = s.CourierPhone,
                EstimatedDeliveryAt = s.EstimatedDeliveryAt,
                PickupPointCode = s.PickupPointCode,
                Items = shipmentItems
            };
        }).ToList();

        var itemResponses = items.Select(i => new OrderItemResponse
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductName = products.TryGetValue(i.ProductId, out var prod) ? prod.Name : "Unknown",
            VariantId = i.VariantId,
            VariantSummary = i.VariantSummary,
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
            DiscountAmount = order.DiscountAmount,
            CouponCode = order.CouponCode,
            WalletAmountUsed = order.WalletAmountUsed,
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
            BuildingNumber = order.BuildingNumber,
            Floor = order.Floor,
            Apartment = order.Apartment,
            Landmark = order.Landmark,
            DeliveryLatitude = order.DeliveryLatitude,
            DeliveryLongitude = order.DeliveryLongitude,
            IsBuyerConfirmed = order.IsBuyerConfirmed,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,
            PaymentMethod = order.PaymentMethod.ToString(),
            IdempotencyKey = order.IdempotencyKey,
            CreatedAt = order.CreatedAt,
            Shipments = shipmentResponses,
            Items = itemResponses
        };
    }

    public async Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId, string? channel = null)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException("Order not found.");

        if (!isAdmin && order.BuyerId != userId)
            throw new UnauthorizedAccessException("You are not authorized to confirm this order.");

        if (order.IsBuyerConfirmed)
        {
            return new ConfirmOrderResponse
            {
                OrderId = order.Id,
                IsBuyerConfirmed = true,
                ConfirmedAt = order.ConfirmedAt,
                ConfirmationChannel = order.ConfirmationChannel,
                Message = "Order is already confirmed."
            };
        }

        order.IsBuyerConfirmed = true;
        order.ConfirmedAt = DateTime.UtcNow;
        order.ConfirmationChannel = !string.IsNullOrWhiteSpace(channel) ? channel.Trim() : (isAdmin ? "Admin" : "App");
        _uow.Orders.Update(order);
        await _uow.SaveChangesAsync();

        return new ConfirmOrderResponse
        {
            OrderId = order.Id,
            IsBuyerConfirmed = true,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,
            Message = "Order confirmed successfully."
        };
    }

    private static string ExtractFirstName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            return string.Empty;

        return fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
    }
}
