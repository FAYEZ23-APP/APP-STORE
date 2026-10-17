namespace Marketplace.Domain.Entities;

public class SellerProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string DispatchCity { get; set; } = string.Empty;
    public string? DispatchAddress { get; set; }
    public string? ContactPhone { get; set; }

    public User User { get; set; } = null!;
}
