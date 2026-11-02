using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }
    public DateTime? PhoneVerifiedAt { get; set; }
    public int TokenVersion { get; set; } = 0;
    public string? PasswordHash { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public int CodRefusalCount { get; set; } = 0;
    public bool IsTwoFactorEnabled { get; set; } = false;
    public string? TwoFactorSecret { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SellerProfile? SellerProfile { get; set; }
    public VendorWallet? Wallet { get; set; }
    public ICollection<UserAddress> Addresses { get; set; } = new List<UserAddress>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<Shipment> Shipments { get; set; } = new List<Shipment>();
    public ICollection<UserConsent> Consents { get; set; } = new List<UserConsent>();
    public ICollection<PayoutRequest> PayoutRequests { get; set; } = new List<PayoutRequest>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<UserDeviceToken> DeviceTokens { get; set; } = new List<UserDeviceToken>();
    public BuyerWallet? BuyerWallet { get; set; }
    public ICollection<VerificationCode> VerificationCodes { get; set; } = new List<VerificationCode>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<UploadedFile> UploadedFiles { get; set; } = new List<UploadedFile>();
    public ICollection<ExternalLogin> ExternalLogins { get; set; } = new List<ExternalLogin>();
    public ICollection<WishlistItem> WishlistItems { get; set; } = new List<WishlistItem>();
    public ICollection<UserNotification> Notifications { get; set; } = new List<UserNotification>();
    public ICollection<AdminAuditLog> AdminAuditLogs { get; set; } = new List<AdminAuditLog>();
}
