using FluentValidation;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(200);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(6)
            .MaximumLength(100);

        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(r => string.Equals(r, nameof(UserRole.Buyer), StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(r, nameof(UserRole.Seller), StringComparison.OrdinalIgnoreCase))
            .WithMessage("Role must be either 'Buyer' or 'Seller'.");

        RuleFor(x => x.AcceptedTermsAndPrivacy)
            .Equal(true)
            .WithMessage("الموافقة الصريحة على الشروط وسياسة الخصوصية مطلوبة للتسجيل (وفقاً للقانون المصري رقم 151 لسنة 2020 لحماية البيانات الشخصية).");
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class GoogleAuthRequestValidator : AbstractValidator<GoogleAuthRequest>
{
    public GoogleAuthRequestValidator()
    {
        RuleFor(x => x.IdToken)
            .NotEmpty()
            .WithMessage("Google ID Token is required.");

        RuleFor(x => x.Role)
            .Must(r => string.IsNullOrEmpty(r) ||
                       string.Equals(r, nameof(UserRole.Buyer), StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(r, nameof(UserRole.Seller), StringComparison.OrdinalIgnoreCase))
            .WithMessage("Role must be either 'Buyer' or 'Seller'.");
    }
}

