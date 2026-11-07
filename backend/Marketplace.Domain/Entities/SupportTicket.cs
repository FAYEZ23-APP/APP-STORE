namespace Marketplace.Domain.Entities;

public class SupportTicket
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Category { get; set; } = "General"; // Order, Delivery, Return, Payment, General
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public string Status { get; set; } = "Open"; // Open, InProgress, Resolved, Closed
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Order? Order { get; set; }
    public Shipment? Shipment { get; set; }
    public ICollection<SupportTicketMessage> Messages { get; set; } = new List<SupportTicketMessage>();
}
