using Marketplace.Application.DTOs.Coupons;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Services;

public class CouponService : ICouponService
{
    private readonly IUnitOfWork _uow;

    public CouponService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<CouponValidationResponse> ValidateCouponAsync(int buyerId, ValidateCouponRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return new CouponValidationResponse
            {
                IsValid = false,
                Message = "يرجى إدخال كود الكوبون."
            };
        }

        var code = request.Code.Trim().ToUpperInvariant();
        var coupon = (await _uow.Coupons.FindAsync(c => c.Code == code)).FirstOrDefault();

        if (coupon == null || !coupon.IsActive)
        {
            return new CouponValidationResponse
            {
                IsValid = false,
                Message = "كوبون الخصم غير صحيح أو غير مفعّل."
            };
        }

        if (coupon.ExpiresAt < DateTime.UtcNow)
        {
            return new CouponValidationResponse
            {
                IsValid = false,
                Message = "عذراً، انتهت صلاحية هذا الكوبون."
            };
        }

        if (coupon.UsedCount >= coupon.MaxUsage)
        {
            return new CouponValidationResponse
            {
                IsValid = false,
                Message = "تم استنفاد الحد الأقصى لاستخدام هذا الكوبون."
            };
        }

        var userUsageCount = (await _uow.CouponUsages.FindAsync(u => u.CouponId == coupon.Id && u.BuyerId == buyerId)).Count();
        if (userUsageCount >= coupon.PerUserLimit)
        {
            return new CouponValidationResponse
            {
                IsValid = false,
                Message = "لقد استخدمت هذا الكوبون بالحد الأقصى المسموح به لحسابك."
            };
        }

        decimal discount = 0m;
        if (request.Items != null && request.Items.Any())
        {
            var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

            var variantIds = request.Items.Where(i => i.VariantId.HasValue).Select(i => i.VariantId!.Value).Distinct().ToList();
            var variants = variantIds.Any()
                ? (await _uow.ProductVariants.FindAsync(v => variantIds.Contains(v.Id))).ToDictionary(v => v.Id)
                : new Dictionary<int, ProductVariant>();

            var applicableItems = request.Items.Where(i =>
            {
                if (!products.TryGetValue(i.ProductId, out var prod))
                    return false;
                if (coupon.SellerId.HasValue && prod.SellerId != coupon.SellerId.Value)
                    return false;
                return true;
            }).ToList();

            if (!applicableItems.Any())
            {
                return new CouponValidationResponse
                {
                    IsValid = false,
                    Message = "هذا الكوبون غير مخصص للمنتجات الموجودة في سلة التسوق."
                };
            }

            decimal applicableSubtotal = 0m;
            foreach (var item in applicableItems)
            {
                var prod = products[item.ProductId];
                decimal price = prod.Price;
                if (item.VariantId.HasValue && variants.TryGetValue(item.VariantId.Value, out var v) && v.ProductId == prod.Id)
                {
                    price = v.PriceOverride ?? prod.Price;
                }
                applicableSubtotal += price * Math.Max(1, item.Quantity);
            }

            if (applicableSubtotal < coupon.MinOrderSubtotal)
            {
                return new CouponValidationResponse
                {
                    IsValid = false,
                    Message = $"الحد الأدنى لقيمة المنتجات المشمولة لتطبيق الكوبون هو {coupon.MinOrderSubtotal} ج.م."
                };
            }

            if (coupon.DiscountType == DiscountType.Percentage)
            {
                discount = applicableSubtotal * (coupon.DiscountValue / 100m);
                if (coupon.MaxDiscountAmount.HasValue && discount > coupon.MaxDiscountAmount.Value)
                {
                    discount = coupon.MaxDiscountAmount.Value;
                }
            }
            else
            {
                discount = Math.Min(coupon.DiscountValue, applicableSubtotal);
            }
        }

        return new CouponValidationResponse
        {
            IsValid = true,
            Message = "تم التحقق من الكوبون بنجاح!",
            DiscountAmount = Math.Round(discount, 2),
            Code = coupon.Code,
            DiscountType = coupon.DiscountType.ToString(),
            DiscountValue = coupon.DiscountValue
        };
    }

    public async Task<CouponResponse> CreateCouponAsync(int? sellerId, CreateCouponRequest request)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var existing = (await _uow.Coupons.FindAsync(c => c.Code == code)).FirstOrDefault();
        if (existing != null)
        {
            throw new ConflictException("كود الكوبون موجود مسبقاً، يرجى اختيار كود آخر.");
        }

        var coupon = new Coupon
        {
            Code = code,
            DiscountType = request.DiscountType,
            DiscountValue = request.DiscountValue,
            MinOrderSubtotal = request.MinOrderSubtotal,
            MaxDiscountAmount = request.MaxDiscountAmount,
            MaxUsage = request.MaxUsage,
            UsedCount = 0,
            PerUserLimit = request.PerUserLimit,
            SellerId = sellerId,
            ExpiresAt = request.ExpiresAt,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.Coupons.AddAsync(coupon);
        await _uow.SaveChangesAsync();

        return MapToResponse(coupon);
    }

    public async Task<IEnumerable<CouponResponse>> GetSellerCouponsAsync(int sellerId)
    {
        var coupons = (await _uow.Coupons.FindAsync(c => c.SellerId == sellerId))
            .OrderByDescending(c => c.CreatedAt)
            .ToList();

        return coupons.Select(MapToResponse);
    }

    private static CouponResponse MapToResponse(Coupon coupon)
    {
        return new CouponResponse
        {
            Id = coupon.Id,
            Code = coupon.Code,
            DiscountType = coupon.DiscountType.ToString(),
            DiscountValue = coupon.DiscountValue,
            MinOrderSubtotal = coupon.MinOrderSubtotal,
            MaxDiscountAmount = coupon.MaxDiscountAmount,
            MaxUsage = coupon.MaxUsage,
            UsedCount = coupon.UsedCount,
            PerUserLimit = coupon.PerUserLimit,
            SellerId = coupon.SellerId,
            ExpiresAt = coupon.ExpiresAt,
            IsActive = coupon.IsActive,
            CreatedAt = coupon.CreatedAt
        };
    }
}
