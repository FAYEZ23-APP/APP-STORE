using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Marketplace.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;
    private int _transactionDepth = 0;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Users = new Repository<User>(context);
        SellerProfiles = new Repository<SellerProfile>(context);
        UserAddresses = new Repository<UserAddress>(context);
        Products = new Repository<Product>(context);
        Categories = new Repository<Category>(context);
        Orders = new Repository<Order>(context);
        Shipments = new Repository<Shipment>(context);
        OrderItems = new Repository<OrderItem>(context);
        UserConsents = new Repository<UserConsent>(context);
        VendorWallets = new Repository<VendorWallet>(context);
        WalletTransactions = new Repository<WalletTransaction>(context);
        PayoutRequests = new Repository<PayoutRequest>(context);
        Reviews = new Repository<Review>(context);
        ReviewReports = new Repository<ReviewReport>(context);
        UserDeviceTokens = new Repository<UserDeviceToken>(context);
        ProductVariants = new Repository<ProductVariant>(context);
        Coupons = new Repository<Coupon>(context);
        CouponUsages = new Repository<CouponUsage>(context);
        ReturnRequests = new Repository<ReturnRequest>(context);
        BuyerWallets = new Repository<BuyerWallet>(context);
        BuyerWalletTransactions = new Repository<BuyerWalletTransaction>(context);
        VerificationCodes = new Repository<VerificationCode>(context);
        RefreshTokens = new Repository<RefreshToken>(context);
        UploadedFiles = new Repository<UploadedFile>(context);
        ExternalLogins = new Repository<ExternalLogin>(context);
        WishlistItems = new Repository<WishlistItem>(context);
        UserNotifications = new Repository<UserNotification>(context);
        AdminAuditLogs = new Repository<AdminAuditLog>(context);
        CodBlacklistEntries = new Repository<CodBlacklistEntry>(context);
        ProcessedWebhookEvents = new Repository<ProcessedWebhookEvent>(context);
        PrivacySubjectRequests = new Repository<PrivacySubjectRequest>(context);
        ProcessorDeletionLogs = new Repository<ProcessorDeletionLog>(context);
        PrivacyIncidentLogs = new Repository<PrivacyIncidentLog>(context);
        ExchangeRequests = new Repository<ExchangeRequest>(context);
        SupportTickets = new Repository<SupportTicket>(context);
        SupportTicketMessages = new Repository<SupportTicketMessage>(context);
        CarrierRemittanceBatches = new Repository<CarrierRemittanceBatch>(context);
        TaxInvoices = new Repository<TaxInvoice>(context);
    }

    public IRepository<User> Users { get; }
    public IRepository<SellerProfile> SellerProfiles { get; }
    public IRepository<UserAddress> UserAddresses { get; }
    public IRepository<Product> Products { get; }
    public IRepository<Category> Categories { get; }
    public IRepository<Order> Orders { get; }
    public IRepository<Shipment> Shipments { get; }
    public IRepository<OrderItem> OrderItems { get; }
    public IRepository<UserConsent> UserConsents { get; }
    public IRepository<VendorWallet> VendorWallets { get; }
    public IRepository<WalletTransaction> WalletTransactions { get; }
    public IRepository<PayoutRequest> PayoutRequests { get; }
    public IRepository<Review> Reviews { get; }
    public IRepository<ReviewReport> ReviewReports { get; }
    public IRepository<UserDeviceToken> UserDeviceTokens { get; }
    public IRepository<ProductVariant> ProductVariants { get; }
    public IRepository<Coupon> Coupons { get; }
    public IRepository<CouponUsage> CouponUsages { get; }
    public IRepository<ReturnRequest> ReturnRequests { get; }
    public IRepository<BuyerWallet> BuyerWallets { get; }
    public IRepository<BuyerWalletTransaction> BuyerWalletTransactions { get; }
    public IRepository<VerificationCode> VerificationCodes { get; }
    public IRepository<RefreshToken> RefreshTokens { get; }
    public IRepository<UploadedFile> UploadedFiles { get; }
    public IRepository<ExternalLogin> ExternalLogins { get; }
    public IRepository<WishlistItem> WishlistItems { get; }
    public IRepository<UserNotification> UserNotifications { get; }
    public IRepository<AdminAuditLog> AdminAuditLogs { get; }
    public IRepository<CodBlacklistEntry> CodBlacklistEntries { get; }
    public IRepository<ProcessedWebhookEvent> ProcessedWebhookEvents { get; }
    public IRepository<PrivacySubjectRequest> PrivacySubjectRequests { get; }
    public IRepository<ProcessorDeletionLog> ProcessorDeletionLogs { get; }
    public IRepository<PrivacyIncidentLog> PrivacyIncidentLogs { get; }
    public IRepository<ExchangeRequest> ExchangeRequests { get; }
    public IRepository<SupportTicket> SupportTickets { get; }
    public IRepository<SupportTicketMessage> SupportTicketMessages { get; }
    public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches { get; }
    public IRepository<TaxInvoice> TaxInvoices { get; }

    public async Task<int> SaveChangesAsync()
        => await _context.SaveChangesAsync();

    public async Task BeginTransactionAsync()
    {
        if (_context.Database.IsRelational())
        {
            if (_transaction == null && _context.Database.CurrentTransaction == null)
            {
                _transaction = await _context.Database.BeginTransactionAsync();
                _transactionDepth = 1;
            }
            else
            {
                _transactionDepth++;
            }
        }
    }

    public async Task CommitTransactionAsync()
    {
        if (_transaction != null)
        {
            _transactionDepth--;
            if (_transactionDepth <= 0)
            {
                await _transaction.CommitAsync();
                await _transaction.DisposeAsync();
                _transaction = null;
                _transactionDepth = 0;
            }
        }
        else if (_transactionDepth > 0)
        {
            _transactionDepth--;
        }
    }

    public async Task RollbackTransactionAsync()
    {
        if (_transaction != null)
        {
            try
            {
                await _transaction.RollbackAsync();
            }
            finally
            {
                await _transaction.DisposeAsync();
                _transaction = null;
                _transactionDepth = 0;
            }
        }
        else
        {
            _transactionDepth = 0;
        }
    }

    public void ClearChangeTracker() => _context.ChangeTracker.Clear();

    public async Task<int> ExecuteSqlRawAsync(string sql, params object[] parameters)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Database.ExecuteSqlRawAsync(sql, parameters);
        }
        return 1;
    }

    public async Task RecomputeProductRatingAsync(int productId)
    {
        if (_context.Database.IsRelational())
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($@"
                SELECT pg_advisory_xact_lock(987654, {productId});
                UPDATE ""Products""
                SET ""ReviewsCount"" = (
                        SELECT COUNT(*)::int
                        FROM ""Reviews""
                        WHERE ""ProductId"" = {productId} AND ""IsHidden"" = FALSE
                    ),
                    ""AverageRating"" = COALESCE((
                        SELECT ROUND(AVG(""Rating""::numeric), 1)
                        FROM ""Reviews""
                        WHERE ""ProductId"" = {productId} AND ""IsHidden"" = FALSE
                    ), 0.0)
                WHERE ""Id"" = {productId};");

            var tracked = _context.ChangeTracker.Entries<Product>()
                .FirstOrDefault(e => e.Entity.Id == productId);
            if (tracked != null)
            {
                await tracked.ReloadAsync();
            }
        }
        else
        {
            var visibleReviews = await _context.Reviews
                .Where(r => r.ProductId == productId && !r.IsHidden)
                .ToListAsync();
            var product = await _context.Products.FindAsync(productId);
            if (product != null)
            {
                product.ReviewsCount = visibleReviews.Count;
                product.AverageRating = visibleReviews.Count > 0
                    ? Math.Round((decimal)visibleReviews.Average(r => r.Rating), 1)
                    : 0m;
                await _context.SaveChangesAsync();
            }
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
