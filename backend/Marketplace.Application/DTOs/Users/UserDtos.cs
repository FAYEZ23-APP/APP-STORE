namespace Marketplace.Application.DTOs.Users;

public class UserProfileResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? DispatchCity { get; set; }
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }
}

public class UpdateProfileRequest
{
    public string Name { get; set; } = string.Empty;
    public string? DispatchCity { get; set; }
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }
}

public class SellerProfileDto
{
    public string DispatchCity { get; set; } = string.Empty;
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class DeleteAccountRequest
{
    public string? CurrentPassword { get; set; }
    public string? GoogleIdToken { get; set; }
}

public class BuyerStatsResponse
{
    public int RefusedDeliveriesCount { get; set; }
    public bool IsCodBlocked { get; set; }
}

public class UserAddressResponse
{
    public int Id { get; set; }
    public string? Label { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string BuildingNumber { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? FormattedAddress { get; set; }
    public string GoogleMapsLink => $"https://www.google.com/maps?q={Latitude},{Longitude}";
    public string AddressLine { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateUserAddressRequest
{
    public string? Label { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string BuildingNumber { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? FormattedAddress { get; set; }
    public string? AddressLine { get; set; }
    public bool IsDefault { get; set; }
}

public class UpdateUserAddressRequest
{
    public string? Label { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string BuildingNumber { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? FormattedAddress { get; set; }
    public string? AddressLine { get; set; }
    public bool IsDefault { get; set; }
}

// ─── PDPL 151/2020 Data Portability Export DTOs ──────────────────
public class UserDataExportDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTime ExportedAt { get; set; } = DateTime.UtcNow;
    public SellerProfileExportDto? SellerProfile { get; set; }
    public List<UserAddressExportDto> Addresses { get; set; } = new();
    public List<UserConsentExportDto> Consents { get; set; } = new();
    public List<ReviewExportDto> Reviews { get; set; } = new();
    public List<DeviceSessionExportDto> DeviceSessions { get; set; } = new();
    public List<WishlistExportDto> WishlistItems { get; set; } = new();
    public List<NotificationExportDto> Notifications { get; set; } = new();
    public List<DeviceTokenExportDto> DeviceTokens { get; set; } = new();
    public List<OrderExportDto> Orders { get; set; } = new();
}

public class WishlistExportDto
{
    public int ProductId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationExportDto
{
    public int Id { get; set; }
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string BodyAr { get; set; } = string.Empty;
    public string BodyEn { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DeviceTokenExportDto
{
    public string Platform { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public string MaskedToken { get; set; } = string.Empty;
}

public class ReviewExportDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class DeviceSessionExportDto
{
    public int Id { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public bool IsActive { get; set; }
}

public class SellerProfileExportDto
{
    public string DispatchCity { get; set; } = string.Empty;
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }
}

public class UserAddressExportDto
{
    public int Id { get; set; }
    public string? Label { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserConsentExportDto
{
    public string PolicyVersion { get; set; } = string.Empty;
    public DateTime AcceptedAt { get; set; }
    public bool MarketingConsent { get; set; }
}

public class OrderExportDto
{
    public int Id { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<ShipmentExportDto> Shipments { get; set; } = new();
}

public class ShipmentExportDto
{
    public int Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public decimal CodAmount { get; set; }
    public string? ReturnReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemExportDto> Items { get; set; } = new();
}

public class OrderItemExportDto
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
