const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.API/Controllers/AdminController.cs', 'utf8');

// 1. Add using Marketplace.Application.DTOs.Invoices; if not present
if (!content.includes('using Marketplace.Application.DTOs.Invoices;')) {
    content = 'using Marketplace.Application.DTOs.Invoices;\r\n' + content;
}

// 2. Add field _etaInvoiceService
if (!content.includes('_etaInvoiceService;')) {
    content = content.replace(
        '    private readonly IFulfillmentSlaService _slaService;',
        '    private readonly IFulfillmentSlaService _slaService;\r\n    private readonly IEtaInvoiceService _etaInvoiceService;'
    );
}

// 3. Add to constructor
if (!content.includes('IEtaInvoiceService etaInvoiceService')) {
    content = content.replace(
        '        IStepUpAuthService stepUpAuth,\r\n        IFulfillmentSlaService slaService)',
        '        IStepUpAuthService stepUpAuth,\r\n        IFulfillmentSlaService slaService,\r\n        IEtaInvoiceService etaInvoiceService)'
    );
    content = content.replace(
        '        _slaService = slaService;\r\n    }',
        '        _slaService = slaService;\r\n        _etaInvoiceService = etaInvoiceService;\r\n    }'
    );
}

// 4. Add action endpoint at bottom before the closing brace
const endpointCode = `
    /// <summary>Generate official Egyptian ETA e-invoice/receipt for an order. (Admin only)</summary>
    [HttpPost("invoices/generate/{orderId:int}")]
    [ProducesResponseType(typeof(TaxInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaxInvoiceDto>> GenerateInvoiceForOrder(int orderId, [FromBody] GenerateInvoiceRequest? request = null)
    {
        var type = request?.InvoiceType ?? "Receipt";
        var invoice = await _etaInvoiceService.GenerateInvoiceForOrderAsync(orderId, type);
        return Ok(invoice);
    }
`;

if (!content.includes('GenerateInvoiceForOrder')) {
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + endpointCode + '\r\n}\r\n';
}

fs.writeFileSync('backend/Marketplace.API/Controllers/AdminController.cs', content, 'utf8');
console.log('Successfully updated AdminController.cs');
