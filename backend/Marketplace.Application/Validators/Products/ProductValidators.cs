using Marketplace.Application.DTOs.Dashboard;
using Marketplace.Application.DTOs.Search;
using System.Text.RegularExpressions;
using FluentValidation;
using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Validators.Products;

public class CreateProductVariantRequestValidator : AbstractValidator<CreateProductVariantRequest>
{
    public CreateProductVariantRequestValidator()
    {
        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Variant stock must be greater than or equal to 0.");

        RuleFor(x => x.PriceOverride)
            .GreaterThan(0)
            .When(x => x.PriceOverride.HasValue)
            .WithMessage("PriceOverride must be greater than 0 when provided.");

        RuleFor(x => x.ImageUrl)
            .Must(CreateProductRequestValidator.IsValidImageUrl)
            .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl))
            .WithMessage("Variant ImageUrl must be a relative path '/uploads/<guid>.<ext>' (external URLs are not allowed).");
    }
}

public class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    private static readonly Regex RelativeUploadRegex = new(
        @"^/uploads/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public CreateProductRequestValidator(IUnitOfWork uow, IConfiguration configuration)
    {
        var maxImages = configuration.GetValue<int>("Products:MaxImagesPerProduct", 8);

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
        RuleFor(x => x.ImageUrls)
            .Must(list => list == null || list.Count <= maxImages)
            .WithMessage($"A product cannot have more than {maxImages} images.");
        RuleForEach(x => x.ImageUrls)
            .Must(IsValidImageUrl)
            .WithMessage("Each ImageUrl must be a relative path '/uploads/<guid>.<ext>' (external URLs are not allowed).");
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("CategoryId is required.")
            .MustAsync(async (catId, ct) => (await uow.Categories.GetByIdAsync(catId)) != null)
            .WithMessage("Category does not exist.");

        RuleForEach(x => x.Variants)
            .SetValidator(new CreateProductVariantRequestValidator())
            .When(x => x.Variants != null && x.Variants.Any());
    }

    public static bool IsValidImageUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        var trimmed = url.Trim();
        if (trimmed.Contains("..")) return false;
        return RelativeUploadRegex.IsMatch(trimmed);
    }
}

public class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator(IUnitOfWork uow, IConfiguration configuration)
    {
        var maxImages = configuration.GetValue<int>("Products:MaxImagesPerProduct", 8);

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
        RuleFor(x => x.ImageUrls)
            .Must(list => list == null || list.Count <= maxImages)
            .WithMessage($"A product cannot have more than {maxImages} images.");
        RuleForEach(x => x.ImageUrls)
            .Must(CreateProductRequestValidator.IsValidImageUrl)
            .WithMessage("Each ImageUrl must be a relative path '/uploads/<guid>.<ext>' (external URLs are not allowed).");
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("CategoryId is required.")
            .MustAsync(async (catId, ct) => (await uow.Categories.GetByIdAsync(catId)) != null)
            .WithMessage("Category does not exist.");

        RuleForEach(x => x.Variants)
            .SetValidator(new CreateProductVariantRequestValidator())
            .When(x => x.Variants != null && x.Variants.Any());
    }

public class QuickStockUpdateRequestValidator : AbstractValidator<QuickStockUpdateRequest>
{
    public QuickStockUpdateRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => x.Stock.HasValue || x.Price.HasValue)
            .WithMessage("Either Stock or Price must be provided.");

        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0)
            .When(x => x.Stock.HasValue)
            .WithMessage("Stock must be greater than or equal to 0.");

        RuleFor(x => x.Price)
            .GreaterThan(0)
            .When(x => x.Price.HasValue)
            .WithMessage("Price must be greater than 0.");
    }
}

public class ProductSearchRequestValidator : AbstractValidator<ProductSearchRequest>
{
    public ProductSearchRequestValidator()
    {
        RuleFor(x => x.MinPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.MinPrice.HasValue)
            .WithMessage("MinPrice must be greater than or equal to 0.");

        RuleFor(x => x.MaxPrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.MaxPrice.HasValue)
            .WithMessage("MaxPrice must be greater than or equal to 0.");

        RuleFor(x => x.MaxPrice)
            .GreaterThanOrEqualTo(x => x.MinPrice!.Value)
            .When(x => x.MinPrice.HasValue && x.MaxPrice.HasValue)
            .WithMessage("MaxPrice must be greater than or equal to MinPrice.");

        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1)
            .WithMessage("PageNumber must be at least 1.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithMessage("PageSize must be between 1 and 100.");

        RuleFor(x => x.Lang)
            .Must(l => string.IsNullOrEmpty(l) || l == "ar" || l == "en")
            .WithMessage("Lang must be 'ar' or 'en'.");
    }
}
}
