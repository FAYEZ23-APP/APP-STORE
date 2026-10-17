using FluentValidation;
using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Interfaces;

namespace Marketplace.Application.Validators.Products;

public class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator(IUnitOfWork uow)
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.OldPrice)
            .GreaterThan(0)
            .When(x => x.OldPrice.HasValue)
            .WithMessage("OldPrice must be greater than 0.");
        RuleFor(x => x.OldPrice)
            .GreaterThan(x => x.Price)
            .When(x => x.OldPrice.HasValue)
            .WithMessage("OldPrice must be greater than Price.");
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.WeightGrams)
            .GreaterThan(0)
            .WithMessage("WeightGrams is required and must be greater than 0.");
        RuleFor(x => x.LengthCm)
            .GreaterThan(0)
            .When(x => x.LengthCm.HasValue)
            .WithMessage("LengthCm must be greater than 0 when provided.");
        RuleFor(x => x.WidthCm)
            .GreaterThan(0)
            .When(x => x.WidthCm.HasValue)
            .WithMessage("WidthCm must be greater than 0 when provided.");
        RuleFor(x => x.HeightCm)
            .GreaterThan(0)
            .When(x => x.HeightCm.HasValue)
            .WithMessage("HeightCm must be greater than 0 when provided.");
        RuleForEach(x => x.ImageUrls)
            .Must(IsValidImageUrl)
            .WithMessage("Each ImageUrl must be a valid path starting with /uploads/ or a valid http/https URL without path traversal or private IP targets.");
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("CategoryId is required.")
            .MustAsync(async (catId, ct) => (await uow.Categories.GetByIdAsync(catId)) != null)
            .WithMessage("Category does not exist.");
    }

    public static bool IsValidImageUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        var trimmed = url.Trim();

        if (trimmed.Contains("..")) return false;
        if (trimmed.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return false;

        if (trimmed.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            var host = uri.Host.ToLowerInvariant();
            if (host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0" ||
                host.StartsWith("10.") || host.StartsWith("192.168.") || host.StartsWith("169.254."))
            {
                return false;
            }
            return true;
        }

        return false;
    }
}

public class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator(IUnitOfWork uow)
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Price).GreaterThan(0);
        RuleFor(x => x.OldPrice)
            .GreaterThan(0)
            .When(x => x.OldPrice.HasValue)
            .WithMessage("OldPrice must be greater than 0.");
        RuleFor(x => x.OldPrice)
            .GreaterThan(x => x.Price)
            .When(x => x.OldPrice.HasValue)
            .WithMessage("OldPrice must be greater than Price.");
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.WeightGrams)
            .GreaterThan(0)
            .WithMessage("WeightGrams is required and must be greater than 0.");
        RuleFor(x => x.LengthCm)
            .GreaterThan(0)
            .When(x => x.LengthCm.HasValue)
            .WithMessage("LengthCm must be greater than 0 when provided.");
        RuleFor(x => x.WidthCm)
            .GreaterThan(0)
            .When(x => x.WidthCm.HasValue)
            .WithMessage("WidthCm must be greater than 0 when provided.");
        RuleFor(x => x.HeightCm)
            .GreaterThan(0)
            .When(x => x.HeightCm.HasValue)
            .WithMessage("HeightCm must be greater than 0 when provided.");
        RuleForEach(x => x.ImageUrls)
            .Must(CreateProductRequestValidator.IsValidImageUrl)
            .WithMessage("Each ImageUrl must be a valid path starting with /uploads/ or a valid http/https URL without path traversal or private IP targets.");
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("CategoryId is required.")
            .MustAsync(async (catId, ct) => (await uow.Categories.GetByIdAsync(catId)) != null)
            .WithMessage("Category does not exist.");
    }
}
