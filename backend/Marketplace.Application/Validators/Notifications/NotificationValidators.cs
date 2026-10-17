using FluentValidation;
using Marketplace.Application.DTOs.Notifications;

namespace Marketplace.Application.Validators.Notifications;

public class RegisterDeviceTokenRequestValidator : AbstractValidator<RegisterDeviceTokenRequest>
{
    public RegisterDeviceTokenRequestValidator()
    {
        RuleFor(x => x.DeviceToken)
            .NotEmpty().WithMessage("رمز الجهاز (Device Token) مطلوب.")
            .MaximumLength(500).WithMessage("رمز الجهاز طويل جداً.");

        RuleFor(x => x.Platform)
            .NotEmpty()
            .MaximumLength(50);
    }
}
