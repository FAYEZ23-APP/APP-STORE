using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class Coupon
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public DiscountType DiscountType { get; set; } = DiscountType.Percentage;
    public decimal DiscountValue { get; set; }
    public decimal MinOrderSubtotal { get; set; } = 0;
    public decimal? MaxDiscountAmount { get; set; }
    public int MaxUsage { get; set; } = 100;
    public int UsedCount { get; set; } = 0;
    public int PerUserLimit { get; set; } = 1;
    public int? SellerId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Seller { get; set; }
    public ICollection<CouponUsage> Usages { get; set; } = new List<CouponUsage>();
}
