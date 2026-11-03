using FluentValidation;
using Marketplace.Application.DTOs.Privacy;

namespace Marketplace.Application.Validators.Privacy;

public class CreatePrivacyIncidentRequestValidator : AbstractValidator<CreatePrivacyIncidentRequest>
{
    public CreatePrivacyIncidentRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Incident title is required.")
            .MaximumLength(200).WithMessage("Incident title cannot exceed 200 characters.");

        RuleFor(x => x.NatureOfBreach)
            .NotEmpty().WithMessage("Nature of breach is required.")
            .MaximumLength(2000).WithMessage("Nature of breach cannot exceed 2000 characters.");

        RuleFor(x => x.AffectedDataCategories)
            .NotEmpty().WithMessage("Affected data categories must be specified.")
            .MaximumLength(1000).WithMessage("Affected data categories cannot exceed 1000 characters.");

        RuleFor(x => x.EstimatedAffectedCount)
            .GreaterThanOrEqualTo(0).WithMessage("Estimated affected subjects count cannot be negative.");
    }
}

public class UpdatePrivacyIncidentRequestValidator : AbstractValidator<UpdatePrivacyIncidentRequest>
{
    public UpdatePrivacyIncidentRequestValidator()
    {
        RuleFor(x => x.ContainmentActions)
            .MaximumLength(2000).WithMessage("Containment actions cannot exceed 2000 characters.")
            .When(x => !string.IsNullOrEmpty(x.ContainmentActions));

        RuleFor(x => x.RemediationActions)
            .MaximumLength(2000).WithMessage("Remediation actions cannot exceed 2000 characters.")
            .When(x => !string.IsNullOrEmpty(x.RemediationActions));

        RuleFor(x => x.CenterReferenceNumber)
            .MaximumLength(100).WithMessage("Center reference number cannot exceed 100 characters.")
            .When(x => !string.IsNullOrEmpty(x.CenterReferenceNumber));
    }
}

public class PrivacyExportRequestValidator : AbstractValidator<PrivacyExportRequest>
{
    public PrivacyExportRequestValidator()
    {
        RuleFor(x => x.Format)
            .NotEmpty().WithMessage("Export format is required.")
            .Must(f => f.Equals("json", StringComparison.OrdinalIgnoreCase) || f.Equals("csv", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Export format must be either 'json' or 'csv'.");
    }
}
