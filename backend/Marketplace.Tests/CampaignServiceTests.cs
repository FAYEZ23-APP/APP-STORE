using Marketplace.Application.DTOs.Campaigns;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Services;
using Marketplace.Domain.Entities;
using Xunit;

namespace Marketplace.Tests;

public class CampaignServiceTests
{
    private readonly FakeUnitOfWorkForCampaigns _uow;
    private readonly CampaignService _service;

    public CampaignServiceTests()
    {
        _uow = new FakeUnitOfWorkForCampaigns();
        _service = new CampaignService(_uow);
    }

    [Fact]
    public async Task GetActiveCampaignsAsync_ReturnsOnlyActiveWithinDateRange_OrderedByPriority()
    {
        var now = DateTime.UtcNow;
        _uow.CampaignsRepo.List.AddRange(new[]
        {
            new Campaign
            {
                Id = 1,
                TitleAr = "حملة 1",
                TitleEn = "Campaign 1",
                ImageUrlMobile = "https://example.com/1.jpg",
                Priority = 3,
                IsActive = true
            },
            new Campaign
            {
                Id = 2,
                TitleAr = "حملة معطلة",
                TitleEn = "Inactive Campaign",
                ImageUrlMobile = "https://example.com/2.jpg",
                Priority = 1,
                IsActive = false
            },
            new Campaign
            {
                Id = 3,
                TitleAr = "حملة 3",
                TitleEn = "Campaign 3",
                ImageUrlMobile = "https://example.com/3.jpg",
                Priority = 2,
                IsActive = true,
                StartDate = now.AddDays(-5),
                EndDate = now.AddDays(5)
            },
            new Campaign
            {
                Id = 4,
                TitleAr = "حملة منتهية",
                TitleEn = "Expired Campaign",
                ImageUrlMobile = "https://example.com/4.jpg",
                Priority = 0,
                IsActive = true,
                EndDate = now.AddDays(-1)
            }
        });

        var result = (await _service.GetActiveCampaignsAsync()).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(3, result[0].Id); // Priority 2 comes before Priority 3
        Assert.Equal(1, result[1].Id); // Priority 3
    }

    [Fact]
    public async Task GetAllCampaignsAsync_ReturnsAllCampaignsIncludingInactive()
    {
        _uow.CampaignsRepo.List.AddRange(new[]
        {
            new Campaign { Id = 1, TitleAr = "حملة 1", TitleEn = "C1", ImageUrlMobile = "img1.jpg", IsActive = true, Priority = 2 },
            new Campaign { Id = 2, TitleAr = "حملة 2", TitleEn = "C2", ImageUrlMobile = "img2.jpg", IsActive = false, Priority = 1 }
        });

        var result = (await _service.GetAllCampaignsAsync()).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(2, result[0].Id); // Priority 1 first
        Assert.Equal(1, result[1].Id); // Priority 2 second
    }

    [Fact]
    public async Task GetCampaignByIdAsync_WhenNotFound_ThrowsNotFoundException()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => _service.GetCampaignByIdAsync(999));
    }

    [Fact]
    public async Task CreateCampaignAsync_WithValidData_CreatesAndClampsOpacity()
    {
        var request = new CreateCampaignRequest
        {
            TitleAr = "مجموعة الصيف",
            TitleEn = "Summer Edit",
            SubtitleAr = "أحدث الموديلات",
            SubtitleEn = "Latest styles",
            CtaAr = "تسوق الآن",
            CtaEn = "Shop Now",
            BadgeAr = "جديد",
            BadgeEn = "NEW",
            ImageUrlMobile = "https://example.com/summer-mobile.jpg",
            ImageUrlDesktop = "https://example.com/summer-desktop.jpg",
            TargetUrl = "category:clothing",
            Priority = 1,
            IsActive = true,
            TextAlignment = "CENTER",
            OverlayOpacity = 0.456m
        };

        var result = await _service.CreateCampaignAsync(request);

        Assert.NotNull(result);
        Assert.Equal("مجموعة الصيف", result.TitleAr);
        Assert.Equal("Summer Edit", result.TitleEn);
        Assert.Equal(0.46m, result.OverlayOpacity);
        Assert.Equal("center", result.TextAlignment);
    }

    [Fact]
    public async Task CreateCampaignAsync_WithMissingTitles_ThrowsBadRequestException()
    {
        var request = new CreateCampaignRequest
        {
            TitleAr = "",
            TitleEn = "Summer",
            ImageUrlMobile = "https://example.com/mobile.jpg"
        };

        await Assert.ThrowsAsync<BadRequestException>(() => _service.CreateCampaignAsync(request));
    }

    [Fact]
    public async Task UpdateCampaignAsync_UpdatesSpecifiedFields()
    {
        _uow.CampaignsRepo.List.Add(new Campaign
        {
            Id = 10,
            TitleAr = "قديم",
            TitleEn = "Old",
            ImageUrlMobile = "old.jpg",
            Priority = 5,
            IsActive = true,
            OverlayOpacity = 0.20m
        });

        var request = new UpdateCampaignRequest
        {
            TitleAr = "عنوان جديد",
            OverlayOpacity = 0.50m,
            IsActive = false
        };

        var result = await _service.UpdateCampaignAsync(10, request);

        Assert.Equal("عنوان جديد", result.TitleAr);
        Assert.Equal("Old", result.TitleEn); // Preserved
        Assert.False(result.IsActive);
        Assert.Equal(0.50m, result.OverlayOpacity);
    }

    [Fact]
    public async Task DeleteCampaignAsync_RemovesCampaign()
    {
        _uow.CampaignsRepo.List.Add(new Campaign
        {
            Id = 5,
            TitleAr = "حملة للحذف",
            TitleEn = "To Delete",
            ImageUrlMobile = "del.jpg"
        });

        var deleted = await _service.DeleteCampaignAsync(5);

        Assert.True(deleted);
        Assert.Empty(_uow.CampaignsRepo.List);
    }

    [Fact]
    public async Task ReorderCampaignsAsync_UpdatesPriorities()
    {
        _uow.CampaignsRepo.List.AddRange(new[]
        {
            new Campaign { Id = 1, TitleAr = "ح1", TitleEn = "C1", ImageUrlMobile = "1.jpg", Priority = 1 },
            new Campaign { Id = 2, TitleAr = "ح2", TitleEn = "C2", ImageUrlMobile = "2.jpg", Priority = 2 },
            new Campaign { Id = 3, TitleAr = "ح3", TitleEn = "C3", ImageUrlMobile = "3.jpg", Priority = 3 }
        });

        var request = new ReorderCampaignsRequest
        {
            Items = new List<CampaignPriorityItem>
            {
                new() { Id = 1, Priority = 30 },
                new() { Id = 2, Priority = 10 },
                new() { Id = 3, Priority = 20 }
            }
        };

        await _service.ReorderCampaignsAsync(request);

        Assert.Equal(30, _uow.CampaignsRepo.List.First(c => c.Id == 1).Priority);
        Assert.Equal(10, _uow.CampaignsRepo.List.First(c => c.Id == 2).Priority);
        Assert.Equal(20, _uow.CampaignsRepo.List.First(c => c.Id == 3).Priority);
    }
}

internal sealed class FakeUnitOfWorkForCampaigns : IUnitOfWork
{
    public FakeRepository<Campaign> CampaignsRepo { get; } = new();
    public IRepository<Campaign> Campaigns => CampaignsRepo;

    public IRepository<User> Users => throw new NotImplementedException();
    public IRepository<SellerProfile> SellerProfiles => throw new NotImplementedException();
    public IRepository<UserAddress> UserAddresses => throw new NotImplementedException();
    public IRepository<Product> Products => throw new NotImplementedException();
    public IRepository<Category> Categories => throw new NotImplementedException();
    public IRepository<Order> Orders => throw new NotImplementedException();
    public IRepository<Shipment> Shipments => throw new NotImplementedException();
    public IRepository<OrderItem> OrderItems => throw new NotImplementedException();
    public IRepository<UserConsent> UserConsents => throw new NotImplementedException();
    public IRepository<VendorWallet> VendorWallets => throw new NotImplementedException();
    public IRepository<WalletTransaction> WalletTransactions => throw new NotImplementedException();
    public IRepository<PayoutRequest> PayoutRequests => throw new NotImplementedException();
    public IRepository<Review> Reviews => throw new NotImplementedException();
    public IRepository<ReviewReport> ReviewReports => throw new NotImplementedException();
    public IRepository<UserDeviceToken> UserDeviceTokens => throw new NotImplementedException();
    public IRepository<ProductVariant> ProductVariants => throw new NotImplementedException();
    public IRepository<Coupon> Coupons => throw new NotImplementedException();
    public IRepository<CouponUsage> CouponUsages => throw new NotImplementedException();
    public IRepository<ReturnRequest> ReturnRequests => throw new NotImplementedException();
    public IRepository<BuyerWallet> BuyerWallets => throw new NotImplementedException();
    public IRepository<BuyerWalletTransaction> BuyerWalletTransactions => throw new NotImplementedException();
    public IRepository<VerificationCode> VerificationCodes => throw new NotImplementedException();
    public IRepository<RefreshToken> RefreshTokens => throw new NotImplementedException();
    public IRepository<UploadedFile> UploadedFiles => throw new NotImplementedException();
    public IRepository<ExternalLogin> ExternalLogins => throw new NotImplementedException();
    public IRepository<WishlistItem> WishlistItems => throw new NotImplementedException();
    public IRepository<UserNotification> UserNotifications => throw new NotImplementedException();
    public IRepository<AdminAuditLog> AdminAuditLogs => throw new NotImplementedException();
    public IRepository<CodBlacklistEntry> CodBlacklistEntries => throw new NotImplementedException();
    public IRepository<ProcessedWebhookEvent> ProcessedWebhookEvents => throw new NotImplementedException();
    public IRepository<PrivacySubjectRequest> PrivacySubjectRequests => throw new NotImplementedException();
    public IRepository<ProcessorDeletionLog> ProcessorDeletionLogs => throw new NotImplementedException();
    public IRepository<PrivacyIncidentLog> PrivacyIncidentLogs => throw new NotImplementedException();
    public IRepository<ExchangeRequest> ExchangeRequests => throw new NotImplementedException();
    public IRepository<SupportTicket> SupportTickets => throw new NotImplementedException();
    public IRepository<SupportTicketMessage> SupportTicketMessages => throw new NotImplementedException();
    public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches => throw new NotImplementedException();
    public IRepository<TaxInvoice> TaxInvoices => throw new NotImplementedException();

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
    public Task BeginTransactionAsync() => Task.CompletedTask;
    public Task CommitTransactionAsync() => Task.CompletedTask;
    public Task RollbackTransactionAsync() => Task.CompletedTask;
    public void ClearChangeTracker() { }
    public Task<int> ExecuteSqlRawAsync(string sql, params object[] parameters) => Task.FromResult(0);
    public Task RecomputeProductRatingAsync(int productId) => Task.CompletedTask;
    public void Dispose() { }
}
