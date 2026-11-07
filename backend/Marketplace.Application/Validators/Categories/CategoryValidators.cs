using FluentValidation;
using Marketplace.Application.DTOs.Categories;

namespace Marketplace.Application.Validators.Categories;

public class CreateCategoryRequestValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryRequestValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty().WithMessage("Category key is required.")
            .Length(2, 50).WithMessage("Category key must be between 2 and 50 characters.")
            .Matches(@"^[a-zA-Z0-9_-]+$").WithMessage("Category key may only contain letters, numbers, underscores and hyphens.");

        RuleFor(x => x.IconName)
            .NotEmpty().WithMessage("Icon name is required.")
            .MaximumLength(50).WithMessage("Icon name must not exceed 50 characters.");

        RuleFor(x => x.NameAr)
            .MaximumLength(100).WithMessage("Arabic name must not exceed 100 characters.");

        RuleFor(x => x.NameEn)
            .MaximumLength(100).WithMessage("English name must not exceed 100 characters.");

        RuleFor(x => x.DisplayOrder)
            .GreaterThanOrEqualTo(0).WithMessage("Display order must be zero or positive.");
    }
}

public class UpdateCategoryRequestValidator : AbstractValidator<UpdateCategoryRequest>
{
    public UpdateCategoryRequestValidator()
    {
        RuleFor(x => x.Key)
            .Length(2, 50).WithMessage("Category key must be between 2 and 50 characters.")
            .Matches(@"^[a-zA-Z0-9_-]+$").WithMessage("Category key may only contain letters, numbers, underscores and hyphens.")
            .When(x => !string.IsNullOrEmpty(x.Key));

        RuleFor(x => x.IconName)
            .MaximumLength(50).WithMessage("Icon name must not exceed 50 characters.")
            .When(x => !string.IsNullOrEmpty(x.IconName));

        RuleFor(x => x.NameAr)
            .MaximumLength(100).WithMessage("Arabic name must not exceed 100 characters.")
            .When(x => !string.IsNullOrEmpty(x.NameAr));

        RuleFor(x => x.NameEn)
            .MaximumLength(100).WithMessage("English name must not exceed 100 characters.")
            .When(x => !string.IsNullOrEmpty(x.NameEn));

        RuleFor(x => x.DisplayOrder)
            .GreaterThanOrEqualTo(0).WithMessage("Display order must be zero or positive.")
            .When(x => x.DisplayOrder.HasValue);
    }
}
