namespace Marketplace.Domain.Entities;

public class TaxInvoice
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public int? SellerId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string EtaUuid { get; set; } = string.Empty;
    public string InvoiceType { get; set; } = "Receipt"; // Receipt or TaxInvoice
    public decimal SubtotalAmount { get; set; }
    public decimal VatRate { get; set; } = 14.00m;
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string QrCodePayload { get; set; } = string.Empty;
    public string Status { get; set; } = "Issued"; // Issued, SubmittedToEta
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    public Order Order { get; set; } = null!;
    public Shipment? Shipment { get; set; }
    public User? Seller { get; set; }
}
