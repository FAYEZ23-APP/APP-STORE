using Marketplace.Application.DTOs.Reviews;

namespace Marketplace.Application.Interfaces;

public interface IReviewService
{
    Task<ReviewResponse> AddReviewAsync(int buyerId, CreateReviewRequest request);
    Task<ProductReviewsSummaryResponse> GetProductReviewsAsync(int productId, int page = 1, int pageSize = 10);
    Task<CanReviewResponse> CanUserReviewProductAsync(int buyerId, int productId);
}
