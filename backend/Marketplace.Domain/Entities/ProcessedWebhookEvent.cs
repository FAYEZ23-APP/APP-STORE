namespace Marketplace.Domain.Entities;

public class ProcessedWebhookEvent
{
    public int Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string? TrackingNumber { get; set; }
    public int? ShipmentId { get; set; }
    public string PayloadHash { get; set; } = string.Empty;
    public string Status { get; set; } = "Processed";
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
