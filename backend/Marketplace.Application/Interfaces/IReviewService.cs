using Marketplace.Application.DTOs.Reviews;

namespace Marketplace.Application.Interfaces;

public interface IReviewService
{
    Task<ReviewResponse> AddReviewAsync(int userId, CreateReviewRequest request);
    Task<ReviewResponse> UpdateReviewAsync(int buyerId, int reviewId, UpdateReviewRequest request);
    Task DeleteReviewAsync(int userId, bool isAdmin, int reviewId);
    Task<ProductReviewsSummaryResponse> GetProductReviewsAsync(
        int productId,
        int page = 1,
        int pageSize = 10,
        string? sort = "newest");
    Task<CanReviewResponse> CanUserReviewProductAsync(int userId, int productId);
    Task<ReviewResponse> AddSellerReplyAsync(int sellerId, int reviewId, SellerReplyRequest request);
    Task ReportReviewAsync(int reporterId, int reviewId, ReportReviewRequest request);
    Task<ReviewResponse> HideReviewAsync(int adminId, int reviewId, string? note = null);
    Task<ReviewResponse> UnhideReviewAsync(int adminId, int reviewId);
    Task<List<ReviewResponse>> GetSellerReviewsAsync(int sellerId, int page = 1, int pageSize = 20);
    Task<List<AdminReportedReviewResponse>> GetReportedReviewsAsync(bool? isHidden = null, int page = 1, int pageSize = 20);
}
