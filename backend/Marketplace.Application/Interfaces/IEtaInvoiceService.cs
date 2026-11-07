using Marketplace.Application.DTOs.Invoices;

namespace Marketplace.Application.Interfaces;

public interface IEtaInvoiceService
{
    Task<TaxInvoiceDto> GenerateInvoiceForOrderAsync(int orderId, string invoiceType = "Receipt");
    Task<TaxInvoiceDto?> GetInvoiceByOrderIdAsync(int orderId);
    Task<TaxInvoiceDto?> GetInvoiceByIdAsync(int invoiceId);
}
