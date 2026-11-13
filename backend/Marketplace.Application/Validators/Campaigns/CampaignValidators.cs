using FluentValidation;
using Marketplace.Application.DTOs.Campaigns;

namespace Marketplace.Application.Validators.Campaigns;

public class CreateCampaignRequestValidator : AbstractValidator<CreateCampaignRequest>
{
    public CreateCampaignRequestValidator()
    {
        RuleFor(x => x.TitleAr)
            .NotEmpty().WithMessage("Arabic title is required.")
            .MaximumLength(150).WithMessage("Arabic title must not exceed 150 characters.");

        RuleFor(x => x.TitleEn)
            .NotEmpty().WithMessage("English title is required.")
            .MaximumLength(150).WithMessage("English title must not exceed 150 characters.");

        RuleFor(x => x.SubtitleAr)
            .MaximumLength(300).WithMessage("Arabic subtitle must not exceed 300 characters.");

        RuleFor(x => x.SubtitleEn)
            .MaximumLength(300).WithMessage("English subtitle must not exceed 300 characters.");

        RuleFor(x => x.CtaAr)
            .MaximumLength(80).WithMessage("Arabic CTA must not exceed 80 characters.");

        RuleFor(x => x.CtaEn)
            .MaximumLength(80).WithMessage("English CTA must not exceed 80 characters.");

        RuleFor(x => x.BadgeAr)
            .MaximumLength(50).WithMessage("Arabic badge must not exceed 50 characters.");

        RuleFor(x => x.BadgeEn)
            .MaximumLength(50).WithMessage("English badge must not exceed 50 characters.");

        RuleFor(x => x.ImageUrlMobile)
            .NotEmpty().WithMessage("Mobile image URL is required.")
            .MaximumLength(1000).WithMessage("Mobile image URL must not exceed 1000 characters.");

        RuleFor(x => x.ImageUrlDesktop)
            .MaximumLength(1000).WithMessage("Desktop image URL must not exceed 1000 characters.");

        RuleFor(x => x.TargetUrl)
            .MaximumLength(1000).WithMessage("Target URL must not exceed 1000 characters.");

        RuleFor(x => x.Priority)
            .GreaterThanOrEqualTo(0).WithMessage("Priority must be zero or positive.");

        RuleFor(x => x.OverlayOpacity)
            .InclusiveBetween(0.0m, 1.0m).WithMessage("Overlay opacity must be between 0.0 and 1.0.");

        RuleFor(x => x.TextAlignment)
            .Must(a => string.IsNullOrEmpty(a) || a.ToLowerInvariant() is "left" or "center" or "right")
            .WithMessage("Text alignment must be 'left', 'center', or 'right'.");
    }
}

public class UpdateCampaignRequestValidator : AbstractValidator<UpdateCampaignRequest>
{
    public UpdateCampaignRequestValidator()
    {
        RuleFor(x => x.TitleAr)
            .MaximumLength(150).WithMessage("Arabic title must not exceed 150 characters.")
            .When(x => !string.IsNullOrEmpty(x.TitleAr));

        RuleFor(x => x.TitleEn)
            .MaximumLength(150).WithMessage("English title must not exceed 150 characters.")
            .When(x => !string.IsNullOrEmpty(x.TitleEn));

        RuleFor(x => x.SubtitleAr)
            .MaximumLength(300).WithMessage("Arabic subtitle must not exceed 300 characters.")
            .When(x => !string.IsNullOrEmpty(x.SubtitleAr));

        RuleFor(x => x.SubtitleEn)
            .MaximumLength(300).WithMessage("English subtitle must not exceed 300 characters.")
            .When(x => !string.IsNullOrEmpty(x.SubtitleEn));

        RuleFor(x => x.CtaAr)
            .MaximumLength(80).WithMessage("Arabic CTA must not exceed 80 characters.")
            .When(x => !string.IsNullOrEmpty(x.CtaAr));

        RuleFor(x => x.CtaEn)
            .MaximumLength(80).WithMessage("English CTA must not exceed 80 characters.")
            .When(x => !string.IsNullOrEmpty(x.CtaEn));

        RuleFor(x => x.BadgeAr)
            .MaximumLength(50).WithMessage("Arabic badge must not exceed 50 characters.")
            .When(x => !string.IsNullOrEmpty(x.BadgeAr));

        RuleFor(x => x.BadgeEn)
            .MaximumLength(50).WithMessage("English badge must not exceed 50 characters.")
            .When(x => !string.IsNullOrEmpty(x.BadgeEn));

        RuleFor(x => x.ImageUrlMobile)
            .MaximumLength(1000).WithMessage("Mobile image URL must not exceed 1000 characters.")
            .When(x => !string.IsNullOrEmpty(x.ImageUrlMobile));

        RuleFor(x => x.ImageUrlDesktop)
            .MaximumLength(1000).WithMessage("Desktop image URL must not exceed 1000 characters.")
            .When(x => !string.IsNullOrEmpty(x.ImageUrlDesktop));

        RuleFor(x => x.TargetUrl)
            .MaximumLength(1000).WithMessage("Target URL must not exceed 1000 characters.")
            .When(x => !string.IsNullOrEmpty(x.TargetUrl));

        RuleFor(x => x.Priority)
            .GreaterThanOrEqualTo(0).WithMessage("Priority must be zero or positive.")
            .When(x => x.Priority.HasValue);

        RuleFor(x => x.OverlayOpacity)
            .InclusiveBetween(0.0m, 1.0m).WithMessage("Overlay opacity must be between 0.0 and 1.0.")
            .When(x => x.OverlayOpacity.HasValue);

        RuleFor(x => x.TextAlignment)
            .Must(a => string.IsNullOrEmpty(a) || a.ToLowerInvariant() is "left" or "center" or "right")
            .WithMessage("Text alignment must be 'left', 'center', or 'right'.")
            .When(x => !string.IsNullOrEmpty(x.TextAlignment));
    }
}

public class ReorderCampaignsRequestValidator : AbstractValidator<ReorderCampaignsRequest>
{
    public ReorderCampaignsRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotNull().WithMessage("Items list is required.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Id).GreaterThan(0).WithMessage("Campaign ID must be positive.");
            item.RuleFor(i => i.Priority).GreaterThanOrEqualTo(0).WithMessage("Priority must be zero or positive.");
        });
    }
}
