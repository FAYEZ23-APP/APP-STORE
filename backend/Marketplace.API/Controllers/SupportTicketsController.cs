using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Support;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/support-tickets")]
public class SupportTicketsController : ControllerBase
{
    private readonly ISupportTicketService _ticketService;

    public SupportTicketsController(ISupportTicketService ticketService)
    {
        _ticketService = ticketService;
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SupportTicketDto>> CreateTicket([FromBody] CreateSupportTicketRequest request)
    {
        var userId = User.GetUserId();
        var result = await _ticketService.CreateTicketAsync(userId, request);
        return CreatedAtAction(nameof(GetTicketById), new { id = result.Id }, result);
    }

    [HttpGet("mine")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetMyTickets()
    {
        var userId = User.GetUserId();
        var result = await _ticketService.GetUserTicketsAsync(userId);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<ActionResult<SupportTicketDto>> GetTicketById(int id)
    {
        var userId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");
        var result = await _ticketService.GetTicketByIdAsync(userId, isAdmin, id);
        return Ok(result);
    }

    [HttpPost("{id:int}/messages")]
    [Authorize]
    public async Task<ActionResult<SupportTicketDto>> AddMessage(int id, [FromBody] AddTicketMessageRequest request)
    {
        var userId = User.GetUserId();
        var role = User.IsInRole("Admin") ? "Admin" : (User.IsInRole("Seller") ? "Seller" : "Buyer");
        var result = await _ticketService.AddMessageAsync(userId, role, id, request);
        return Ok(result);
    }

    [HttpGet("/api/admin/support-tickets")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetAllTicketsAdmin([FromQuery] string? status)
    {
        var result = await _ticketService.GetAllTicketsAdminAsync(status);
        return Ok(result);
    }

    [HttpPut("/api/admin/support-tickets/{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SupportTicketDto>> UpdateTicketStatusAdmin(int id, [FromBody] UpdateTicketStatusRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _ticketService.UpdateTicketStatusAdminAsync(adminId, id, request);
        return Ok(result);
    }
}
