using Microsoft.EntityFrameworkCore;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<SellerProfile> SellerProfiles => Set<SellerProfile>();
    public DbSet<UserAddress> UserAddresses => Set<UserAddress>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<UserConsent> UserConsents => Set<UserConsent>();
    public DbSet<VendorWallet> VendorWallets => Set<VendorWallet>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<PayoutRequest> PayoutRequests => Set<PayoutRequest>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ReviewReport> ReviewReports => Set<ReviewReport>();
    public DbSet<UserDeviceToken> UserDeviceTokens => Set<UserDeviceToken>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<CouponUsage> CouponUsages => Set<CouponUsage>();
    public DbSet<ReturnRequest> ReturnRequests => Set<ReturnRequest>();
    public DbSet<BuyerWallet> BuyerWallets => Set<BuyerWallet>();
    public DbSet<BuyerWalletTransaction> BuyerWalletTransactions => Set<BuyerWalletTransaction>();
    public DbSet<VerificationCode> VerificationCodes => Set<VerificationCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UploadedFile> UploadedFiles => Set<UploadedFile>();
    public DbSet<ExternalLogin> ExternalLogins => Set<ExternalLogin>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- User ------------------------------------------------
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);

            entity.Property(u => u.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(u => u.Email)
                .IsRequired(false)
                .HasMaxLength(200);

            entity.HasIndex(u => u.Email)
                .IsUnique()
                .HasFilter("\"Email\" IS NOT NULL");

            entity.Property(u => u.Phone)
                .IsRequired(false)
                .HasMaxLength(20);

            entity.HasIndex(u => u.Phone)
                .IsUnique()
                .HasFilter("\"Phone\" IS NOT NULL");

            entity.Property(u => u.EmailVerifiedAt)
                .IsRequired(false);

            entity.Property(u => u.PhoneVerifiedAt)
                .IsRequired(false);

            entity.Property(u => u.TokenVersion)
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(u => u.PasswordHash)
                .IsRequired(false);

            entity.Property(u => u.Role)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(u => u.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            entity.Property(u => u.IsTwoFactorEnabled)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(u => u.TwoFactorSecret)
                .IsRequired(false)
                .HasMaxLength(128);

            entity.Property(u => u.CreatedAt)
                .IsRequired();
        });

        // --- ExternalLogin (Google & External OAuth) --------------
        modelBuilder.Entity<ExternalLogin>(entity =>
        {
            entity.ToTable("ExternalLogins");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Provider)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Subject)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(e => e.CreatedAt)
                .IsRequired();

            entity.HasIndex(e => new { e.Provider, e.Subject })
                .IsUnique();

            entity.HasOne(e => e.User)
                .WithMany(u => u.ExternalLogins)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- VerificationCode ------------------------------------
        modelBuilder.Entity<VerificationCode>(entity =>
        {
            entity.HasKey(vc => vc.Id);

            entity.Property(vc => vc.UserId)
                .IsRequired();

            entity.Property(vc => vc.Channel)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(vc => vc.Target)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(vc => vc.Purpose)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(vc => vc.CodeHash)
                .IsRequired()
                .HasMaxLength(256);

            entity.Property(vc => vc.ExpiresAt)
                .IsRequired();

            entity.Property(vc => vc.AttemptCount)
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(vc => vc.ConsumedAt)
                .IsRequired(false);

            entity.Property(vc => vc.CreatedAt)
                .IsRequired();

            entity.HasIndex(vc => vc.Target);
            entity.HasIndex(vc => vc.UserId);
            entity.HasIndex(vc => vc.ExpiresAt);

            entity.HasOne(vc => vc.User)
                .WithMany(u => u.VerificationCodes)
                .HasForeignKey(vc => vc.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- SellerProfile ---------------------------------------
        modelBuilder.Entity<SellerProfile>(entity =>
        {
            entity.HasKey(sp => sp.Id);

            entity.HasIndex(sp => sp.UserId)
                .IsUnique();

            entity.Property(sp => sp.DispatchCity)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(sp => sp.DispatchAddress)
                .HasMaxLength(300);

            entity.Property(sp => sp.ContactPhone)
                .HasMaxLength(20);

            entity.HasOne(sp => sp.User)
                .WithOne(u => u.SellerProfile)
                .HasForeignKey<SellerProfile>(sp => sp.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- UserAddress -----------------------------------------
        modelBuilder.Entity<UserAddress>(entity =>
        {
            entity.HasKey(ua => ua.Id);

            entity.Property(ua => ua.Label)
                .HasMaxLength(50);

            entity.Property(ua => ua.RecipientName)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(ua => ua.RecipientPhone)
                .IsRequired()
                .HasMaxLength(20);

            entity.Property(ua => ua.Governorate)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(ua => ua.City)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(ua => ua.Area)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(ua => ua.StreetBuilding)
                .IsRequired()
                .HasMaxLength(300);

            entity.Property(ua => ua.BuildingNumber)
                .IsRequired()
                .HasMaxLength(50)
                .HasDefaultValue("");

            entity.Property(ua => ua.Floor)
                .HasMaxLength(50);

            entity.Property(ua => ua.Apartment)
                .HasMaxLength(50);

            entity.Property(ua => ua.Landmark)
                .HasMaxLength(200);

            entity.Property(ua => ua.Latitude)
                .IsRequired()
                .HasDefaultValue(0.0);

            entity.Property(ua => ua.Longitude)
                .IsRequired()
                .HasDefaultValue(0.0);

            entity.Property(ua => ua.FormattedAddress)
                .HasMaxLength(500);

            entity.Property(ua => ua.IsDefault)
                .IsRequired();

            entity.Property(ua => ua.CreatedAt)
                .IsRequired();

            entity.HasOne(ua => ua.User)
                .WithMany(u => u.Addresses)
                .HasForeignKey(ua => ua.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- Category --------------------------------------------
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(c => c.Id);

            entity.Property(c => c.Key)
                .IsRequired()
                .HasMaxLength(50);

            entity.HasIndex(c => c.Key)
                .IsUnique();

            entity.Property(c => c.IconName)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(c => c.NameAr)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(c => c.NameEn)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(c => c.IsActive)
                .HasDefaultValue(true);

            entity.Property(c => c.DisplayOrder)
                .HasDefaultValue(0);

            entity.HasData(
                new Category { Id = 1, Key = "electronics", IconName = "devices", NameAr = "إلكترونيات", NameEn = "Electronics", IsActive = true, DisplayOrder = 1 },
                new Category { Id = 2, Key = "clothing", IconName = "shirt", NameAr = "ملابس وأزياء", NameEn = "Clothing & Fashion", IsActive = true, DisplayOrder = 2 },
                new Category { Id = 3, Key = "shoes", IconName = "shoe-sneaker", NameAr = "أحذية", NameEn = "Shoes", IsActive = true, DisplayOrder = 3 },
                new Category { Id = 4, Key = "home", IconName = "home", NameAr = "المنزل والمطبخ", NameEn = "Home & Kitchen", IsActive = true, DisplayOrder = 4 },
                new Category { Id = 5, Key = "beauty", IconName = "sparkles", NameAr = "الصحة والجمال", NameEn = "Health & Beauty", IsActive = true, DisplayOrder = 5 },
                new Category { Id = 6, Key = "kids", IconName = "baby", NameAr = "مستلزمات أطفال", NameEn = "Kids & Baby", IsActive = true, DisplayOrder = 6 },
                new Category { Id = 7, Key = "sports", IconName = "basketball", NameAr = "أدوات رياضية", NameEn = "Sports & Fitness", IsActive = true, DisplayOrder = 7 },
                new Category { Id = 8, Key = "accessories", IconName = "watch", NameAr = "ساعات وإكسسوارات", NameEn = "Watches & Accessories", IsActive = true, DisplayOrder = 8 },
                new Category { Id = 9, Key = "other", IconName = "dots-horizontal", NameAr = "منتجات أخرى", NameEn = "Other Products", IsActive = true, DisplayOrder = 9 }
            );
        });

        // --- Product ---------------------------------------------
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(p => p.NameAr)
                .HasMaxLength(250);

            entity.Property(p => p.NameEn)
                .HasMaxLength(250);

            entity.Property(p => p.BrandNameAr)
                .HasMaxLength(100);

            entity.Property(p => p.BrandNameEn)
                .HasMaxLength(100);

            entity.Property(p => p.Keywords)
                .HasMaxLength(1000);

            entity.Property(p => p.SearchVector)
                .IsRequired()
                .HasDefaultValue("");

            entity.HasIndex(p => p.SearchVector);

            entity.Property(p => p.Description)
                .HasMaxLength(2000);

            entity.Property(p => p.DescriptionAr)
                .HasMaxLength(4000);

            entity.Property(p => p.DescriptionEn)
                .HasMaxLength(4000);

            entity.Property(p => p.Price)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(p => p.OldPrice)
                .HasColumnType("decimal(18,2)");

            entity.Property(p => p.Stock)
                .IsRequired();

            // Documented default of 500g for existing product rows
            entity.Property(p => p.WeightGrams)
                .IsRequired()
                .HasDefaultValue(500);

            entity.Property(p => p.LengthCm);
            entity.Property(p => p.WidthCm);
            entity.Property(p => p.HeightCm);

            entity.Property(p => p.AverageRating)
                .HasColumnType("decimal(3,2)")
                .HasDefaultValue(0.00m)
                .IsRequired();

            entity.Property(p => p.ReviewsCount)
                .HasDefaultValue(0)
                .IsRequired();

            entity.Property(p => p.IsDeleted)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(p => p.CreatedAt)
                .IsRequired();

            // Store ImageUrls as JSON array in a text column
            entity.Property(p => p.ImageUrls)
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                .HasColumnType("text")
                .Metadata.SetValueComparer(
                    new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                        (c1, c2) => c1!.SequenceEqual(c2!),
                        c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                        c => c.ToList()));

            entity.HasOne(p => p.Seller)
                .WithMany(u => u.Products)
                .HasForeignKey(p => p.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- Order -----------------------------------------------
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(o => o.Id);

            entity.Property(o => o.TotalAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(o => o.DiscountAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(o => o.CouponCode)
                .HasMaxLength(50);

            entity.Property(o => o.WalletAmountUsed)
                .IsRequired()
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(o => o.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(o => o.DeliveryMethod)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(DeliveryMethod.Pickup);

            entity.Property(o => o.PickupPointId)
                .HasMaxLength(100);

            entity.Property(o => o.RecipientName)
                .IsRequired()
                .HasMaxLength(100)
                .HasDefaultValue(string.Empty);

            entity.Property(o => o.RecipientPhone)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue(string.Empty);

            entity.Property(o => o.Governorate)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(o => o.City)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(o => o.Area)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(o => o.StreetBuilding)
                .IsRequired()
                .HasMaxLength(300);

            entity.Property(o => o.PaymentMethod)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(PaymentMethod.OnReceipt);

            entity.Property(o => o.IdempotencyKey)
                .HasMaxLength(128);

            entity.HasIndex(o => new { o.BuyerId, o.IdempotencyKey })
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL AND \"IdempotencyKey\" <> ''");

            entity.Property(o => o.CreatedAt)
                .IsRequired();

            entity.HasOne(o => o.Buyer)
                .WithMany(u => u.Orders)
                .HasForeignKey(o => o.BuyerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- Shipment --------------------------------------------
        modelBuilder.Entity<Shipment>(entity =>
        {
            entity.HasKey(s => s.Id);

            entity.Property(s => s.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(s => s.TrackingNumber)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(s => s.DeliveryCost)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(s => s.CodAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(s => s.ReturnReason)
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(s => s.EtaMinDays)
                .IsRequired();

            entity.Property(s => s.EtaMaxDays)
                .IsRequired();

            entity.Property(s => s.CreatedAt)
                .IsRequired();

            entity.Property(s => s.DeliveredAt);

            entity.Property(s => s.IsCodSettled)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(s => s.CodSettledAt);

            entity.Property(s => s.ReceivedAmount)
                .HasPrecision(18, 2);

            entity.Property(s => s.SettlementReference)
                .HasMaxLength(100);

            entity.Property(s => s.SettledByAdminId);

            entity.Property(s => s.FlaggedForReview)
                .IsRequired()
                .HasDefaultValue(false);

            entity.HasOne(s => s.Order)
                .WithMany(o => o.Shipments)
                .HasForeignKey(s => s.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Seller)
                .WithMany(u => u.Shipments)
                .HasForeignKey(s => s.SellerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.SettledByAdmin)
                .WithMany()
                .HasForeignKey(s => s.SettledByAdminId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // --- OrderItem -------------------------------------------
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(oi => oi.Id);

            entity.Property(oi => oi.Quantity)
                .IsRequired();

            entity.Property(oi => oi.UnitPrice)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(oi => oi.VariantId);

            entity.Property(oi => oi.VariantSummary)
                .HasMaxLength(200);

            entity.HasOne(oi => oi.Order)
                .WithMany(o => o.Items)
                .HasForeignKey(oi => oi.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(oi => oi.Shipment)
                .WithMany(s => s.Items)
                .HasForeignKey(oi => oi.ShipmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(oi => oi.Product)
                .WithMany()
                .HasForeignKey(oi => oi.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(oi => oi.Variant)
                .WithMany()
                .HasForeignKey(oi => oi.VariantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // --- UserConsent (PDPL 151/2020) -------------------------
        modelBuilder.Entity<UserConsent>(entity =>
        {
            entity.HasKey(uc => uc.Id);

            entity.Property(uc => uc.PolicyVersion)
                .IsRequired()
                .HasMaxLength(20);

            entity.Property(uc => uc.AcceptedAt)
                .IsRequired();

            entity.Property(uc => uc.MarketingConsent)
                .IsRequired();

            entity.HasOne(uc => uc.User)
                .WithMany(u => u.Consents)
                .HasForeignKey(uc => uc.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- VendorWallet ----------------------------------------
        modelBuilder.Entity<VendorWallet>(entity =>
        {
            entity.HasKey(w => w.Id);

            entity.HasIndex(w => w.SellerId)
                .IsUnique();

            entity.Property(w => w.Balance)
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(w => w.PendingBalance)
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(w => w.TotalEarned)
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(w => w.UpdatedAt)
                .IsRequired();

            entity.HasOne(w => w.Seller)
                .WithOne(u => u.Wallet)
                .HasForeignKey<VendorWallet>(w => w.SellerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- WalletTransaction -----------------------------------
        modelBuilder.Entity<WalletTransaction>(entity =>
        {
            entity.HasKey(t => t.Id);

            entity.Property(t => t.Amount)
                .HasColumnType("decimal(18,2)")
                .IsRequired();

            entity.Property(t => t.Type)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(t => t.Description)
                .HasMaxLength(250);

            entity.Property(t => t.CreatedAt)
                .IsRequired();

            entity.HasOne(t => t.Wallet)
                .WithMany(w => w.Transactions)
                .HasForeignKey(t => t.WalletId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Order)
                .WithMany()
                .HasForeignKey(t => t.OrderId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.Shipment)
                .WithMany()
                .HasForeignKey(t => t.ShipmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // --- PayoutRequest ---------------------------------------
        modelBuilder.Entity<PayoutRequest>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Amount)
                .HasColumnType("decimal(18,2)")
                .IsRequired();

            entity.Property(p => p.Method)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(p => p.DestinationAccount)
                .IsRequired()
                .HasMaxLength(150);

            entity.Property(p => p.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(p => p.AdminNotes)
                .HasMaxLength(500);

            entity.Property(p => p.CreatedAt)
                .IsRequired();

            entity.HasOne(p => p.Seller)
                .WithMany(u => u.PayoutRequests)
                .HasForeignKey(p => p.SellerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- Review ----------------------------------------------
        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasKey(r => r.Id);

            entity.Property(r => r.Rating)
                .IsRequired();

            entity.Property(r => r.Comment)
                .HasMaxLength(1000);

            entity.Property(r => r.ImageUrls)
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                .HasColumnType("text")
                .HasDefaultValueSql("'[]'")
                .Metadata.SetValueComparer(
                    new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                        (c1, c2) => c1!.SequenceEqual(c2!),
                        c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                        c => c.ToList()));

            entity.Property(r => r.SellerReply)
                .HasMaxLength(500);

            entity.Property(r => r.IsHidden)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(r => r.ModerationNote)
                .HasMaxLength(500);

            entity.Property(r => r.CreatedAt)
                .IsRequired();

            entity.HasOne(r => r.Product)
                .WithMany(p => p.Reviews)
                .HasForeignKey(r => r.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Buyer)
                .WithMany(u => u.Reviews)
                .HasForeignKey(r => r.BuyerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => new { r.ProductId, r.BuyerId })
                .IsUnique();
        });

        // --- ReviewReport ----------------------------------------
        modelBuilder.Entity<ReviewReport>(entity =>
        {
            entity.HasKey(rr => rr.Id);

            entity.Property(rr => rr.Reason)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(rr => rr.Details)
                .HasMaxLength(500);

            entity.Property(rr => rr.CreatedAt)
                .IsRequired();

            entity.HasOne(rr => rr.Review)
                .WithMany(r => r.Reports)
                .HasForeignKey(rr => rr.ReviewId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rr => rr.Reporter)
                .WithMany()
                .HasForeignKey(rr => rr.ReporterId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(rr => new { rr.ReviewId, rr.ReporterId })
                .IsUnique();
        });

        // --- UserDeviceToken -------------------------------------
        modelBuilder.Entity<UserDeviceToken>(entity =>
        {
            entity.HasKey(t => t.Id);

            entity.Property(t => t.DeviceToken)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(t => t.Platform)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(t => t.UpdatedAt)
                .IsRequired();

            entity.HasOne(t => t.User)
                .WithMany(u => u.DeviceTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(t => new { t.UserId, t.DeviceToken })
                .IsUnique();
        });

        // --- ProductVariant --------------------------------------
        modelBuilder.Entity<ProductVariant>(entity =>
        {
            entity.HasKey(pv => pv.Id);

            entity.Property(pv => pv.Sku)
                .HasMaxLength(100);

            entity.Property(pv => pv.Size)
                .HasMaxLength(50);

            entity.Property(pv => pv.Color)
                .HasMaxLength(50);

            entity.Property(pv => pv.AttributeName)
                .HasMaxLength(50);

            entity.Property(pv => pv.AttributeValue)
                .HasMaxLength(100);

            entity.Property(pv => pv.PriceOverride)
                .HasColumnType("decimal(18,2)");

            entity.Property(pv => pv.Stock)
                .IsRequired();

            entity.Property(pv => pv.ImageUrl)
                .HasMaxLength(500);

            entity.HasOne(pv => pv.Product)
                .WithMany(p => p.Variants)
                .HasForeignKey(pv => pv.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(pv => pv.ProductId);
        });

        // --- Coupon ----------------------------------------------
        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.HasKey(c => c.Id);

            entity.Property(c => c.Code)
                .IsRequired()
                .HasMaxLength(50);

            entity.HasIndex(c => c.Code)
                .IsUnique();

            entity.Property(c => c.DiscountType)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(c => c.DiscountValue)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(c => c.MinOrderSubtotal)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(c => c.MaxDiscountAmount)
                .HasColumnType("decimal(18,2)");

            entity.Property(c => c.MaxUsage)
                .IsRequired();

            entity.Property(c => c.UsedCount)
                .IsRequired()
                .HasDefaultValue(0);

            entity.Property(c => c.PerUserLimit)
                .IsRequired()
                .HasDefaultValue(1);

            entity.Property(c => c.ExpiresAt)
                .IsRequired();

            entity.Property(c => c.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            entity.Property(c => c.CreatedAt)
                .IsRequired();

            entity.HasOne(c => c.Seller)
                .WithMany()
                .HasForeignKey(c => c.SellerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- CouponUsage -----------------------------------------
        modelBuilder.Entity<CouponUsage>(entity =>
        {
            entity.HasKey(cu => cu.Id);

            entity.Property(cu => cu.DiscountApplied)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(cu => cu.UsedAt)
                .IsRequired();

            entity.HasOne(cu => cu.Coupon)
                .WithMany(c => c.Usages)
                .HasForeignKey(cu => cu.CouponId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(cu => cu.Buyer)
                .WithMany()
                .HasForeignKey(cu => cu.BuyerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(cu => cu.Order)
                .WithMany()
                .HasForeignKey(cu => cu.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(cu => new { cu.CouponId, cu.BuyerId });
        });

        // --- ReturnRequest ---------------------------------------
        modelBuilder.Entity<ReturnRequest>(entity =>
        {
            entity.HasKey(r => r.Id);

            entity.Property(r => r.Quantity)
                .IsRequired();

            entity.Property(r => r.Reason)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(r => r.DefectImageUrl)
                .HasMaxLength(500);

            entity.Property(r => r.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(r => r.RefundAmount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(r => r.CreatedAt)
                .IsRequired();

            entity.Property(r => r.ResolvedAt);

            entity.HasOne(r => r.Order)
                .WithMany()
                .HasForeignKey(r => r.OrderId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Shipment)
                .WithMany()
                .HasForeignKey(r => r.ShipmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.OrderItem)
                .WithMany()
                .HasForeignKey(r => r.OrderItemId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Buyer)
                .WithMany()
                .HasForeignKey(r => r.BuyerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Seller)
                .WithMany()
                .HasForeignKey(r => r.SellerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- BuyerWallet -----------------------------------------
        modelBuilder.Entity<BuyerWallet>(entity =>
        {
            entity.HasKey(w => w.Id);

            entity.Property(w => w.Balance)
                .IsRequired()
                .HasColumnType("decimal(18,2)")
                .HasDefaultValue(0m);

            entity.Property(w => w.UpdatedAt)
                .IsRequired();

            entity.HasOne(w => w.Buyer)
                .WithOne(u => u.BuyerWallet)
                .HasForeignKey<BuyerWallet>(w => w.BuyerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(w => w.BuyerId)
                .IsUnique();
        });

        // --- BuyerWalletTransaction ------------------------------
        modelBuilder.Entity<BuyerWalletTransaction>(entity =>
        {
            entity.HasKey(t => t.Id);

            entity.Property(t => t.Amount)
                .IsRequired()
                .HasColumnType("decimal(18,2)");

            entity.Property(t => t.Type)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(t => t.Description)
                .IsRequired()
                .HasMaxLength(250);

            entity.Property(t => t.CreatedAt)
                .IsRequired();

            entity.HasOne(t => t.Buyer)
                .WithMany()
                .HasForeignKey(t => t.BuyerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Order)
                .WithMany()
                .HasForeignKey(t => t.OrderId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.ReturnRequest)
                .WithMany()
                .HasForeignKey(t => t.ReturnRequestId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // --- RefreshToken ----------------------------------------
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(r => r.Id);

            entity.Property(r => r.UserId)
                .IsRequired();

            entity.Property(r => r.TokenHash)
                .IsRequired()
                .HasMaxLength(64);

            entity.HasIndex(r => r.TokenHash)
                .IsUnique();

            entity.Property(r => r.DeviceId)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(r => r.DeviceName)
                .IsRequired(false)
                .HasMaxLength(100);

            entity.Property(r => r.CreatedAt)
                .IsRequired();

            entity.Property(r => r.ExpiresAt)
                .IsRequired();

            entity.Property(r => r.LastUsedAt)
                .IsRequired(false);

            entity.Property(r => r.RevokedAt)
                .IsRequired(false);

            entity.Property(r => r.ReplacedByTokenId)
                .IsRequired(false);

            entity.HasIndex(r => r.UserId);
            entity.HasIndex(r => new { r.UserId, r.DeviceId });

            entity.HasOne(r => r.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.ReplacedByToken)
                .WithMany()
                .HasForeignKey(r => r.ReplacedByTokenId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // --- UploadedFile ----------------------------------------
        modelBuilder.Entity<UploadedFile>(entity =>
        {
            entity.HasKey(uf => uf.Id);

            entity.Property(uf => uf.UploaderId)
                .IsRequired();

            entity.Property(uf => uf.FileName)
                .IsRequired()
                .HasMaxLength(100);

            entity.HasIndex(uf => uf.FileName)
                .IsUnique();

            entity.Property(uf => uf.RelativeUrl)
                .IsRequired()
                .HasMaxLength(150);

            entity.HasIndex(uf => uf.RelativeUrl)
                .IsUnique();

            entity.Property(uf => uf.ContentType)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(uf => uf.SizeBytes)
                .IsRequired();

            entity.Property(uf => uf.Width)
                .IsRequired();

            entity.Property(uf => uf.Height)
                .IsRequired();

            entity.Property(uf => uf.CreatedAt)
                .IsRequired();

            entity.HasIndex(uf => uf.UploaderId);

            entity.HasOne(uf => uf.Uploader)
                .WithMany(u => u.UploadedFiles)
                .HasForeignKey(uf => uf.UploaderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- WishlistItem ----------------------------------------
        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.HasKey(w => w.Id);

            entity.HasIndex(w => new { w.UserId, w.ProductId })
                .IsUnique();

            entity.HasOne(w => w.User)
                .WithMany(u => u.WishlistItems)
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(w => w.Product)
                .WithMany(p => p.WishlistItems)
                .HasForeignKey(w => w.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- UserNotification ------------------------------------
        modelBuilder.Entity<UserNotification>(entity =>
        {
            entity.HasKey(n => n.Id);

            entity.Property(n => n.TitleAr)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(n => n.TitleEn)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(n => n.BodyAr)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(n => n.BodyEn)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(n => n.Type)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(n => n.ReferenceId)
                .HasMaxLength(100);

            entity.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });

            entity.HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // --- AdminAuditLog ----------------------------------------
        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);

            entity.Property(a => a.Action)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(a => a.EntityType)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(a => a.EntityId)
                .HasMaxLength(100);

            entity.Property(a => a.Details)
                .HasMaxLength(2000);

            entity.HasIndex(a => new { a.EntityType, a.CreatedAt });

            entity.HasOne(a => a.Admin)
                .WithMany(u => u.AdminAuditLogs)
                .HasForeignKey(a => a.AdminId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
