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
                .IsRequired()
                .HasMaxLength(200);

            entity.HasIndex(u => u.Email)
                .IsUnique();

            entity.Property(u => u.PasswordHash)
                .IsRequired();

            entity.Property(u => u.Role)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(u => u.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            entity.Property(u => u.CreatedAt)
                .IsRequired();
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

            entity.HasData(
                new Category { Id = 1, Key = "electronics", IconName = "devices" },
                new Category { Id = 2, Key = "clothing", IconName = "shirt" },
                new Category { Id = 3, Key = "shoes", IconName = "shoe-sneaker" },
                new Category { Id = 4, Key = "home", IconName = "home" },
                new Category { Id = 5, Key = "beauty", IconName = "sparkles" },
                new Category { Id = 6, Key = "kids", IconName = "baby" },
                new Category { Id = 7, Key = "sports", IconName = "basketball" },
                new Category { Id = 8, Key = "accessories", IconName = "watch" },
                new Category { Id = 9, Key = "other", IconName = "dots-horizontal" }
            );
        });

        // --- Product ---------------------------------------------
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(p => p.Description)
                .HasMaxLength(2000);

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

            entity.HasOne(s => s.Order)
                .WithMany(o => o.Shipments)
                .HasForeignKey(s => s.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Seller)
                .WithMany(u => u.Shipments)
                .HasForeignKey(s => s.SellerId)
                .OnDelete(DeleteBehavior.Restrict);
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
    }
}
