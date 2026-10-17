namespace Marketplace.Domain.Entities;

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ShipmentId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int? VariantId { get; set; }
    public string? VariantSummary { get; set; }

    public Order Order { get; set; } = null!;
    public Shipment Shipment { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public ProductVariant? Variant { get; set; }
}
