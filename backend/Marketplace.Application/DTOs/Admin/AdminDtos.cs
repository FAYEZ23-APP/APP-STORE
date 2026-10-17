namespace Marketplace.Application.DTOs.Admin;

public class AdminUserResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? DispatchCity { get; set; }
    public string? ContactPhone { get; set; }
}

public class UpdateUserStatusRequest
{
    public bool IsActive { get; set; }
    public string? Reason { get; set; }
}

public class AdminStatsResponse
{
    public int TotalOrders { get; set; }
    public decimal TotalVolume { get; set; }
    public int TotalActiveProducts { get; set; }
    public int TotalRefusedCodOrders { get; set; }
    public int TotalUsers { get; set; }
    public int TotalBuyers { get; set; }
    public int TotalSellers { get; set; }
}
