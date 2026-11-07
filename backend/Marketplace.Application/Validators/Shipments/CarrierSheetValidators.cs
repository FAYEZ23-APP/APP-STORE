using FluentValidation;
using Marketplace.Application.DTOs.Shipments;

namespace Marketplace.Application.Validators.Shipments;

public class ReconcileCarrierSheetRequestValidator : AbstractValidator<ReconcileCarrierSheetRequest>
{
    public ReconcileCarrierSheetRequestValidator()
    {
        RuleFor(x => x.CarrierName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.BatchReference).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Items).NotNull();
    }
}

public class CarrierSheetItemRequestValidator : AbstractValidator<CarrierSheetItemRequest>
{
    public CarrierSheetItemRequestValidator()
    {
        RuleFor(x => x.TrackingNumber).NotEmpty().MaximumLength(100);
        RuleFor(x => x.CollectedAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ShippingFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(50);
    }
}

public class PartialDeliveryRequestValidator : AbstractValidator<PartialDeliveryRequest>
{
    public PartialDeliveryRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item must be specified for partial delivery");
    }
}

public class PartialDeliveryItemRequestValidator : AbstractValidator<PartialDeliveryItemRequest>
{
    public PartialDeliveryItemRequestValidator()
    {
        RuleFor(x => x.OrderItemId).GreaterThan(0);
        RuleFor(x => x.AcceptedQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RefusedQuantity).GreaterThanOrEqualTo(0);
    }
}
