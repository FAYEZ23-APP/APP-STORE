using System.Text.RegularExpressions;
using FluentValidation;
using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Users;

namespace Marketplace.Application.Validators.Users;

public static class EgyptianPhoneValidation
{
    /// <summary>
    /// Egyptian mobile number regex: matches +201xxxxxxxxx, 00201xxxxxxxxx, 01xxxxxxxxx, or 1xxxxxxxxx (networks: 010, 011, 012, 015)
    /// with optional spaces or hyphens.
    /// Also supports Eastern Arabic and Extended Arabic-Indic numerals directly.
    /// </summary>
    public static readonly Regex PhoneRegex = new(
        @"^(?:\+20[\s-]?|\+[2\u0662\u06F2][0\u0660\u06F0][\s-]?|0020[\s-]?|[0\u0660\u06F0]{2}[2\u0662\u06F2][0\u0660\u06F0][\s-]?|[0\u0660\u06F0])?[1\u0661\u06F1][0125\u0660\u0661\u0662\u0665\u06F0\u06F1\u06F2\u06F5](?:[\s-]?[0-9\u0660-\u0669\u06F0-\u06F9]){8}$",
        RegexOptions.Compiled);

    /// <summary>
    /// Validates whether the given string is a valid Egyptian mobile number.
    /// Automatically converts Eastern Arabic numerals (٠-٩) and Extended Arabic-Indic numerals (۰-۹) to ASCII before matching.
    /// </summary>
    public static bool IsValid(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return false;

        var ascii = EgyptianPhoneNormalizer.ToAsciiDigits(phone).Trim();
        return PhoneRegex.IsMatch(ascii);
    }
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
            .Must(EgyptianPhoneValidation.IsValid)
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
            .Must(EgyptianPhoneValidation.IsValid)
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
            .Must(EgyptianPhoneValidation.IsValid)
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

        RuleFor(x => x.BuildingNumber)
            .MaximumLength(50);

        RuleFor(x => x.Floor)
            .MaximumLength(50);

        RuleFor(x => x.Apartment)
            .MaximumLength(50);

        RuleFor(x => x.Landmark)
            .MaximumLength(200);

        RuleFor(x => x.FormattedAddress)
            .MaximumLength(500);

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90.0, 90.0)
            .When(x => x.Latitude != 0.0);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180.0, 180.0)
            .When(x => x.Longitude != 0.0);
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
            .Must(EgyptianPhoneValidation.IsValid)
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

        RuleFor(x => x.BuildingNumber)
            .MaximumLength(50);

        RuleFor(x => x.Floor)
            .MaximumLength(50);

        RuleFor(x => x.Apartment)
            .MaximumLength(50);

        RuleFor(x => x.Landmark)
            .MaximumLength(200);

        RuleFor(x => x.FormattedAddress)
            .MaximumLength(500);

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90.0, 90.0)
            .When(x => x.Latitude != 0.0);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180.0, 180.0)
            .When(x => x.Longitude != 0.0);
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


public class SubmitKybRequestValidator : AbstractValidator<SubmitKybRequest>
{
    public SubmitKybRequestValidator()
    {
        RuleFor(x => x.CommercialRegisterNumber)
            .MaximumLength(50);

        RuleFor(x => x.TaxCardNumber)
            .MaximumLength(50);

        RuleFor(x => x.NationalIdNumber)
            .MaximumLength(30);

        RuleFor(x => x.KybDocumentUrl)
            .MaximumLength(500);
    }
}

public class UpdateKybStatusRequestValidator : AbstractValidator<UpdateKybStatusRequest>
{
    public UpdateKybStatusRequestValidator()
    {
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .Must(s => new[] { "Verified", "Rejected", "Pending", "Unverified" }.Contains(s))
            .WithMessage("Status must be Verified, Rejected, Pending, or Unverified.");

        RuleFor(x => x.RejectionReason)
            .MaximumLength(500);
    }
}
