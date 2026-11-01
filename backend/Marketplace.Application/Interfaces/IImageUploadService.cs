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
        string? subFolder = null);

    Task<ImageUploadResult> ProcessAndSavePrivateImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = "returns");

    Task ValidateSellerOwnedImagesAsync(
        int sellerId,
        IReadOnlyList<string> imageUrls,
        IReadOnlyList<string?>? variantImageUrls = null);

    Task ValidateReviewImagesAsync(
        int buyerId,
        IReadOnlyList<string>? imageUrls);
}
