using FluentValidation;
using Marketplace.Application.DTOs.Coupons;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Coupons;

public class CreateCouponRequestValidator : AbstractValidator<CreateCouponRequest>
{
    public CreateCouponRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Coupon code is required.")
            .MaximumLength(50).WithMessage("Coupon code must not exceed 50 characters.")
            .Matches(@"^[A-Za-z0-9_\-]+$").WithMessage("Coupon code must contain only letters, numbers, hyphens, or underscores.");

        RuleFor(x => x.DiscountValue)
            .GreaterThan(0).WithMessage("Discount value must be greater than 0.");

        RuleFor(x => x.DiscountValue)
            .LessThanOrEqualTo(100).WithMessage("Percentage discount cannot exceed 100%.")
            .When(x => x.DiscountType == DiscountType.Percentage);

        RuleFor(x => x.MinOrderSubtotal)
            .GreaterThanOrEqualTo(0).WithMessage("Minimum order subtotal must be greater than or equal to 0.");

        RuleFor(x => x.MaxDiscountAmount)
            .GreaterThan(0).WithMessage("Max discount amount must be greater than 0 when specified.")
            .When(x => x.MaxDiscountAmount.HasValue);

        RuleFor(x => x.MaxUsage)
            .GreaterThan(0).WithMessage("Max usage must be greater than 0.");

        RuleFor(x => x.PerUserLimit)
            .GreaterThan(0).WithMessage("Per-user limit must be greater than 0.");

        RuleFor(x => x.ExpiresAt)
            .GreaterThan(DateTime.UtcNow).WithMessage("Expiration date must be in the future.");
    }
}

public class ValidateCouponRequestValidator : AbstractValidator<ValidateCouponRequest>
{
    public ValidateCouponRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Coupon code is required.");
    }
}
