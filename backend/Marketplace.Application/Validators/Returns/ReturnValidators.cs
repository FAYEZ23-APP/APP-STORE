using FluentValidation;
using Marketplace.Application.DTOs.Returns;
using Marketplace.Application.Validators.Products;

namespace Marketplace.Application.Validators.Returns;

public class CreateReturnRequestValidator : AbstractValidator<CreateReturnRequest>
{
    public CreateReturnRequestValidator()
    {
        RuleFor(x => x.OrderItemId)
            .GreaterThan(0).WithMessage("OrderItemId is required.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Quantity must be greater than 0.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Return reason is required.")
            .MaximumLength(500).WithMessage("Return reason must not exceed 500 characters.");

        RuleFor(x => x.DefectImageUrl)
            .Must(CreateProductRequestValidator.IsValidImageUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.DefectImageUrl))
            .WithMessage("DefectImageUrl must be a valid path starting with /uploads/ or a valid http/https URL.");
    }
}

public class ResolveReturnRequestValidator : AbstractValidator<ResolveReturnRequest>
{
    public ResolveReturnRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .Must(s => s.Equals("Approved", StringComparison.OrdinalIgnoreCase) ||
                       s.Equals("Completed", StringComparison.OrdinalIgnoreCase) ||
                       s.Equals("Rejected", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Status must be 'Approved', 'Completed', or 'Rejected'.");
    }
}
