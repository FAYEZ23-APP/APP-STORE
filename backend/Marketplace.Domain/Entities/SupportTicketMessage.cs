namespace Marketplace.Domain.Entities;

public class SupportTicketMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public int SenderId { get; set; }
    public string SenderRole { get; set; } = string.Empty; // Buyer, Seller, Admin
    public string Message { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SupportTicket Ticket { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
