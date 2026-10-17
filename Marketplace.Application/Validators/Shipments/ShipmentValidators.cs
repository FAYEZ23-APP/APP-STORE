using FluentValidation;
using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Validators.Orders;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Shipments;

public class DeliveryQuoteRequestValidator : AbstractValidator<DeliveryQuoteRequest>
{
    public DeliveryQuoteRequestValidator(IDeliveryProvider deliveryProvider)
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Items cannot be empty.")
            .Must(items => items != null && items.Count > 0).WithMessage("Must provide at least one item.");

        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());

        RuleFor(x => x.DeliveryMethod)
            .NotEmpty().WithMessage("DeliveryMethod is required.")
            .IsEnumName(typeof(DeliveryMethod), caseSensitive: false)
            .WithMessage("DeliveryMethod must be 'Pickup' or 'Courier'.");

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.EffectiveCity) || !string.IsNullOrWhiteSpace(x.PickupPointId))
            .WithMessage("Either destination City or PickupPointId is required for a delivery quote.");

        When(x => !string.IsNullOrWhiteSpace(x.PickupPointId), () =>
        {
            RuleFor(x => x.PickupPointId)
                .MustAsync(async (pointId, ct) =>
                {
                    var point = await deliveryProvider.GetPickupPointByIdAsync(pointId!);
                    return point != null;
                })
                .WithMessage("Invalid PickupPointId.");
        });
    }
}

public class UpdateShipmentStatusRequestValidator : AbstractValidator<UpdateShipmentStatusRequest>
{
    public UpdateShipmentStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .IsEnumName(typeof(ShipmentStatus), caseSensitive: false)
            .WithMessage("Status must be a valid ShipmentStatus (e.g. HandedToCarrier, InTransit, ReadyForPickup, Delivered, Returned).");

        When(x => string.Equals(x.Status, nameof(ShipmentStatus.Returned), StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.ReturnReason)
                .NotEmpty().WithMessage("ReturnReason is required when status is 'Returned'.")
                .IsEnumName(typeof(ReturnReason), caseSensitive: false)
                .WithMessage("ReturnReason must be one of: RefusedByBuyer, Unreachable, WrongAddress, DamagedInTransit, Other.");
        });
    }
}
