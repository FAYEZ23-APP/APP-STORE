namespace Marketplace.Domain.Enums;

public enum ShipmentStatus
{
    Created,
    HandedToCarrier,
    InTransit,
    ReadyForPickup,
    Delivered,
    Cancelled,
    Returned
}
