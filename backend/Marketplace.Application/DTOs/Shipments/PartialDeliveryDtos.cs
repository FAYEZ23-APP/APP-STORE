namespace Marketplace.Application.DTOs.Shipments;

public class PartialDeliveryRequest
{
    public List<PartialDeliveryItemRequest> Items { get; set; } = new();
}

public class PartialDeliveryItemRequest
{
    public int OrderItemId { get; set; }
    public int AcceptedQuantity { get; set; }
    public int RefusedQuantity { get; set; }
}
