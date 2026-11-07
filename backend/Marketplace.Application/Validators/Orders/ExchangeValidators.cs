using FluentValidation;
using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.Validators.Orders;

public class CreateExchangeRequestValidator : AbstractValidator<CreateExchangeRequest>
{
    public CreateExchangeRequestValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0).WithMessage("OrderId must be greater than 0");
        RuleFor(x => x.OrderItemId).GreaterThan(0).WithMessage("OrderItemId must be greater than 0");
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500).WithMessage("Reason is required and cannot exceed 500 characters");
        RuleFor(x => x.RequestedSize).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.RequestedSize));
        RuleFor(x => x.RequestedColor).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.RequestedColor));
    }
}

public class ResolveExchangeRequestValidator : AbstractValidator<ResolveExchangeRequest>
{
    public ResolveExchangeRequestValidator()
    {
        RuleFor(x => x.RejectionReason).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.RejectionReason));
        RuleFor(x => x.ReplacementTrackingNumber).MaximumLength(100).When(x => !string.IsNullOrEmpty(x.ReplacementTrackingNumber));
    }
}
