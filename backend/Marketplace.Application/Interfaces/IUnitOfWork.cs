using Marketplace.Domain.Entities;

namespace Marketplace.Application.Interfaces;

public interface IUnitOfWork : IDisposable
{
    IRepository<User> Users { get; }
    IRepository<SellerProfile> SellerProfiles { get; }
    IRepository<UserAddress> UserAddresses { get; }
    IRepository<Product> Products { get; }
    IRepository<Category> Categories { get; }
    IRepository<Order> Orders { get; }
    IRepository<Shipment> Shipments { get; }
    IRepository<OrderItem> OrderItems { get; }
    IRepository<UserConsent> UserConsents { get; }
    IRepository<VendorWallet> VendorWallets { get; }
    IRepository<WalletTransaction> WalletTransactions { get; }
    IRepository<PayoutRequest> PayoutRequests { get; }
    IRepository<Review> Reviews { get; }
    IRepository<ReviewReport> ReviewReports { get; }
    IRepository<UserDeviceToken> UserDeviceTokens { get; }
    IRepository<ProductVariant> ProductVariants { get; }
    IRepository<Coupon> Coupons { get; }
    IRepository<CouponUsage> CouponUsages { get; }
    IRepository<ReturnRequest> ReturnRequests { get; }
    IRepository<BuyerWallet> BuyerWallets { get; }
    IRepository<BuyerWalletTransaction> BuyerWalletTransactions { get; }
    IRepository<VerificationCode> VerificationCodes { get; }
    IRepository<RefreshToken> RefreshTokens { get; }
    IRepository<UploadedFile> UploadedFiles { get; }
    IRepository<ExternalLogin> ExternalLogins { get; }
    IRepository<WishlistItem> WishlistItems { get; }
    IRepository<UserNotification> UserNotifications { get; }
    IRepository<AdminAuditLog> AdminAuditLogs { get; }

    Task<int> SaveChangesAsync();
    Task BeginTransactionAsync();
    Task CommitTransactionAsync();
    Task RollbackTransactionAsync();
    /// <summary>Discards all tracked entities (used after a rolled-back failed save).</summary>
    void ClearChangeTracker();
    Task<int> ExecuteSqlRawAsync(string sql, params object[] parameters);
    Task RecomputeProductRatingAsync(int productId);
}
