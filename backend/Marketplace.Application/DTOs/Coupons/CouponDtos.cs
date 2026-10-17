using Marketplace.Application.DTOs.Orders;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.DTOs.Coupons;

public class CreateCouponRequest
{
    public string Code { get; set; } = string.Empty;
    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;
    public decimal DiscountValue { get; set; }
    public decimal MinOrderSubtotal { get; set; } = 0;
    public decimal? MaxDiscountAmount { get; set; }
    public int MaxUsage { get; set; } = 100;
    public int PerUserLimit { get; set; } = 1;
    public DateTime ExpiresAt { get; set; }
}

public class CouponResponse
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DiscountType { get; set; } = string.Empty;
    public decimal DiscountValue { get; set; }
    public decimal MinOrderSubtotal { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public int MaxUsage { get; set; }
    public int UsedCount { get; set; }
    public int PerUserLimit { get; set; }
    public int? SellerId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ValidateCouponRequest
{
    public string Code { get; set; } = string.Empty;
    public List<OrderItemRequest>? Items { get; set; }
}

public class CouponValidationResponse
{
    public bool IsValid { get; set; }
    public string? Message { get; set; }
    public decimal DiscountAmount { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DiscountType { get; set; } = string.Empty;
    public decimal DiscountValue { get; set; }
}
