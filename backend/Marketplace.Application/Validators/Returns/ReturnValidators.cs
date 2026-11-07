using FluentValidation;
using Marketplace.Application.DTOs.Returns;
using Marketplace.Application.Validators.Products;

namespace Marketplace.Application.Validators.Returns;

public class CreateReturnRequestValidator : AbstractValidator<CreateReturnRequest>
{
    private static readonly System.Text.RegularExpressions.Regex PrivateUploadUrlRegex = new(
        @"^/api/files/private/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp)$",
        System.Text.RegularExpressions.RegexOptions.Compiled | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

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
            .Must(IsValidDefectImageUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.DefectImageUrl))
            .WithMessage("DefectImageUrl must be a valid private file path '/api/files/private/<guid>.<ext>' or '/uploads/<guid>.<ext>'.");
    }

    public static bool IsValidDefectImageUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        var trimmed = url.Trim();
        if (trimmed.Contains("..")) return false;
        return PrivateUploadUrlRegex.IsMatch(trimmed) || CreateProductRequestValidator.IsValidImageUrl(trimmed);
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

public class ConfirmReturnReceivedRequestValidator : AbstractValidator<ConfirmReturnReceivedRequest>
{
    public ConfirmReturnReceivedRequestValidator()
    {
        RuleFor(x => x.Note)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.Note));
    }
}

public class DisputeReturnRequestValidator : AbstractValidator<DisputeReturnRequest>
{
    public DisputeReturnRequestValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Dispute reason is required.")
            .MaximumLength(500).WithMessage("Dispute reason must not exceed 500 characters.");

        RuleForEach(x => x.EvidenceUrls)
            .Must(CreateReturnRequestValidator.IsValidDefectImageUrl)
            .When(x => x.EvidenceUrls != null && x.EvidenceUrls.Count > 0)
            .WithMessage("Dispute evidence URL must be a valid upload URL.");
    }
}

public class ResolveReturnDisputeRequestValidator : AbstractValidator<ResolveReturnDisputeRequest>
{
    public ResolveReturnDisputeRequestValidator()
    {
        RuleFor(x => x.Decision)
            .NotEmpty().WithMessage("Decision is required.")
            .Must(d => d.Equals("FavorSeller", StringComparison.OrdinalIgnoreCase) ||
                       d.Equals("FavorBuyer", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Decision must be 'FavorSeller' or 'FavorBuyer'.");

        RuleFor(x => x.ResolutionNotes)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrEmpty(x.ResolutionNotes));
    }
}
