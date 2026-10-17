using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Dashboard;
using Marketplace.Application.DTOs.Users;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class UserService : IUserService
{
    private readonly IUnitOfWork _uow;
    private readonly IPasswordHasher _hasher;
    private readonly IConfiguration _configuration;
    private readonly IGoogleTokenValidator _googleTokenValidator;

    public UserService(
        IUnitOfWork uow,
        IPasswordHasher hasher,
        IConfiguration configuration,
        IGoogleTokenValidator googleTokenValidator)
    {
        _uow = uow;
        _hasher = hasher;
        _configuration = configuration;
        _googleTokenValidator = googleTokenValidator;
    }

    public async Task<UserProfileResponse> GetProfileAsync(int userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null || user.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase))
            throw new NotFoundException($"User with ID {userId} not found.");

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();

        return new UserProfileResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            DispatchCity = sellerProfile?.DispatchCity,
            DispatchAddress = sellerProfile?.DispatchAddress,
            ContactPhone = sellerProfile?.ContactPhone
        };
    }

    public async Task<UserProfileResponse> UpdateProfileAsync(int userId, UpdateProfileRequest request)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User with ID {userId} not found.");

        user.Name = request.Name.Trim();
        _uow.Users.Update(user);

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        if (user.Role == UserRole.Seller &&
            (request.DispatchCity != null || request.DispatchAddress != null || request.ContactPhone != null))
        {
            var normalizedPhone = request.ContactPhone != null
                ? EgyptianPhoneNormalizer.Normalize(request.ContactPhone)
                : null;

            if (sellerProfile == null)
            {
                sellerProfile = new SellerProfile
                {
                    UserId = userId,
                    DispatchCity = request.DispatchCity?.Trim() ?? string.Empty,
                    DispatchAddress = request.DispatchAddress?.Trim(),
                    ContactPhone = normalizedPhone
                };
                await _uow.SellerProfiles.AddAsync(sellerProfile);
            }
            else
            {
                if (request.DispatchCity != null)
                    sellerProfile.DispatchCity = request.DispatchCity.Trim();
                if (request.DispatchAddress != null)
                    sellerProfile.DispatchAddress = request.DispatchAddress.Trim();
                if (normalizedPhone != null)
                    sellerProfile.ContactPhone = normalizedPhone;

                _uow.SellerProfiles.Update(sellerProfile);
            }
        }

        await _uow.SaveChangesAsync();

        return new UserProfileResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            DispatchCity = sellerProfile?.DispatchCity,
            DispatchAddress = sellerProfile?.DispatchAddress,
            ContactPhone = sellerProfile?.ContactPhone
        };
    }

    public async Task<SellerProfileDto> GetSellerProfileAsync(int userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User with ID {userId} not found.");

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        return new SellerProfileDto
        {
            DispatchCity = sellerProfile?.DispatchCity ?? string.Empty,
            DispatchAddress = sellerProfile?.DispatchAddress,
            ContactPhone = sellerProfile?.ContactPhone
        };
    }

    public async Task<SellerProfileDto> UpdateSellerProfileAsync(int userId, SellerProfileDto request)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User with ID {userId} not found.");

        if (user.Role != UserRole.Seller)
            throw new ForbiddenException("Only sellers can have a seller profile.");

        var normalizedPhone = request.ContactPhone != null
            ? EgyptianPhoneNormalizer.Normalize(request.ContactPhone)
            : null;

        var profile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        if (profile == null)
        {
            profile = new SellerProfile
            {
                UserId = userId,
                DispatchCity = request.DispatchCity.Trim(),
                DispatchAddress = request.DispatchAddress?.Trim(),
                ContactPhone = normalizedPhone
            };
            await _uow.SellerProfiles.AddAsync(profile);
        }
        else
        {
            profile.DispatchCity = request.DispatchCity.Trim();
            profile.DispatchAddress = request.DispatchAddress?.Trim();
            profile.ContactPhone = normalizedPhone;
            _uow.SellerProfiles.Update(profile);
        }

        await _uow.SaveChangesAsync();

        return new SellerProfileDto
        {
            DispatchCity = profile.DispatchCity,
            DispatchAddress = profile.DispatchAddress,
            ContactPhone = profile.ContactPhone
        };
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User with ID {userId} not found.");

        if (!_hasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new BadRequestException("Current password is incorrect.");
        }

        user.PasswordHash = _hasher.Hash(request.NewPassword);
        _uow.Users.Update(user);
        await _uow.SaveChangesAsync();
    }

    public async Task<IEnumerable<UserAddressResponse>> GetAddressesAsync(int userId)
    {
        var addresses = await _uow.UserAddresses.FindAsync(a => a.UserId == userId);
        return addresses
            .OrderByDescending(a => a.IsDefault)
            .ThenByDescending(a => a.CreatedAt)
            .Select(MapAddressToResponse);
    }

    public async Task<UserAddressResponse> GetAddressByIdAsync(int userId, int addressId)
    {
        var address = await _uow.UserAddresses.GetByIdAsync(addressId);
        if (address == null)
            throw new NotFoundException("Address not found.");

        if (address.UserId != userId)
            throw new ForbiddenException("You do not have permission to view this address.");

        return MapAddressToResponse(address);
    }

    public async Task<UserAddressResponse> CreateAddressAsync(int userId, CreateUserAddressRequest request)
    {
        var existingAddresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId)).ToList();

        bool shouldBeDefault = request.IsDefault || existingAddresses.Count == 0;
        if (shouldBeDefault)
        {
            foreach (var existing in existingAddresses.Where(a => a.IsDefault))
            {
                existing.IsDefault = false;
                _uow.UserAddresses.Update(existing);
            }
        }

        var normalizedPhone = EgyptianPhoneNormalizer.Normalize(request.RecipientPhone);

        var address = new UserAddress
        {
            UserId = userId,
            Label = request.Label?.Trim(),
            RecipientName = request.RecipientName.Trim(),
            RecipientPhone = normalizedPhone,
            Governorate = request.Governorate.Trim(),
            City = request.City.Trim(),
            Area = request.Area.Trim(),
            StreetBuilding = request.StreetBuilding.Trim(),
            IsDefault = shouldBeDefault,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.UserAddresses.AddAsync(address);
        await _uow.SaveChangesAsync();

        return MapAddressToResponse(address);
    }

    public async Task<UserAddressResponse> UpdateAddressAsync(int userId, int addressId, UpdateUserAddressRequest request)
    {
        var address = await _uow.UserAddresses.GetByIdAsync(addressId);
        if (address == null)
            throw new NotFoundException("Address not found.");

        if (address.UserId != userId)
            throw new ForbiddenException("You do not have permission to modify this address.");

        var otherAddresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId && a.Id != addressId)).ToList();

        if (request.IsDefault)
        {
            foreach (var other in otherAddresses.Where(a => a.IsDefault))
            {
                other.IsDefault = false;
                _uow.UserAddresses.Update(other);
            }
            address.IsDefault = true;
        }
        else if (address.IsDefault && otherAddresses.Count == 0)
        {
            address.IsDefault = true;
        }
        else if (address.IsDefault && !request.IsDefault && otherAddresses.Count > 0)
        {
            address.IsDefault = false;
            var fallback = otherAddresses.OrderByDescending(a => a.CreatedAt).First();
            fallback.IsDefault = true;
            _uow.UserAddresses.Update(fallback);
        }

        var normalizedPhone = EgyptianPhoneNormalizer.Normalize(request.RecipientPhone);

        address.Label = request.Label?.Trim();
        address.RecipientName = request.RecipientName.Trim();
        address.RecipientPhone = normalizedPhone;
        address.Governorate = request.Governorate.Trim();
        address.City = request.City.Trim();
        address.Area = request.Area.Trim();
        address.StreetBuilding = request.StreetBuilding.Trim();

        _uow.UserAddresses.Update(address);
        await _uow.SaveChangesAsync();

        return MapAddressToResponse(address);
    }

    public async Task DeleteAddressAsync(int userId, int addressId)
    {
        var address = await _uow.UserAddresses.GetByIdAsync(addressId);
        if (address == null)
            throw new NotFoundException("Address not found.");

        if (address.UserId != userId)
            throw new ForbiddenException("You do not have permission to delete this address.");

        bool wasDefault = address.IsDefault;
        _uow.UserAddresses.Remove(address);

        if (wasDefault)
        {
            var remaining = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId && a.Id != addressId)).ToList();
            if (remaining.Any())
            {
                var nextDefault = remaining.OrderByDescending(a => a.CreatedAt).First();
                nextDefault.IsDefault = true;
                _uow.UserAddresses.Update(nextDefault);
            }
        }

        await _uow.SaveChangesAsync();
    }

    public async Task<BuyerStatsResponse> GetBuyerStatsAsync(int userId)
    {
        int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);
        var refusedShipments = await _uow.Shipments.FindAsync(s =>
            s.Order.BuyerId == userId &&
            s.Status == ShipmentStatus.Returned &&
            s.ReturnReason == ReturnReason.RefusedByBuyer);

        int count = refusedShipments.Count();
        return new BuyerStatsResponse
        {
            RefusedDeliveriesCount = count,
            IsCodBlocked = count >= maxCodRefusals
        };
    }

    public async Task<UserDataExportDto> ExportUserDataAsync(int userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User with ID {userId} not found.");

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        var addresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId)).ToList();
        var consents = (await _uow.UserConsents.FindAsync(c => c.UserId == userId)).ToList();

        var orders = (await _uow.Orders.FindAsync(o => o.BuyerId == userId)).ToList();
        var orderIds = orders.Select(o => o.Id).ToList();

        var allShipments = (await _uow.Shipments.FindAsync(s => orderIds.Contains(s.OrderId))).ToList();
        var allItems = (await _uow.OrderItems.FindAsync(i => orderIds.Contains(i.OrderId))).ToList();

        var orderExports = orders.Select(o =>
        {
            var shipments = allShipments.Where(s => s.OrderId == o.Id).ToList();
            var shipmentExports = shipments.Select(s =>
            {
                var items = allItems.Where(i => i.ShipmentId == s.Id).Select(i => new OrderItemExportDto
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice
                }).ToList();

                return new ShipmentExportDto
                {
                    Id = s.Id,
                    Status = s.Status.ToString(),
                    TrackingNumber = s.TrackingNumber,
                    DeliveryCost = s.DeliveryCost,
                    CodAmount = s.CodAmount,
                    ReturnReason = s.ReturnReason?.ToString(),
                    CreatedAt = s.CreatedAt,
                    Items = items
                };
            }).ToList();

            return new OrderExportDto
            {
                Id = o.Id,
                TotalAmount = o.TotalAmount,
                Status = o.Status.ToString(),
                DeliveryMethod = o.DeliveryMethod.ToString(),
                PaymentMethod = o.PaymentMethod.ToString(),
                Governorate = o.Governorate,
                City = o.City,
                Area = o.Area,
                StreetBuilding = o.StreetBuilding,
                CreatedAt = o.CreatedAt,
                Shipments = shipmentExports
            };
        }).ToList();

        return new UserDataExportDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            ExportedAt = DateTime.UtcNow,
            SellerProfile = sellerProfile == null ? null : new SellerProfileExportDto
            {
                DispatchCity = sellerProfile.DispatchCity,
                DispatchAddress = sellerProfile.DispatchAddress,
                ContactPhone = sellerProfile.ContactPhone
            },
            Addresses = addresses.Select(a => new UserAddressExportDto
            {
                Id = a.Id,
                Label = a.Label,
                RecipientName = a.RecipientName,
                RecipientPhone = a.RecipientPhone,
                Governorate = a.Governorate,
                City = a.City,
                Area = a.Area,
                StreetBuilding = a.StreetBuilding,
                IsDefault = a.IsDefault,
                CreatedAt = a.CreatedAt
            }).ToList(),
            Consents = consents.Select(c => new UserConsentExportDto
            {
                PolicyVersion = c.PolicyVersion,
                AcceptedAt = c.AcceptedAt,
                MarketingConsent = c.MarketingConsent
            }).ToList(),
            Orders = orderExports
        };
    }

    public async Task DeleteAccountAsync(int userId, string? currentPassword = null, string? googleIdToken = null)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null || user.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase))
            throw new NotFoundException($"User with ID {userId} not found.");

        if (!string.IsNullOrWhiteSpace(googleIdToken))
        {
            var googleUser = await _googleTokenValidator.ValidateTokenAsync(googleIdToken);
            if (!string.Equals(googleUser.Email, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("Google account email does not match user account.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(currentPassword))
        {
            if (!_hasher.Verify(currentPassword, user.PasswordHash))
            {
                throw new BadRequestException("كلمة المرور الحالية غير صحيحة.");
            }
        }
        else
        {
            throw new BadRequestException("Either CurrentPassword or GoogleIdToken is required to delete account.");
        }

        // Check active buyer shipments & orders
        var buyerOrders = (await _uow.Orders.FindAsync(o => o.BuyerId == userId)).ToList();
        var buyerOrderIds = buyerOrders.Select(o => o.Id).ToList();
        if (buyerOrderIds.Any())
        {
            var buyerShipments = await _uow.Shipments.FindAsync(s => buyerOrderIds.Contains(s.OrderId));
            bool hasActiveBuyerShipments = buyerShipments.Any(s =>
                s.Status != ShipmentStatus.Delivered &&
                s.Status != ShipmentStatus.Cancelled &&
                s.Status != ShipmentStatus.Returned);

            bool hasActiveBuyerOrders = buyerOrders.Any(o =>
                o.Status != OrderStatus.Delivered &&
                o.Status != OrderStatus.Cancelled);

            if (hasActiveBuyerShipments || hasActiveBuyerOrders)
            {
                throw new ConflictException("لا يمكن حذف الحساب نظراً لوجود شحنات قيد التنفيذ لم تكتمل بعد. يُرجى الانتظار حتى اكتمال التوصيل أو إلغاء الطلبات.");
            }
        }

        // Check active shipments as seller
        if (user.Role == UserRole.Seller)
        {
            var sellerShipments = await _uow.Shipments.FindAsync(s => s.SellerId == userId);
            bool hasActiveSellerShipments = sellerShipments.Any(s =>
                s.Status != ShipmentStatus.Delivered &&
                s.Status != ShipmentStatus.Cancelled &&
                s.Status != ShipmentStatus.Returned);

            if (hasActiveSellerShipments)
            {
                throw new ConflictException("لا يمكن حذف حساب التاجر نظراً لوجود شحنات قيد التوصيل لم تكتمل بعد.");
            }
        }

        // Anonymization: overwrite PII with unique placeholders, revoke login credentials, keep order/shipment audit history
        var anonId = Guid.NewGuid().ToString("N")[..8];
        user.Name = $"Deleted User {userId}-{anonId}";
        user.Email = $"deleted_{userId}_{anonId}@marketplace.local";
        user.PasswordHash = _hasher.Hash(Guid.NewGuid().ToString("N")); // Completely invalidates login
        _uow.Users.Update(user);

        // Anonymize user addresses
        var addresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId)).ToList();
        foreach (var addr in addresses)
        {
            addr.RecipientName = "مستخدم محذوف";
            addr.RecipientPhone = "+200000000000";
            addr.StreetBuilding = "تم حذف البيانات الشخصية";
            _uow.UserAddresses.Update(addr);
        }

        // Anonymize seller profile if exists
        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        if (sellerProfile != null)
        {
            sellerProfile.ContactPhone = "+200000000000";
            sellerProfile.DispatchAddress = "تم حذف البيانات الشخصية";
            _uow.SellerProfiles.Update(sellerProfile);
        }

        await _uow.SaveChangesAsync();
    }

    public async Task<SellerDashboardResponse> GetSellerDashboardAsync(int sellerId)
    {
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller == null || seller.Role != UserRole.Seller)
            throw new NotFoundException("Seller not found.");

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == sellerId)).FirstOrDefault();

        // 1. Fetch all shipments belonging to this seller
        var allSellerShipments = (await _uow.Shipments.FindAsync(s => s.SellerId == sellerId)).ToList();
        var shipmentIds = allSellerShipments.Select(s => s.Id).ToList();

        var allItems = shipmentIds.Count > 0
            ? (await _uow.OrderItems.FindAsync(i => shipmentIds.Contains(i.ShipmentId))).ToList()
            : new List<OrderItem>();
        var itemsByShipment = allItems.GroupBy(i => i.ShipmentId).ToDictionary(g => g.Key, g => g.ToList());

        // 2. Financial KPIs
        var deliveredShipments = allSellerShipments.Where(s => s.Status == ShipmentStatus.Delivered).ToList();
        var today = DateTime.UtcNow.Date;

        var wallet = (await _uow.VendorWallets.FindAsync(w => w.SellerId == sellerId)).FirstOrDefault();
        decimal todayRevenue = 0m;
        decimal monthRevenue = 0m;

        if (wallet != null)
        {
            var deliveredTxs = (await _uow.WalletTransactions.FindAsync(t =>
                t.WalletId == wallet.Id &&
                t.Type == WalletTransactionType.COD_Collection)).ToList();

            todayRevenue = deliveredTxs
                .Where(t => t.CreatedAt.Date == today)
                .Sum(t => t.Amount);

            monthRevenue = deliveredTxs
                .Where(t => t.CreatedAt.Year == today.Year && t.CreatedAt.Month == today.Month)
                .Sum(t => t.Amount);
        }

        if (todayRevenue == 0m)
        {
            todayRevenue = deliveredShipments
                .Where(s => s.CreatedAt.Date == today)
                .Sum(s => itemsByShipment.TryGetValue(s.Id, out var items) ? items.Sum(i => i.UnitPrice * i.Quantity) : 0m);
        }

        if (monthRevenue == 0m)
        {
            monthRevenue = deliveredShipments
                .Where(s => s.CreatedAt.Year == today.Year && s.CreatedAt.Month == today.Month)
                .Sum(s => itemsByShipment.TryGetValue(s.Id, out var items) ? items.Sum(i => i.UnitPrice * i.Quantity) : 0m);
        }

        var activeClearanceStatuses = new[]
        {
            ShipmentStatus.Created,
            ShipmentStatus.HandedToCarrier,
            ShipmentStatus.InTransit,
            ShipmentStatus.ReadyForPickup
        };

        decimal pendingClearanceAmount = allSellerShipments
            .Where(s => activeClearanceStatuses.Contains(s.Status))
            .Sum(s => s.CodAmount);

        int deliveredCount = deliveredShipments.Count;
        int returnedCount = allSellerShipments.Count(s => s.Status == ShipmentStatus.Returned);
        int finishedCount = deliveredCount + returnedCount;
        decimal successRate = finishedCount > 0
            ? Math.Round((decimal)deliveredCount / finishedCount * 100m, 1)
            : 100.0m;

        // 3. Action-Required Counters
        int pendingHandoverCount = allSellerShipments.Count(s => s.Status == ShipmentStatus.Created);

        var sellerProducts = (await _uow.Products.FindAsync(p => p.SellerId == sellerId)).ToList();
        int lowStockProductsCount = sellerProducts.Count(p => p.Stock > 0 && p.Stock <= 5);
        int outOfStockProductsCount = sellerProducts.Count(p => p.Stock == 0);

        // 4. Inventory & Top Products Insights
        var validShipmentIds = allSellerShipments
            .Where(s => s.Status != ShipmentStatus.Cancelled && s.Status != ShipmentStatus.Returned)
            .Select(s => s.Id)
            .ToHashSet();

        var productSales = allItems
            .Where(i => validShipmentIds.Contains(i.ShipmentId))
            .GroupBy(i => i.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                UnitsSold = g.Sum(x => x.Quantity),
                Revenue = g.Sum(x => x.Quantity * x.UnitPrice)
            })
            .OrderByDescending(x => x.UnitsSold)
            .Take(5)
            .ToList();

        var productMap = sellerProducts.ToDictionary(p => p.Id);
        var topSellingProducts = productSales.Select(ps =>
        {
            productMap.TryGetValue(ps.ProductId, out var p);
            return new TopProductInsightDto
            {
                ProductId = ps.ProductId,
                Name = p?.Name ?? "منتج",
                ImageUrl = p?.ImageUrls?.FirstOrDefault(),
                UnitsSold = ps.UnitsSold,
                Revenue = ps.Revenue,
                CurrentStock = p?.Stock ?? 0,
                Price = p?.Price ?? 0m
            };
        }).ToList();

        var lowStockAlerts = sellerProducts
            .Where(p => p.Stock <= 5)
            .OrderBy(p => p.Stock)
            .Take(5)
            .Select(p => new LowStockAlertDto
            {
                ProductId = p.Id,
                Name = p.Name,
                ImageUrl = p.ImageUrls?.FirstOrDefault(),
                CurrentStock = p.Stock,
                Price = p.Price
            })
            .ToList();

        // 5. Recent Shipments Feed
        var recentShipments = allSellerShipments
            .OrderByDescending(s => s.CreatedAt)
            .Take(5)
            .ToList();

        var recentOrderIds = recentShipments.Select(s => s.OrderId).Distinct().ToList();
        var recentOrders = recentOrderIds.Count > 0
            ? (await _uow.Orders.FindAsync(o => recentOrderIds.Contains(o.Id))).ToDictionary(o => o.Id)
            : new Dictionary<int, Order>();

        var recentShipmentsFeed = recentShipments.Select(s =>
        {
            recentOrders.TryGetValue(s.OrderId, out var ord);
            itemsByShipment.TryGetValue(s.Id, out var shipItems);
            return new RecentShipmentFeedDto
            {
                ShipmentId = s.Id,
                OrderId = s.OrderId,
                TrackingNumber = s.TrackingNumber,
                Status = s.Status.ToString(),
                DeliveryMethod = ord?.DeliveryMethod.ToString() ?? "Pickup",
                CodAmount = s.CodAmount,
                RecipientCity = ord?.City ?? string.Empty,
                ItemsCount = shipItems?.Sum(i => i.Quantity) ?? 0,
                CreatedAt = s.CreatedAt
            };
        }).ToList();

        return new SellerDashboardResponse
        {
            SellerId = seller.Id,
            StoreName = seller.Name,
            DispatchCity = sellerProfile?.DispatchCity ?? string.Empty,
            TodayRevenue = todayRevenue,
            MonthRevenue = monthRevenue,
            PendingClearanceAmount = pendingClearanceAmount,
            DeliveredOrdersCount = deliveredCount,
            ReturnedShipmentsCount = returnedCount,
            DeliverySuccessRate = successRate,
            PendingHandoverCount = pendingHandoverCount,
            LowStockProductsCount = lowStockProductsCount,
            OutOfStockProductsCount = outOfStockProductsCount,
            TopSellingProducts = topSellingProducts,
            LowStockAlerts = lowStockAlerts,
            RecentShipments = recentShipmentsFeed
        };
    }

    public async Task<BuyerDashboardResponse> GetBuyerDashboardAsync(int buyerId)
    {
        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        if (buyer == null)
            throw new NotFoundException("Buyer not found.");

        var buyerOrders = (await _uow.Orders.FindAsync(o => o.BuyerId == buyerId)).ToList();
        var buyerOrderIds = buyerOrders.Select(o => o.Id).ToList();

        var buyerShipments = buyerOrderIds.Count > 0
            ? (await _uow.Shipments.FindAsync(s => buyerOrderIds.Contains(s.OrderId))).ToList()
            : new List<Shipment>();

        // Shein/Noon Style Order Status Counters
        int processingCount = buyerShipments.Count(s => s.Status == ShipmentStatus.Created || s.Status == ShipmentStatus.HandedToCarrier);
        int inTransitCount = buyerShipments.Count(s => s.Status == ShipmentStatus.InTransit);
        int readyForPickupCount = buyerShipments.Count(s => s.Status == ShipmentStatus.ReadyForPickup);
        int deliveredCount = buyerShipments.Count(s => s.Status == ShipmentStatus.Delivered);
        int returnedCount = buyerShipments.Count(s => s.Status == ShipmentStatus.Returned);

        // Active Shipment Live Tracker (Most recent active shipment if any)
        var activeShipment = buyerShipments
            .Where(s => s.Status == ShipmentStatus.Created ||
                        s.Status == ShipmentStatus.HandedToCarrier ||
                        s.Status == ShipmentStatus.InTransit ||
                        s.Status == ShipmentStatus.ReadyForPickup)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefault();

        ActiveShipmentTrackerDto? activeTracker = null;
        if (activeShipment != null)
        {
            var parentOrder = buyerOrders.FirstOrDefault(o => o.Id == activeShipment.OrderId);
            var shipItems = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == activeShipment.Id)).ToList();
            var prodIds = shipItems.Select(i => i.ProductId).Distinct().ToList();
            var products = prodIds.Count > 0
                ? (await _uow.Products.FindAsync(p => prodIds.Contains(p.Id))).ToDictionary(p => p.Id)
                : new Dictionary<int, Product>();

            int step = activeShipment.Status switch
            {
                ShipmentStatus.Created => 1,
                ShipmentStatus.HandedToCarrier => 2,
                ShipmentStatus.InTransit => 3,
                ShipmentStatus.ReadyForPickup => 4,
                ShipmentStatus.Delivered => 5,
                _ => 1
            };

            activeTracker = new ActiveShipmentTrackerDto
            {
                ShipmentId = activeShipment.Id,
                OrderId = activeShipment.OrderId,
                Status = activeShipment.Status.ToString(),
                CurrentStep = step,
                EtaMinDays = activeShipment.EtaMinDays,
                EtaMaxDays = activeShipment.EtaMaxDays,
                CarrierName = "Bosta Express",
                TrackingNumber = activeShipment.TrackingNumber,
                CodAmount = activeShipment.CodAmount,
                DeliveryMethod = parentOrder?.DeliveryMethod.ToString() ?? "Pickup",
                RecipientCity = parentOrder?.City ?? string.Empty,
                CreatedAt = activeShipment.CreatedAt,
                Items = shipItems.Select(i => new ActiveShipmentItemDto
                {
                    ProductId = i.ProductId,
                    ProductName = products.TryGetValue(i.ProductId, out var p) ? p.Name : "منتج",
                    ImageUrl = products.TryGetValue(i.ProductId, out var pi) ? pi.ImageUrls?.FirstOrDefault() : null,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice
                }).ToList()
            };
        }

        // Spending & Account Summary
        decimal totalSpent = buyerShipments
            .Where(s => s.Status == ShipmentStatus.Delivered)
            .Sum(s => s.CodAmount);

        if (totalSpent == 0m)
        {
            totalSpent = buyerOrders
                .Where(o => o.Status == OrderStatus.Delivered)
                .Sum(o => o.TotalAmount);
        }

        int savedAddressesCount = (await _uow.UserAddresses.FindAsync(a => a.UserId == buyerId)).Count();

        int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);
        int refusedCount = buyerShipments.Count(s => s.Status == ShipmentStatus.Returned && s.ReturnReason == ReturnReason.RefusedByBuyer);
        bool isBlocked = refusedCount >= maxCodRefusals;
        int remaining = Math.Max(0, maxCodRefusals - refusedCount);
        string statusMsg = isBlocked
            ? "تم إيقاف الدفع عند الاستلام لتكرار رفض الشحنات. يرجى التواصل مع الدعم."
            : remaining == maxCodRefusals
                ? "الدفع عند الاستلام مفعل ومتاح لحسابك بالكامل."
                : $"الدفع عند الاستلام متاح (متبقي {remaining} مرات سماح لرفض الشحنات).";

        return new BuyerDashboardResponse
        {
            BuyerId = buyer.Id,
            BuyerName = buyer.Name,
            Email = buyer.Email,
            ProcessingCount = processingCount,
            InTransitCount = inTransitCount,
            ReadyForPickupCount = readyForPickupCount,
            DeliveredCount = deliveredCount,
            ReturnedCount = returnedCount,
            ActiveShipment = activeTracker,
            TotalSpent = totalSpent,
            TotalOrdersPlaced = buyerOrders.Count,
            SavedAddressesCount = savedAddressesCount,
            CodEligibilityStatus = new BuyerCodEligibilityDto
            {
                IsCodBlocked = isBlocked,
                RefusedDeliveriesCount = refusedCount,
                MaxRefusalTolerance = maxCodRefusals,
                RemainingTolerance = remaining,
                StatusMessage = statusMsg
            }
        };
    }

    private static UserAddressResponse MapAddressToResponse(UserAddress address)
    {
        return new UserAddressResponse
        {
            Id = address.Id,
            Label = address.Label,
            RecipientName = address.RecipientName,
            RecipientPhone = address.RecipientPhone,
            Governorate = address.Governorate,
            City = address.City,
            Area = address.Area,
            StreetBuilding = address.StreetBuilding,
            AddressLine = $"{address.Area}، {address.StreetBuilding}".Trim(),
            IsDefault = address.IsDefault,
            CreatedAt = address.CreatedAt
        };
    }
}
