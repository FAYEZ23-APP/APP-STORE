using Marketplace.Application.DTOs.Support;

namespace Marketplace.Application.Interfaces;

public interface ISupportTicketService
{
    Task<SupportTicketDto> CreateTicketAsync(int userId, CreateSupportTicketRequest request);
    Task<IEnumerable<SupportTicketDto>> GetUserTicketsAsync(int userId);
    Task<SupportTicketDto> GetTicketByIdAsync(int userId, bool isAdmin, int ticketId);
    Task<SupportTicketDto> AddMessageAsync(int userId, string role, int ticketId, AddTicketMessageRequest request);
    Task<IEnumerable<SupportTicketDto>> GetAllTicketsAdminAsync(string? status = null);
    Task<SupportTicketDto> UpdateTicketStatusAdminAsync(int adminId, int ticketId, UpdateTicketStatusRequest request);
}
