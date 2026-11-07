using FluentValidation;
using Marketplace.Application.DTOs.Shipping;

namespace Marketplace.Application.Validators.Shipping;

public class CalculateShippingFeeRequestValidator : AbstractValidator<CalculateShippingFeeRequest>
{
    public CalculateShippingFeeRequestValidator()
    {
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90.0, 90.0)
            .WithMessage("Destination latitude must be between -90 and 90 degrees.");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180.0, 180.0)
            .WithMessage("Destination longitude must be between -180 and 180 degrees.");

        RuleFor(x => x.OriginLatitude)
            .InclusiveBetween(-90.0, 90.0)
            .When(x => x.OriginLatitude.HasValue)
            .WithMessage("Origin latitude must be between -90 and 90 degrees when provided.");

        RuleFor(x => x.OriginLongitude)
            .InclusiveBetween(-180.0, 180.0)
            .When(x => x.OriginLongitude.HasValue)
            .WithMessage("Origin longitude must be between -180 and 180 degrees when provided.");
    }
}
