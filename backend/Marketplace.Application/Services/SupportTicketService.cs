using Marketplace.Application.DTOs.Support;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public class SupportTicketService : ISupportTicketService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<SupportTicketService> _logger;

    public SupportTicketService(IUnitOfWork unitOfWork, ILogger<SupportTicketService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<SupportTicketDto> CreateTicketAsync(int userId, CreateSupportTicketRequest request)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user == null)
            throw new NotFoundException($"User {userId} not found");

        var ticket = new SupportTicket
        {
            UserId = userId,
            OrderId = request.OrderId,
            ShipmentId = request.ShipmentId,
            Subject = request.Subject,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category,
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Medium" : request.Priority,
            Status = "Open",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var initialMsg = new SupportTicketMessage
        {
            SenderId = userId,
            SenderRole = user.Role.ToString(),
            Message = request.InitialMessage,
            CreatedAt = DateTime.UtcNow
        };

        ticket.Messages.Add(initialMsg);
        await _unitOfWork.SupportTickets.AddAsync(ticket);
        await _unitOfWork.SaveChangesAsync();

        return MapToDto(ticket, user.Name, user.Email ?? string.Empty);
    }

    public async Task<IEnumerable<SupportTicketDto>> GetUserTicketsAsync(int userId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        var tickets = await _unitOfWork.SupportTickets.FindAsync(t => t.UserId == userId);
        var list = new List<SupportTicketDto>();

        foreach (var ticket in tickets.OrderByDescending(t => t.UpdatedAt))
        {
            var msgs = await _unitOfWork.SupportTicketMessages.FindAsync(m => m.TicketId == ticket.Id);
            ticket.Messages = msgs.OrderBy(m => m.CreatedAt).ToList();
            list.Add(MapToDto(ticket, user?.Name ?? string.Empty, user?.Email ?? string.Empty));
        }

        return list;
    }

    public async Task<SupportTicketDto> GetTicketByIdAsync(int userId, bool isAdmin, int ticketId)
    {
        var ticket = await _unitOfWork.SupportTickets.GetByIdAsync(ticketId);
        if (ticket == null)
            throw new NotFoundException($"Support ticket {ticketId} not found");

        if (!isAdmin && ticket.UserId != userId)
            throw new ForbiddenException("You are not authorized to view this support ticket");

        var owner = await _unitOfWork.Users.GetByIdAsync(ticket.UserId);
        var msgs = await _unitOfWork.SupportTicketMessages.FindAsync(m => m.TicketId == ticket.Id);
        ticket.Messages = msgs.OrderBy(m => m.CreatedAt).ToList();

        return MapToDto(ticket, owner?.Name ?? string.Empty, owner?.Email ?? string.Empty);
    }

    public async Task<SupportTicketDto> AddMessageAsync(int userId, string role, int ticketId, AddTicketMessageRequest request)
    {
        var ticket = await _unitOfWork.SupportTickets.GetByIdAsync(ticketId);
        if (ticket == null)
            throw new NotFoundException($"Support ticket {ticketId} not found");

        var isAdmin = role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && ticket.UserId != userId)
            throw new ForbiddenException("You are not authorized to comment on this support ticket");

        var user = await _unitOfWork.Users.GetByIdAsync(userId);

        var msg = new SupportTicketMessage
        {
            TicketId = ticketId,
            SenderId = userId,
            SenderRole = role,
            Message = request.Message,
            AttachmentUrl = request.AttachmentUrl,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.SupportTicketMessages.AddAsync(msg);

        ticket.UpdatedAt = DateTime.UtcNow;
        if (isAdmin && ticket.Status == "Open")
        {
            ticket.Status = "InProgress";
        }
        else if (!isAdmin && ticket.Status == "Resolved")
        {
            ticket.Status = "Open";
        }
        _unitOfWork.SupportTickets.Update(ticket);

        await _unitOfWork.SaveChangesAsync();

        var owner = await _unitOfWork.Users.GetByIdAsync(ticket.UserId);
        var msgs = await _unitOfWork.SupportTicketMessages.FindAsync(m => m.TicketId == ticket.Id);
        ticket.Messages = msgs.OrderBy(m => m.CreatedAt).ToList();

        return MapToDto(ticket, owner?.Name ?? string.Empty, owner?.Email ?? string.Empty);
    }

    public async Task<IEnumerable<SupportTicketDto>> GetAllTicketsAdminAsync(string? status = null)
    {
        var all = string.IsNullOrWhiteSpace(status)
            ? await _unitOfWork.SupportTickets.GetAllAsync()
            : await _unitOfWork.SupportTickets.FindAsync(t => t.Status.ToLower() == status.ToLower());

        var list = new List<SupportTicketDto>();
        foreach (var ticket in all.OrderByDescending(t => t.UpdatedAt))
        {
            var owner = await _unitOfWork.Users.GetByIdAsync(ticket.UserId);
            var msgs = await _unitOfWork.SupportTicketMessages.FindAsync(m => m.TicketId == ticket.Id);
            ticket.Messages = msgs.OrderBy(m => m.CreatedAt).ToList();
            list.Add(MapToDto(ticket, owner?.Name ?? string.Empty, owner?.Email ?? string.Empty));
        }

        return list;
    }

    public async Task<SupportTicketDto> UpdateTicketStatusAdminAsync(int adminId, int ticketId, UpdateTicketStatusRequest request)
    {
        var ticket = await _unitOfWork.SupportTickets.GetByIdAsync(ticketId);
        if (ticket == null)
            throw new NotFoundException($"Support ticket {ticketId} not found");

        var oldStatus = ticket.Status;
        ticket.Status = request.Status;
        ticket.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.SupportTickets.Update(ticket);

        await _unitOfWork.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "UpdateSupportTicketStatus",
            EntityType = "SupportTicket",
            EntityId = ticketId.ToString(),
            Details = $"Changed ticket {ticketId} status from {oldStatus} to {request.Status}",
            CreatedAt = DateTime.UtcNow
        });

        await _unitOfWork.SaveChangesAsync();

        var owner = await _unitOfWork.Users.GetByIdAsync(ticket.UserId);
        var msgs = await _unitOfWork.SupportTicketMessages.FindAsync(m => m.TicketId == ticket.Id);
        ticket.Messages = msgs.OrderBy(m => m.CreatedAt).ToList();

        return MapToDto(ticket, owner?.Name ?? string.Empty, owner?.Email ?? string.Empty);
    }

    private static SupportTicketDto MapToDto(SupportTicket t, string userName, string userEmail) => new()
    {
        Id = t.Id,
        UserId = t.UserId,
        UserName = userName,
        UserEmail = userEmail,
        OrderId = t.OrderId,
        ShipmentId = t.ShipmentId,
        Subject = t.Subject,
        Category = t.Category,
        Priority = t.Priority,
        Status = t.Status,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt,
        Messages = t.Messages.Select(m => new SupportTicketMessageDto
        {
            Id = m.Id,
            TicketId = m.TicketId,
            SenderId = m.SenderId,
            SenderName = m.Sender?.Name ?? (m.SenderRole == "Admin" ? "الدعم الفني" : "المستخدم"),
            SenderRole = m.SenderRole,
            Message = m.Message,
            AttachmentUrl = m.AttachmentUrl,
            CreatedAt = m.CreatedAt
        }).ToList()
    };
}
