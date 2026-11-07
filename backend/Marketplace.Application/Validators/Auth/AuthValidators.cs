using FluentValidation;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Validators.Users;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Validators.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Email) || !string.IsNullOrWhiteSpace(x.Phone))
            .WithMessage("Either email or phone is required.");

        RuleFor(x => x.Email)
            .EmailAddress()
            .MaximumLength(200)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Phone)
            .Must(EgyptianPhoneValidation.IsValid)
            .WithMessage("Phone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone));

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(6)
            .MaximumLength(100);

        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(r => string.Equals(r, nameof(UserRole.Buyer), StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(r, nameof(UserRole.Seller), StringComparison.OrdinalIgnoreCase))
            .WithMessage("Role must be either 'Buyer' or 'Seller'. Admin role is forbidden.");

        RuleFor(x => x.AcceptedTermsAndPrivacy)
            .Equal(true)
            .WithMessage("الموافقة الصريحة على الشروط وسياسة الخصوصية مطلوبة للتسجيل (وفقاً للقانون المصري رقم 151 لسنة 2020 لحماية البيانات الشخصية).");
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.GetEffectiveIdentifier()))
            .WithMessage("Email or phone identifier is required.");

        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Password is required.");
    }
}

public class VerifyRequestValidator : AbstractValidator<VerifyRequest>
{
    public VerifyRequestValidator()
    {
        RuleFor(x => x.Target)
            .NotEmpty()
            .WithMessage("Target (email or phone) is required.");

        RuleFor(x => x.Code)
            .NotEmpty()
            .Length(6)
            .Length(6).Must(c => c != null && c.All(char.IsDigit))
            .WithMessage("Verification code must be exactly 6 digits.");
    }
}

public class ResendCodeRequestValidator : AbstractValidator<ResendCodeRequest>
{
    public ResendCodeRequestValidator()
    {
        RuleFor(x => x.Target)
            .NotEmpty()
            .WithMessage("Target (email or phone) is required.");
    }
}

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty()
            .WithMessage("Identifier (email or phone) is required.");
    }
}

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Identifier)
            .NotEmpty()
            .WithMessage("Identifier (email or phone) is required.");

        RuleFor(x => x.Code)
            .NotEmpty()
            .Length(6)
            .Length(6).Must(c => c != null && c.All(char.IsDigit))
            .WithMessage("Verification code must be exactly 6 digits.");

        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(6)
            .MaximumLength(100)
            .WithMessage("New password must be at least 6 characters long.");
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

public class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator(Microsoft.AspNetCore.Http.IHttpContextAccessor? httpContextAccessor = null)
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .When(_ =>
            {
                var httpContext = httpContextAccessor?.HttpContext;
                if (httpContext == null) return true;
                var hasCookie = httpContext.Request.Cookies.ContainsKey("__Host-refresh_token") ||
                                httpContext.Request.Cookies.ContainsKey("refresh_token");
                return !hasCookie;
            })
            .WithMessage("Refresh token is required.");

        RuleFor(x => x.DeviceId)
            .NotEmpty()
            .WithMessage("Device ID is required.");
    }

public class LogoutRequestValidator : AbstractValidator<LogoutRequest>
{
    public LogoutRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.RefreshToken));

        RuleFor(x => x.DeviceToken)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.DeviceToken));
    }
}

public class TwoFactorVerifyRequestValidator : AbstractValidator<TwoFactorVerifyRequest>
{
    public TwoFactorVerifyRequestValidator()
    {
        RuleFor(x => x.TwoFactorToken)
            .NotEmpty()
            .MaximumLength(500)
            .WithMessage("Two-factor authentication token is required.");

        RuleFor(x => x.Code)
            .NotEmpty()
            .Matches("^[0-9]{6}$")
            .WithMessage("Two-factor code must be a 6-digit numeric code.");
    }
}

public class TwoFactorEnableRequestValidator : AbstractValidator<TwoFactorEnableRequest>
{
    public TwoFactorEnableRequestValidator()
    {
        RuleFor(x => x.Secret)
            .NotEmpty()
            .Length(16, 64)
            .WithMessage("Two-factor secret is required.");

        RuleFor(x => x.Code)
            .NotEmpty()
            .Matches("^[0-9]{6}$")
            .WithMessage("Two-factor code must be a 6-digit numeric code.");
    }
}

public class TwoFactorDisableRequestValidator : AbstractValidator<TwoFactorDisableRequest>
{
    public TwoFactorDisableRequestValidator()
    {
        RuleFor(x => x.Password)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("Current password is required to disable two-factor authentication.");
    }
}

public class StepUpChallengeRequestValidator : AbstractValidator<StepUpChallengeRequest>
{
    public StepUpChallengeRequestValidator()
    {
        RuleFor(x => x.Password)
            .NotEmpty()
            .WithMessage("Admin step-up password is required.");

        RuleFor(x => x.Scope)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage("Operation scope is required.");

        RuleFor(x => x.TotpCode)
            .Matches("^[0-9]{6}$")
            .When(x => !string.IsNullOrEmpty(x.TotpCode))
            .WithMessage("TOTP code must be a 6-digit numeric string.");

        RuleFor(x => x.TargetEntity)
            .MaximumLength(100);
    }
}

}
