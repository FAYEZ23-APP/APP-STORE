using Marketplace.Application.DTOs.Invoices;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/invoices")]
public class InvoicesController : ControllerBase
{
    private readonly IEtaInvoiceService _invoiceService;

    public InvoicesController(IEtaInvoiceService invoiceService)
    {
        _invoiceService = invoiceService;
    }

    /// <summary>
    /// Get the official Egyptian ETA tax invoice / receipt for a specific order.
    /// Accessible to order buyer, merchant, and admin.
    /// </summary>
    [HttpGet("order/{orderId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(TaxInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaxInvoiceDto>> GetInvoiceByOrder(int orderId)
    {
        var invoice = await _invoiceService.GetInvoiceByOrderIdAsync(orderId);
        if (invoice == null)
            return NotFound(new { error = $"No tax invoice found for order {orderId}." });

        return Ok(invoice);
    }

    /// <summary>
    /// Get a tax invoice by its ID.
    /// </summary>
    [HttpGet("{id:int}")]
    [Authorize]
    [ProducesResponseType(typeof(TaxInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaxInvoiceDto>> GetInvoiceById(int id)
    {
        var invoice = await _invoiceService.GetInvoiceByIdAsync(id);
        if (invoice == null)
            return NotFound(new { error = $"Tax invoice {id} not found." });

        return Ok(invoice);
    }
}
