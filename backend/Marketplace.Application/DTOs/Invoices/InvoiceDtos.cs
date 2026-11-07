namespace Marketplace.Application.DTOs.Invoices;

public class TaxInvoiceDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public int? SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string TaxRegistrationNumber { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public string EtaUuid { get; set; } = string.Empty;
    public string InvoiceType { get; set; } = "Receipt";
    public decimal SubtotalAmount { get; set; }
    public decimal VatRate { get; set; } = 14.00m;
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string QrCodePayload { get; set; } = string.Empty;
    public string Status { get; set; } = "Issued";
    public DateTime IssuedAt { get; set; }
}

public class GenerateInvoiceRequest
{
    public string InvoiceType { get; set; } = "Receipt";
}
