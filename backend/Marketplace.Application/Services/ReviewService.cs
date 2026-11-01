using Marketplace.Application.DTOs.Reviews;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class ReviewService : IReviewService
{
    private readonly IUnitOfWork _uow;
    private readonly IImageUploadService _imageUploadService;
    private readonly IConfiguration _configuration;

    public ReviewService(
        IUnitOfWork uow,
        IImageUploadService imageUploadService,
        IConfiguration configuration)
    {
        _uow = uow;
        _imageUploadService = imageUploadService;
        _configuration = configuration;
    }

    private int GetEditWindowDays() => _configuration.GetValue<int>("Reviews:EditWindowDays", 30);

    public async Task<CanReviewResponse> CanUserReviewProductAsync(int userId, int productId)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product == null)
        {
            return new CanReviewResponse
            {
                CanReview = false,
                EligibleToCreate = false,
                Reason = "المنتج غير موجود."
            };
        }

        if (product.SellerId == userId)
        {
            return new CanReviewResponse
            {
                CanReview = false,
                EligibleToCreate = false,
                Reason = "لا يمكن للتاجر تقييم منتجاته الخاصة."
            };
        }

        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null || user.Role != UserRole.Buyer)
        {
            return new CanReviewResponse
            {
                CanReview = false,
                EligibleToCreate = false,
                Reason = "التقييم متاح للمشترين فقط."
            };
        }

        var editWindowDays = GetEditWindowDays();
        var existingReview = (await _uow.Reviews.FindAsync(
            r => r.ProductId == productId && r.BuyerId == userId)).FirstOrDefault();

        if (existingReview != null)
        {
            var canEdit = !existingReview.IsHidden &&
                          DateTime.UtcNow <= existingReview.CreatedAt.AddDays(editWindowDays);
            return new CanReviewResponse
            {
                CanReview = false,
                EligibleToCreate = false,
                AlreadyReviewed = true,
                CanEditExisting = canEdit,
                ExistingReview = MapToReviewResponse(existingReview, user.Name, product.Name, editWindowDays),
                Reason = "قمت بتقييم هذا المنتج مسبقاً."
            };
        }

        var hasDeliveredProduct = await HasBuyerReceivedProductAsync(userId, productId);
        if (!hasDeliveredProduct)
        {
            return new CanReviewResponse
            {
                CanReview = false,
                EligibleToCreate = false,
                AlreadyReviewed = false,
                Reason = "لا يمكنك تقييم المنتج إلا بعد شرائه واستلام الشحنة بنجاح."
            };
        }

        return new CanReviewResponse
        {
            CanReview = true,
            EligibleToCreate = true,
            AlreadyReviewed = false,
            CanEditExisting = false,
            Reason = null
        };
    }

    public async Task<ReviewResponse> AddReviewAsync(int userId, CreateReviewRequest request)
    {
        var product = await _uow.Products.GetByIdAsync(request.ProductId);
        if (product == null)
            throw new NotFoundException("المنتج غير موجود.");

        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException("المستخدم غير موجود.");

        // Rule 1: Sellers cannot review their own products -> 403 Forbidden
        if (product.SellerId == userId)
            throw new ForbiddenException("لا يمكن للتاجر تقييم منتجاته الخاصة.");

        // Rule 2: Only Buyers can submit reviews -> 403 Forbidden
        if (user.Role != UserRole.Buyer)
            throw new ForbiddenException("التقييم متاح للمشترين فقط.");

        // Rule 3: One review per (buyer, product) -> Duplicate review rejected
        var existingReview = (await _uow.Reviews.FindAsync(
            r => r.ProductId == request.ProductId && r.BuyerId == userId)).FirstOrDefault();
        if (existingReview != null)
            throw new BadRequestException("قمت بتقييم هذا المنتج مسبقاً. يسمح بتقييم واحد فقط لكل منتج.");

        // Rule 4: Only a buyer with a Delivered shipment containing the product may review it -> 403 Forbidden
        var hasDeliveredProduct = await HasBuyerReceivedProductAsync(userId, request.ProductId);
        if (!hasDeliveredProduct)
            throw new ForbiddenException("لا يمكنك تقييم المنتج إلا بعد شرائه واستلام الشحنة بنجاح.");

        var normalizedPhotos = (request.ImageUrls ?? new List<string>())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .ToList();

        await _imageUploadService.ValidateReviewImagesAsync(userId, normalizedPhotos);

        var review = new Review
        {
            ProductId = request.ProductId,
            BuyerId = userId,
            Rating = request.Rating,
            Comment = request.Comment?.Trim() ?? string.Empty,
            ImageUrls = normalizedPhotos,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.Reviews.AddAsync(review);
        try
        {
            await _uow.SaveChangesAsync();
        }
        catch (Exception ex) when (ex.InnerException?.Message.Contains("IX_Reviews_ProductId_BuyerId") == true ||
                                   ex.Message.Contains("IX_Reviews_ProductId_BuyerId"))
        {
            throw new BadRequestException("قمت بتقييم هذا المنتج مسبقاً. يسمح بتقييم واحد فقط لكل منتج.");
        }

        await _uow.RecomputeProductRatingAsync(request.ProductId);

        return MapToReviewResponse(review, user.Name, product.Name, GetEditWindowDays());
    }

    public async Task<ReviewResponse> UpdateReviewAsync(int buyerId, int reviewId, UpdateReviewRequest request)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null)
            throw new NotFoundException("التقييم غير موجود.");

        if (review.BuyerId != buyerId)
            throw new ForbiddenException("لا يمكنك تعديل تقييم مستخدم آخر.");

        if (review.IsHidden)
            throw new ForbiddenException("لا يمكن تعديل تقييم تم إخفاؤه من قبل الإدارة.");

        var editWindowDays = GetEditWindowDays();
        if (DateTime.UtcNow > review.CreatedAt.AddDays(editWindowDays))
            throw new BadRequestException($"انتهت المهلة المسموحة لتعديل التقييم ({editWindowDays} يوماً من تاريخ النشر).");

        var normalizedPhotos = (request.ImageUrls ?? new List<string>())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .ToList();

        await _imageUploadService.ValidateReviewImagesAsync(buyerId, normalizedPhotos);

        review.Rating = request.Rating;
        review.Comment = request.Comment?.Trim() ?? string.Empty;
        review.ImageUrls = normalizedPhotos;
        review.UpdatedAt = DateTime.UtcNow;

        _uow.Reviews.Update(review);
        await _uow.SaveChangesAsync();

        await _uow.RecomputeProductRatingAsync(review.ProductId);

        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        var product = await _uow.Products.GetByIdAsync(review.ProductId);
        return MapToReviewResponse(review, buyer?.Name, product?.Name ?? string.Empty, editWindowDays);
    }

    public async Task DeleteReviewAsync(int userId, bool isAdmin, int reviewId)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null)
            throw new NotFoundException("التقييم غير موجود.");

        if (!isAdmin && review.BuyerId != userId)
            throw new ForbiddenException("لا يمكنك حذف تقييم مستخدم آخر.");

        var productId = review.ProductId;
        _uow.Reviews.Remove(review);
        await _uow.SaveChangesAsync();

        await _uow.RecomputeProductRatingAsync(productId);
    }

    public async Task<ProductReviewsSummaryResponse> GetProductReviewsAsync(
        int productId,
        int page = 1,
        int pageSize = 10,
        string? sort = "newest")
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product == null)
            throw new NotFoundException("المنتج غير موجود.");

        var visibleReviews = (await _uow.Reviews.FindAsync(
            r => r.ProductId == productId && !r.IsHidden)).ToList();

        var totalReviews = visibleReviews.Count;
        var avg = totalReviews > 0
            ? Math.Round((decimal)visibleReviews.Average(r => r.Rating), 1)
            : 0m;

        var starDist = new Dictionary<int, int>
        {
            { 1, 0 }, { 2, 0 }, { 3, 0 }, { 4, 0 }, { 5, 0 }
        };
        foreach (var r in visibleReviews)
        {
            if (starDist.ContainsKey(r.Rating))
                starDist[r.Rating]++;
        }

        var normalizedSort = (sort ?? "newest").Trim().ToLowerInvariant();
        IEnumerable<Review> ordered = normalizedSort switch
        {
            "highest" => visibleReviews.OrderByDescending(r => r.Rating).ThenByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id),
            "lowest" => visibleReviews.OrderBy(r => r.Rating).ThenByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id),
            _ => visibleReviews.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
        };

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);
        var totalPages = totalReviews == 0 ? 1 : (int)Math.Ceiling(totalReviews / (double)safePageSize);

        var pagedReviews = ordered
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        var buyerIds = pagedReviews.Select(r => r.BuyerId).Distinct().ToList();
        var buyers = (await _uow.Users.FindAsync(u => buyerIds.Contains(u.Id)))
            .ToDictionary(
                u => u.Id,
                u => (!u.IsActive || string.IsNullOrWhiteSpace(u.Name)) ? null : u.Name);

        var editWindowDays = GetEditWindowDays();
        var reviewResponses = pagedReviews.Select(r =>
            MapToReviewResponse(r, buyers.GetValueOrDefault(r.BuyerId), product.Name, editWindowDays)).ToList();

        return new ProductReviewsSummaryResponse
        {
            ProductId = productId,
            RatingAverage = avg,
            RatingCount = totalReviews,
            AverageRating = avg,
            TotalReviews = totalReviews,
            Page = safePage,
            PageSize = safePageSize,
            TotalPages = totalPages,
            Sort = normalizedSort,
            StarDistribution = starDist,
            Reviews = reviewResponses
        };
    }

    public async Task<ReviewResponse> AddSellerReplyAsync(int sellerId, int reviewId, SellerReplyRequest request)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null || review.IsHidden)
            throw new NotFoundException("التقييم غير موجود.");

        var product = await _uow.Products.GetByIdAsync(review.ProductId);
        if (product == null)
            throw new NotFoundException("المنتج غير موجود.");

        if (product.SellerId != sellerId)
            throw new ForbiddenException("لا يمكنك الرد إلا على تقييمات منتجاتك الخاصة.");

        if (!string.IsNullOrWhiteSpace(review.SellerReply))
            throw new BadRequestException("تم الرد على هذا التقييم مسبقاً. يسمح برد واحد فقط لكل تقييم.");

        review.SellerReply = request.Reply.Trim();
        review.SellerRepliedAt = DateTime.UtcNow;

        _uow.Reviews.Update(review);
        await _uow.SaveChangesAsync();

        var buyer = await _uow.Users.GetByIdAsync(review.BuyerId);
        return MapToReviewResponse(review, buyer?.Name, product.Name, GetEditWindowDays());
    }

    public async Task ReportReviewAsync(int reporterId, int reviewId, ReportReviewRequest request)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null)
            throw new NotFoundException("التقييم غير موجود.");

        var existingReport = (await _uow.ReviewReports.FindAsync(
            rr => rr.ReviewId == reviewId && rr.ReporterId == reporterId)).FirstOrDefault();

        if (existingReport != null)
            throw new BadRequestException("تم الإبلاغ عن هذا التقييم مسبقاً.");

        var report = new ReviewReport
        {
            ReviewId = reviewId,
            ReporterId = reporterId,
            Reason = request.Reason.Trim(),
            Details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _uow.ReviewReports.AddAsync(report);
        await _uow.SaveChangesAsync();
    }

    public async Task<ReviewResponse> HideReviewAsync(int adminId, int reviewId, string? note = null)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null)
            throw new NotFoundException("التقييم غير موجود.");

        review.IsHidden = true;
        review.HiddenAt = DateTime.UtcNow;
        review.HiddenByAdminId = adminId;
        review.ModerationNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        _uow.Reviews.Update(review);
        await _uow.SaveChangesAsync();

        await _uow.RecomputeProductRatingAsync(review.ProductId);

        var buyer = await _uow.Users.GetByIdAsync(review.BuyerId);
        var product = await _uow.Products.GetByIdAsync(review.ProductId);
        return MapToReviewResponse(review, buyer?.Name, product?.Name ?? string.Empty, GetEditWindowDays());
    }

    public async Task<ReviewResponse> UnhideReviewAsync(int adminId, int reviewId)
    {
        var review = await _uow.Reviews.GetByIdAsync(reviewId);
        if (review == null)
            throw new NotFoundException("التقييم غير موجود.");

        review.IsHidden = false;
        review.HiddenAt = null;
        review.HiddenByAdminId = null;
        review.ModerationNote = null;

        _uow.Reviews.Update(review);
        await _uow.SaveChangesAsync();

        await _uow.RecomputeProductRatingAsync(review.ProductId);

        var buyer = await _uow.Users.GetByIdAsync(review.BuyerId);
        var product = await _uow.Products.GetByIdAsync(review.ProductId);
        return MapToReviewResponse(review, buyer?.Name, product?.Name ?? string.Empty, GetEditWindowDays());
    }

    public async Task<List<ReviewResponse>> GetSellerReviewsAsync(int sellerId, int page = 1, int pageSize = 20)
    {
        var sellerProducts = (await _uow.Products.FindAsync(p => p.SellerId == sellerId)).ToList();
        if (!sellerProducts.Any())
            return new List<ReviewResponse>();

        var productMap = sellerProducts.ToDictionary(p => p.Id, p => p.Name);
        var productIds = productMap.Keys.ToList();

        var reviews = (await _uow.Reviews.FindAsync(
            r => productIds.Contains(r.ProductId) && !r.IsHidden))
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Skip((Math.Max(1, page) - 1) * Math.Clamp(pageSize, 1, 50))
            .Take(Math.Clamp(pageSize, 1, 50))
            .ToList();

        var buyerIds = reviews.Select(r => r.BuyerId).Distinct().ToList();
        var buyers = (await _uow.Users.FindAsync(u => buyerIds.Contains(u.Id)))
            .ToDictionary(
                u => u.Id,
                u => (!u.IsActive || string.IsNullOrWhiteSpace(u.Name)) ? null : u.Name);

        var editWindowDays = GetEditWindowDays();
        return reviews.Select(r =>
            MapToReviewResponse(
                r,
                buyers.GetValueOrDefault(r.BuyerId),
                productMap.GetValueOrDefault(r.ProductId, string.Empty),
                editWindowDays)).ToList();
    }

    public async Task<List<AdminReportedReviewResponse>> GetReportedReviewsAsync(
        bool? isHidden = null, int page = 1, int pageSize = 20)
    {
        var reports = (await _uow.ReviewReports.GetAllAsync()).ToList();
        if (reports.Count == 0)
            return new List<AdminReportedReviewResponse>();

        var reviewIds = reports.Select(r => r.ReviewId).Distinct().ToList();
        var reviews = (await _uow.Reviews.FindAsync(r => reviewIds.Contains(r.Id)))
            .Where(r => !isHidden.HasValue || r.IsHidden == isHidden.Value)
            .ToDictionary(r => r.Id);

        var productIds = reviews.Values.Select(r => r.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id)))
            .ToDictionary(p => p.Id, p => p.Name);

        var userIds = reviews.Values.Select(r => r.BuyerId)
            .Concat(reports.Select(r => r.ReporterId))
            .Distinct()
            .ToList();
        var users = (await _uow.Users.FindAsync(u => userIds.Contains(u.Id)))
            .ToDictionary(u => u.Id, u => u.Name);

        var safePageSize = Math.Clamp(pageSize, 1, 50);
        var safePage = Math.Max(1, page);

        return reports
            .Where(r => reviews.ContainsKey(r.ReviewId))
            .GroupBy(r => r.ReviewId)
            .Select(g =>
            {
                var review = reviews[g.Key];
                return new AdminReportedReviewResponse
                {
                    ReviewId = review.Id,
                    ProductId = review.ProductId,
                    ProductName = products.GetValueOrDefault(review.ProductId, string.Empty),
                    BuyerId = review.BuyerId,
                    ReviewerName = FormatReviewerName(users.GetValueOrDefault(review.BuyerId)),
                    Rating = review.Rating,
                    Comment = review.Comment,
                    ImageUrls = review.ImageUrls ?? new List<string>(),
                    SellerReply = review.SellerReply,
                    IsHidden = review.IsHidden,
                    HiddenAt = review.HiddenAt,
                    ModerationNote = review.ModerationNote,
                    ReviewCreatedAt = review.CreatedAt,
                    ReportCount = g.Count(),
                    LastReportedAt = g.Max(x => x.CreatedAt),
                    Reports = g.OrderByDescending(x => x.CreatedAt)
                        .Select(x => new AdminReviewReportItem
                        {
                            Id = x.Id,
                            ReporterId = x.ReporterId,
                            ReporterName = string.IsNullOrWhiteSpace(users.GetValueOrDefault(x.ReporterId))
                                ? "مستخدم"
                                : users[x.ReporterId],
                            Reason = x.Reason,
                            Details = x.Details,
                            CreatedAt = x.CreatedAt
                        })
                        .ToList()
                };
            })
            .OrderByDescending(r => r.LastReportedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();
    }

    private async Task<bool> HasBuyerReceivedProductAsync(int buyerId, int productId)
    {
        var buyerOrderIds = (await _uow.Orders.FindAsync(o => o.BuyerId == buyerId))
            .Select(o => o.Id)
            .ToList();

        if (!buyerOrderIds.Any())
            return false;

        var deliveredShipmentIds = (await _uow.Shipments.FindAsync(
            s => buyerOrderIds.Contains(s.OrderId) && s.Status == ShipmentStatus.Delivered))
            .Select(s => s.Id)
            .ToList();

        if (!deliveredShipmentIds.Any())
            return false;

        var hasDeliveredItem = (await _uow.OrderItems.FindAsync(
            i => i.ProductId == productId && deliveredShipmentIds.Contains(i.ShipmentId)))
            .Any();

        return hasDeliveredItem;
    }

    private static ReviewResponse MapToReviewResponse(
        Review review,
        string? rawBuyerName,
        string productName,
        int editWindowDays)
    {
        var formattedName = FormatReviewerName(rawBuyerName);
        var canEdit = !review.IsHidden &&
                      DateTime.UtcNow <= review.CreatedAt.AddDays(editWindowDays);

        return new ReviewResponse
        {
            Id = review.Id,
            ProductId = review.ProductId,
            ProductName = productName,
            BuyerId = review.BuyerId,
            ReviewerName = formattedName,
            BuyerName = formattedName,
            Rating = review.Rating,
            Comment = review.Comment,
            ImageUrls = review.ImageUrls ?? new List<string>(),
            SellerReply = review.SellerReply,
            SellerRepliedAt = review.SellerRepliedAt,
            IsHidden = review.IsHidden,
            CreatedAt = review.CreatedAt,
            UpdatedAt = review.UpdatedAt,
            CanEdit = canEdit
        };
    }

    /// <summary>
    /// Formats a reviewer's name as "FirstName L." and guarantees never returning an email or phone number.
    /// </summary>
    public static string FormatReviewerName(string? rawName)
    {
        if (string.IsNullOrWhiteSpace(rawName))
            return "مشتري";

        var trimmed = rawName.Trim();

        // Never expose email or phone if stored in Name
        if (trimmed.Contains('@') || trimmed.All(c => char.IsDigit(c) || c == '+' || c == '-' || char.IsWhiteSpace(c)))
            return "مشتري";

        var parts = trimmed
            .Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(p => !p.Contains('@'))
            .ToArray();

        if (parts.Length == 0)
            return "مشتري";

        var firstName = parts[0];
        if (parts.Length == 1)
            return firstName;

        var secondInitial = parts[1][0];
        return $"{firstName} {secondInitial}.";
    }
}
