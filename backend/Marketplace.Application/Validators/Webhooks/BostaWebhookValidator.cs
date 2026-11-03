using FluentValidation;
using Marketplace.Application.DTOs.Webhooks;

namespace Marketplace.Application.Validators.Webhooks;

public class BostaWebhookPayloadValidator : AbstractValidator<BostaWebhookPayload>
{
    public BostaWebhookPayloadValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.GetEffectiveTrackingNumber()))
            .WithMessage("TrackingNumber is required in webhook payload.");

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.GetEffectiveState()))
            .WithMessage("State or Status is required in webhook payload.");
    }
}
