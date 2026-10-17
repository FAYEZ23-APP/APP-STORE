using FluentValidation;
using Marketplace.Application.DTOs.Reviews;

namespace Marketplace.Application.Validators.Reviews;

public class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(x => x.ProductId)
            .GreaterThan(0).WithMessage("معرف المنتج غير صحيح.");

        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5).WithMessage("التقييم يجب أن يكون بين 1 و 5 نجوم.");

        RuleFor(x => x.Comment)
            .MaximumLength(1000).WithMessage("نص التقييم لا يمكن أن يتجاوز 1000 حرف.");
    }
}
