using Marketplace.Domain.Enums;

namespace Marketplace.Application.Interfaces;

public record ImageUploadResult(
    string Url,
    string FileName,
    string ContentType,
    int Width,
    int Height,
    long SizeBytes);

public interface IImageUploadService
{
    Task<ImageUploadResult> ProcessAndSaveImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = null,
        string? clientContentType = null,
        FileCategory category = FileCategory.ProductImage);

    Task<ImageUploadResult> ProcessAndSavePrivateImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = "returns",
        string? clientContentType = null,
        FileCategory category = FileCategory.ReturnEvidence);

    Task<ImageUploadResult> ProcessAndSavePrivateDocumentAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = "disputes",
        string? clientContentType = null,
        FileCategory category = FileCategory.DisputeEvidence);

    Task ValidateSellerOwnedImagesAsync(
        int sellerId,
        IReadOnlyList<string> imageUrls,
        IReadOnlyList<string?>? variantImageUrls = null);

    Task ValidateReviewImagesAsync(
        int buyerId,
        IReadOnlyList<string>? imageUrls);
}
