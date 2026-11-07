using FluentValidation;
using Marketplace.Application.DTOs.Delivery;

namespace Marketplace.Application.Validators.Delivery;

public class DeliveryTariffRequestValidator : AbstractValidator<DeliveryTariffRequest>
{
    public DeliveryTariffRequestValidator()
    {
        RuleFor(x => x.FromCity)
            .NotEmpty().WithMessage("Origin city is required.")
            .MaximumLength(100).WithMessage("Origin city must not exceed 100 characters.");

        RuleFor(x => x.ToCity)
            .NotEmpty().WithMessage("Destination city is required.")
            .MaximumLength(100).WithMessage("Destination city must not exceed 100 characters.");

        RuleFor(x => x.TotalWeightGrams)
            .GreaterThan(0).WithMessage("Total weight in grams must be greater than zero.");
    }
}

public class CreateCarrierShipmentRequestValidator : AbstractValidator<CreateCarrierShipmentRequest>
{
    public CreateCarrierShipmentRequestValidator()
    {
        RuleFor(x => x.SellerId)
            .GreaterThan(0).WithMessage("Seller ID must be greater than zero.");

        RuleFor(x => x.FromCity)
            .NotEmpty().WithMessage("Origin city is required.")
            .MaximumLength(100).WithMessage("Origin city must not exceed 100 characters.");

        RuleFor(x => x.ToCity)
            .NotEmpty().WithMessage("Destination city is required.")
            .MaximumLength(100).WithMessage("Destination city must not exceed 100 characters.");

        RuleFor(x => x.TotalWeightGrams)
            .GreaterThan(0).WithMessage("Total weight in grams must be greater than zero.");
    }
}
