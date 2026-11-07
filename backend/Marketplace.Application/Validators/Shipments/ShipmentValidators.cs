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

public class AdminUpdateShipmentStatusRequestValidator : AbstractValidator<AdminUpdateShipmentStatusRequest>
{
    public AdminUpdateShipmentStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .IsEnumName(typeof(ShipmentStatus), caseSensitive: false)
            .WithMessage("Status must be a valid ShipmentStatus.");

        RuleFor(x => x.ReturnReason)
            .IsEnumName(typeof(ReturnReason), caseSensitive: false)
            .WithMessage("ReturnReason must be a valid ReturnReason.")
            .When(x => !string.IsNullOrEmpty(x.ReturnReason));

        RuleFor(x => x.TrackingNumber)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.TrackingNumber));

        RuleFor(x => x.ReceivedAmount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Received amount cannot be negative.")
            .When(x => x.ReceivedAmount.HasValue);

        RuleFor(x => x.SettlementReference)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.SettlementReference));

        RuleFor(x => x.AdminNotes)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.AdminNotes));
    }
}

public class RemittanceItemRequestValidator : AbstractValidator<RemittanceItemRequest>
{
    public RemittanceItemRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.TrackingNumber) || x.ShipmentId.HasValue)
            .WithMessage("Either TrackingNumber or ShipmentId must be provided.");

        RuleFor(x => x.CollectedAmount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Collected amount cannot be negative.");
    }
}

public class SettleRemittanceBatchRequestValidator : AbstractValidator<SettleRemittanceBatchRequest>
{
    public SettleRemittanceBatchRequestValidator()
    {
        RuleFor(x => x.BatchReference)
            .NotEmpty().WithMessage("BatchReference is required.")
            .MaximumLength(100);

        RuleFor(x => x.Items)
            .NotNull().WithMessage("Items list is required.")
            .Must(x => x != null && x.Count > 0).WithMessage("At least one remittance item is required.");

        RuleForEach(x => x.Items).SetValidator(new RemittanceItemRequestValidator());
    }
}

public class UpdateCourierDetailsRequestValidator : AbstractValidator<UpdateCourierDetailsRequest>
{
    public UpdateCourierDetailsRequestValidator()
    {
        RuleFor(x => x.CourierName)
            .MaximumLength(150);
        RuleFor(x => x.CourierPhone)
            .MaximumLength(30);
    }
}
}
