namespace Marketplace.Application.DTOs.Admin;

public class AdminAuditLogResponse
{
    public int Id { get; set; }
    public int? AdminId { get; set; }
    public string? AdminName { get; set; }
    public string? AdminEmail { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminAuditLogListResponse
{
    public List<AdminAuditLogResponse> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
