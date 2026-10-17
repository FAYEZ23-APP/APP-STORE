using System.Text.RegularExpressions;
using FluentValidation;
using Marketplace.Application.DTOs.Users;

namespace Marketplace.Application.Validators.Users;

public static class EgyptianPhoneValidation
{
    /// <summary>
    /// Egyptian mobile number regex: matches +201xxxxxxxxx, 01xxxxxxxxx, or 1xxxxxxxxx (networks: 010, 011, 012, 015)
    /// with optional spaces or hyphens.
    /// </summary>
    public static readonly Regex PhoneRegex = new(@"^(?:\+20[\s-]?|0)?1[0125](?:[\s-]?\d){8}$", RegexOptions.Compiled);
}

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .Length(2, 100).WithMessage("Name must be between 2 and 100 characters.");

        RuleFor(x => x.DispatchCity)
            .MaximumLength(100)
            .When(x => !string.IsNullOrWhiteSpace(x.DispatchCity));

        RuleFor(x => x.DispatchAddress)
            .MaximumLength(300)
            .When(x => !string.IsNullOrWhiteSpace(x.DispatchAddress));

        RuleFor(x => x.ContactPhone)
            .Matches(EgyptianPhoneValidation.PhoneRegex)
            .When(x => !string.IsNullOrWhiteSpace(x.ContactPhone))
            .WithMessage("ContactPhone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");
    }
}

public class SellerProfileDtoValidator : AbstractValidator<SellerProfileDto>
{
    public SellerProfileDtoValidator()
    {
        RuleFor(x => x.DispatchCity)
            .NotEmpty().WithMessage("DispatchCity is required.")
            .Length(2, 100).WithMessage("DispatchCity must be between 2 and 100 characters.");

        RuleFor(x => x.DispatchAddress)
            .MaximumLength(300)
            .When(x => !string.IsNullOrWhiteSpace(x.DispatchAddress));

        RuleFor(x => x.ContactPhone)
            .Matches(EgyptianPhoneValidation.PhoneRegex)
            .When(x => !string.IsNullOrWhiteSpace(x.ContactPhone))
            .WithMessage("ContactPhone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");
    }
}

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Current password is required.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("New password is required.")
            .MinimumLength(6).WithMessage("New password must be at least 6 characters.")
            .MaximumLength(100).WithMessage("New password cannot exceed 100 characters.");
    }
}

public class CreateUserAddressRequestValidator : AbstractValidator<CreateUserAddressRequest>
{
    public CreateUserAddressRequestValidator()
    {
        RuleFor(x => x.Label)
            .MaximumLength(50)
            .When(x => !string.IsNullOrWhiteSpace(x.Label));

        RuleFor(x => x.RecipientName)
            .NotEmpty().WithMessage("RecipientName is required.")
            .Length(2, 100).WithMessage("RecipientName must be between 2 and 100 characters.");

        RuleFor(x => x.RecipientPhone)
            .NotEmpty().WithMessage("RecipientPhone is required.")
            .Matches(EgyptianPhoneValidation.PhoneRegex)
            .WithMessage("RecipientPhone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");

        RuleFor(x => x.Governorate)
            .NotEmpty().WithMessage("Governorate is required.")
            .Length(2, 100).WithMessage("Governorate must be between 2 and 100 characters.");

        RuleFor(x => x.City)
            .NotEmpty().WithMessage("City is required.")
            .Length(2, 100).WithMessage("City must be between 2 and 100 characters.");

        RuleFor(x => x.Area)
            .NotEmpty().WithMessage("Area is required.")
            .Length(2, 100).WithMessage("Area must be between 2 and 100 characters.");

        RuleFor(x => x.StreetBuilding)
            .NotEmpty().WithMessage("StreetBuilding is required.")
            .Length(2, 300).WithMessage("StreetBuilding must be between 2 and 300 characters.");
    }
}

public class UpdateUserAddressRequestValidator : AbstractValidator<UpdateUserAddressRequest>
{
    public UpdateUserAddressRequestValidator()
    {
        RuleFor(x => x.Label)
            .MaximumLength(50)
            .When(x => !string.IsNullOrWhiteSpace(x.Label));

        RuleFor(x => x.RecipientName)
            .NotEmpty().WithMessage("RecipientName is required.")
            .Length(2, 100).WithMessage("RecipientName must be between 2 and 100 characters.");

        RuleFor(x => x.RecipientPhone)
            .NotEmpty().WithMessage("RecipientPhone is required.")
            .Matches(EgyptianPhoneValidation.PhoneRegex)
            .WithMessage("RecipientPhone must be a valid Egyptian mobile number (e.g. 01012345678 or +201012345678).");

        RuleFor(x => x.Governorate)
            .NotEmpty().WithMessage("Governorate is required.")
            .Length(2, 100).WithMessage("Governorate must be between 2 and 100 characters.");

        RuleFor(x => x.City)
            .NotEmpty().WithMessage("City is required.")
            .Length(2, 100).WithMessage("City must be between 2 and 100 characters.");

        RuleFor(x => x.Area)
            .NotEmpty().WithMessage("Area is required.")
            .Length(2, 100).WithMessage("Area must be between 2 and 100 characters.");

        RuleFor(x => x.StreetBuilding)
            .NotEmpty().WithMessage("StreetBuilding is required.")
            .Length(2, 300).WithMessage("StreetBuilding must be between 2 and 300 characters.");
    }
}

public class DeleteAccountRequestValidator : AbstractValidator<DeleteAccountRequest>
{
    public DeleteAccountRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.CurrentPassword) || !string.IsNullOrWhiteSpace(x.GoogleIdToken))
            .WithMessage("Either CurrentPassword or GoogleIdToken is required to delete account.");
    }
}
