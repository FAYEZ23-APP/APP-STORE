using Marketplace.Application.DTOs.Coupons;

namespace Marketplace.Application.Interfaces;

public interface ICouponService
{
    Task<CouponValidationResponse> ValidateCouponAsync(int buyerId, ValidateCouponRequest request);
    Task<CouponResponse> CreateCouponAsync(int? sellerId, CreateCouponRequest request);
    Task<IEnumerable<CouponResponse>> GetSellerCouponsAsync(int sellerId);
}
