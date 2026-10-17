using Marketplace.Application.Common;
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
