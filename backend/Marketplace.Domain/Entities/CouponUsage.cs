namespace Marketplace.Domain.Entities;

public class CouponUsage
{
    public int Id { get; set; }
    public int CouponId { get; set; }
    public int BuyerId { get; set; }
    public int OrderId { get; set; }
    public decimal DiscountApplied { get; set; }
    public DateTime UsedAt { get; set; } = DateTime.UtcNow;

    public Coupon Coupon { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public Order Order { get; set; } = null!;
}
