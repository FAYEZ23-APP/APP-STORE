namespace Marketplace.Application.DTOs.Support;

public class CreateSupportTicketRequest
{
    public int? OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public string Priority { get; set; } = "Medium";
    public string InitialMessage { get; set; } = string.Empty;
}

public class AddTicketMessageRequest
{
    public string Message { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
}

public class UpdateTicketStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class SupportTicketDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public int? OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<SupportTicketMessageDto> Messages { get; set; } = new();
}

public class SupportTicketMessageDto
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}
