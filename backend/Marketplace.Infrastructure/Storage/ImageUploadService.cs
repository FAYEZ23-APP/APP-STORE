using System.Text.RegularExpressions;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using SkiaSharp;

namespace Marketplace.Infrastructure.Storage;

public class ImageUploadService : IImageUploadService
{
    private static readonly Regex RelativeUploadUrlRegex = new(
        @"^/uploads/(?<file>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp))$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex RelativeReviewUploadUrlRegex = new(
        @"^/uploads/reviews/(?<file>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp))$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex RelativePrivateUploadUrlRegex = new(
        @"^/api/files/private/(?<file>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp))$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private readonly IUnitOfWork _uow;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly IFileStorageProvider _storageProvider;

    public ImageUploadService(
        IUnitOfWork uow,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        IFileStorageProvider storageProvider)
    {
        _uow = uow;
        _environment = environment;
        _configuration = configuration;
        _storageProvider = storageProvider;
    }

    public async Task<ImageUploadResult> ProcessAndSaveImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = null)
    {
        var (cleanBytes, finalWidth, finalHeight, contentType, canonicalExtension) =
            await CleanAndValidateImageAsync(fileStream, originalFileName, fileLength);

        var normalizedSubFolder = string.IsNullOrWhiteSpace(subFolder)
            ? null
            : subFolder.Trim().Trim('/', '\\').ToLowerInvariant();

        var fileName = $"{Guid.NewGuid():D}{canonicalExtension}";
        var relativeUrl = await _storageProvider.SaveFileAsync(
            cleanBytes,
            fileName,
            normalizedSubFolder,
            isPrivate: false);

        var uploadedFile = new UploadedFile
        {
            UploaderId = uploaderId,
            FileName = fileName,
            RelativeUrl = relativeUrl,
            ContentType = contentType,
            SizeBytes = cleanBytes.LongLength,
            Width = finalWidth,
            Height = finalHeight,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.UploadedFiles.AddAsync(uploadedFile);
        await _uow.SaveChangesAsync();

        return new ImageUploadResult(
            relativeUrl,
            fileName,
            contentType,
            finalWidth,
            finalHeight,
            cleanBytes.LongLength);
    }

    public async Task<ImageUploadResult> ProcessAndSavePrivateImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = "returns")
    {
        var (cleanBytes, finalWidth, finalHeight, contentType, canonicalExtension) =
            await CleanAndValidateImageAsync(fileStream, originalFileName, fileLength);

        var normalizedSubFolder = string.IsNullOrWhiteSpace(subFolder)
            ? "returns"
            : subFolder.Trim().Trim('/', '\\').ToLowerInvariant();

        var fileName = $"{Guid.NewGuid():D}{canonicalExtension}";
        var relativeUrl = await _storageProvider.SaveFileAsync(
            cleanBytes,
            fileName,
            normalizedSubFolder,
            isPrivate: true);

        var uploadedFile = new UploadedFile
        {
            UploaderId = uploaderId,
            FileName = fileName,
            RelativeUrl = relativeUrl,
            ContentType = contentType,
            SizeBytes = cleanBytes.LongLength,
            Width = finalWidth,
            Height = finalHeight,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.UploadedFiles.AddAsync(uploadedFile);
        await _uow.SaveChangesAsync();

        return new ImageUploadResult(
            relativeUrl,
            fileName,
            contentType,
            finalWidth,
            finalHeight,
            cleanBytes.LongLength);
    }

    private async Task<(byte[] CleanBytes, int Width, int Height, string ContentType, string CanonicalExtension)> CleanAndValidateImageAsync(
        Stream fileStream,
        string originalFileName,
        long fileLength)
    {
        if (fileStream == null || fileLength <= 0)
        {
            throw new BadRequestException("No image file provided.");
        }

        var maxFileSizeBytes = _configuration.GetValue<long>("Uploads:MaxFileSizeBytes", 5L * 1024 * 1024);
        if (fileLength > maxFileSizeBytes)
        {
            throw new BadRequestException($"File size exceeds the {maxFileSizeBytes / (1024 * 1024)}MB limit.");
        }

        var extension = Path.GetExtension(originalFileName)?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new BadRequestException("Invalid file type. Only jpg, jpeg, png, and webp are allowed.");
        }

        await using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        var rawBytes = memoryStream.ToArray();

        if (rawBytes.Length == 0 || rawBytes.LongLength > maxFileSizeBytes)
        {
            throw new BadRequestException($"File size exceeds the {maxFileSizeBytes / (1024 * 1024)}MB limit.");
        }

        // 1. Magic-byte signature check
        if (!HasValidMagicBytes(rawBytes, extension))
        {
            throw new BadRequestException("Invalid image file header. Magic bytes do not match expected image signature.");
        }

        // 2. Decode, validate pixel dimensions, apply EXIF orientation, downscale if needed, and re-encode to strip all EXIF/GPS metadata
        var maxInputDimension = _configuration.GetValue<int>("Uploads:MaxInputDimension", 8192);
        var maxOutputDimension = _configuration.GetValue<int>("Uploads:MaxImageDimension", 1600);
        var quality = _configuration.GetValue<int>("Uploads:JpegWebpQuality", 85);

        byte[] cleanBytes;
        int finalWidth;
        int finalHeight;
        string canonicalExtension;
        string contentType;

        using (var skData = SKData.CreateCopy(rawBytes))
        using (var codec = SKCodec.Create(skData))
        {
            if (codec == null)
            {
                throw new BadRequestException("Invalid or corrupted image file content.");
            }

            var expectedFormat = extension switch
            {
                ".jpg" or ".jpeg" => SKEncodedImageFormat.Jpeg,
                ".png" => SKEncodedImageFormat.Png,
                ".webp" => SKEncodedImageFormat.Webp,
                _ => throw new BadRequestException("Unsupported image extension.")
            };

            if (codec.EncodedFormat != expectedFormat)
            {
                throw new BadRequestException("Image content format does not match the file extension.");
            }

            var srcWidth = codec.Info.Width;
            var srcHeight = codec.Info.Height;
            if (srcWidth <= 0 || srcHeight <= 0 || srcWidth > maxInputDimension || srcHeight > maxInputDimension)
            {
                throw new BadRequestException(
                    $"Image dimensions ({srcWidth}x{srcHeight}) are invalid or exceed the maximum allowed input dimension ({maxInputDimension}px).");
            }

            var decodeInfo = new SKImageInfo(srcWidth, srcHeight, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var rawBitmap = new SKBitmap(decodeInfo);
            var decodeResult = codec.GetPixels(decodeInfo, rawBitmap.GetPixels());
            if (decodeResult != SKCodecResult.Success && decodeResult != SKCodecResult.IncompleteInput)
            {
                throw new BadRequestException("Failed to decode image pixel data.");
            }

            using var orientedBitmap = ApplyExifOrientation(rawBitmap, codec.EncodedOrigin);

            finalWidth = orientedBitmap.Width;
            finalHeight = orientedBitmap.Height;

            if (finalWidth > maxOutputDimension || finalHeight > maxOutputDimension)
            {
                var scale = (double)maxOutputDimension / Math.Max(finalWidth, finalHeight);
                finalWidth = Math.Max(1, (int)Math.Round(finalWidth * scale));
                finalHeight = Math.Max(1, (int)Math.Round(finalHeight * scale));
            }

            // Always draw onto a brand-new SKBitmap buffer so zero metadata/EXIF/GPS chunks survive
            var cleanInfo = new SKImageInfo(finalWidth, finalHeight, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var cleanBitmap = new SKBitmap(cleanInfo);
            using (var canvas = new SKCanvas(cleanBitmap))
            {
                canvas.Clear(SKColors.Transparent);
                using var image = SKImage.FromBitmap(orientedBitmap);
                var destRect = new SKRect(0, 0, finalWidth, finalHeight);
                var sampling = new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear);
                canvas.DrawImage(image, destRect, sampling);
                canvas.Flush();
            }

            using var outputImage = SKImage.FromBitmap(cleanBitmap);
            var encodeQuality = expectedFormat == SKEncodedImageFormat.Png ? 100 : Math.Clamp(quality, 10, 100);
            using var encodedData = outputImage.Encode(expectedFormat, encodeQuality);
            if (encodedData == null || encodedData.Size == 0)
            {
                throw new BadRequestException("Failed to re-encode image.");
            }

            cleanBytes = encodedData.ToArray();
            canonicalExtension = expectedFormat switch
            {
                SKEncodedImageFormat.Jpeg => ".jpg",
                SKEncodedImageFormat.Png => ".png",
                SKEncodedImageFormat.Webp => ".webp",
                _ => ".jpg"
            };
            contentType = expectedFormat switch
            {
                SKEncodedImageFormat.Jpeg => "image/jpeg",
                SKEncodedImageFormat.Png => "image/png",
                SKEncodedImageFormat.Webp => "image/webp",
                _ => "image/jpeg"
            };
        }

        return (cleanBytes, finalWidth, finalHeight, contentType, canonicalExtension);
    }

    public async Task ValidateSellerOwnedImagesAsync(
        int sellerId,
        IReadOnlyList<string> imageUrls,
        IReadOnlyList<string?>? variantImageUrls = null)
    {
        var maxImages = _configuration.GetValue<int>("Products:MaxImagesPerProduct", 8);
        if (imageUrls != null && imageUrls.Count > maxImages)
        {
            throw new BadRequestException($"A product cannot have more than {maxImages} images (received {imageUrls.Count}).");
        }

        var urlsToCheck = new List<string>();
        if (imageUrls != null)
        {
            urlsToCheck.AddRange(imageUrls);
        }

        if (variantImageUrls != null)
        {
            foreach (var vUrl in variantImageUrls)
            {
                if (!string.IsNullOrWhiteSpace(vUrl))
                {
                    urlsToCheck.Add(vUrl);
                }
            }
        }

        if (urlsToCheck.Count == 0)
        {
            return;
        }

        var uploadsFolder = Path.GetFullPath(GetUploadsFolderPath());

        foreach (var rawUrl in urlsToCheck)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
            {
                throw new BadRequestException("Image URL cannot be empty.");
            }

            var trimmed = rawUrl.Trim();
            var match = RelativeUploadUrlRegex.Match(trimmed);
            if (!match.Success)
            {
                throw new BadRequestException(
                    $"Invalid image URL '{trimmed}'. Every image URL must be a relative path '/uploads/<guid>.<ext>' (external URLs are not allowed).");
            }

            var fileName = match.Groups["file"].Value;
            var physicalPath = Path.GetFullPath(Path.Combine(uploadsFolder, fileName));

            // Defense-in-depth against path traversal
            if (!physicalPath.StartsWith(uploadsFolder, StringComparison.OrdinalIgnoreCase) || !File.Exists(physicalPath))
            {
                throw new BadRequestException($"Image file '{trimmed}' does not exist on the server.");
            }

            var ownership = (await _uow.UploadedFiles.FindAsync(
                f => f.RelativeUrl == trimmed || f.FileName == fileName)).FirstOrDefault();

            if (ownership == null)
            {
                throw new BadRequestException($"Image '{trimmed}' was not uploaded through the server upload endpoint.");
            }

            if (ownership.UploaderId != sellerId)
            {
                throw new BadRequestException($"Image '{trimmed}' belongs to another seller and cannot be used.");
            }
        }
    }

    public async Task ValidateReviewImagesAsync(
        int buyerId,
        IReadOnlyList<string>? imageUrls)
    {
        if (imageUrls == null || imageUrls.Count == 0)
        {
            return;
        }

        var maxPhotos = _configuration.GetValue<int>("Reviews:MaxPhotosPerReview", 3);
        if (imageUrls.Count > maxPhotos)
        {
            throw new BadRequestException($"لا يمكن إرفاق أكثر من {maxPhotos} صور في التقييم الواحد.");
        }

        var reviewUploadsFolder = Path.GetFullPath(Path.Combine(GetUploadsFolderPath(), "reviews"));

        foreach (var rawUrl in imageUrls)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
            {
                throw new BadRequestException("رابط صورة التقييم غير صالح.");
            }

            var trimmed = rawUrl.Trim();
            var match = RelativeReviewUploadUrlRegex.Match(trimmed);
            if (!match.Success)
            {
                throw new BadRequestException(
                    $"رابط صورة التقييم '{trimmed}' غير صالح. يجب أن يكون مساراً نسبياً '/uploads/reviews/<guid>.<ext>'.");
            }

            var fileName = match.Groups["file"].Value;
            var physicalPath = Path.GetFullPath(Path.Combine(reviewUploadsFolder, fileName));

            if (!physicalPath.StartsWith(reviewUploadsFolder, StringComparison.OrdinalIgnoreCase) || !File.Exists(physicalPath))
            {
                throw new BadRequestException($"ملف صورة التقييم '{trimmed}' غير موجود على الخادم.");
            }

            var ownership = (await _uow.UploadedFiles.FindAsync(
                f => f.RelativeUrl == trimmed)).FirstOrDefault();

            if (ownership == null)
            {
                throw new BadRequestException($"الصورة '{trimmed}' لم يتم رفعها عبر نقطة رفع صور التقييمات.");
            }

            if (ownership.UploaderId != buyerId)
            {
                throw new BadRequestException($"الصورة '{trimmed}' تخص مستخدماً آخر ولا يمكن استخدامها.");
            }
        }
    }

    public static bool IsValidRelativeUploadUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return false;
        return RelativeUploadUrlRegex.IsMatch(url.Trim());
    }

    public static bool IsValidRelativeReviewUploadUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return false;
        return RelativeReviewUploadUrlRegex.IsMatch(url.Trim());
    }

    public static bool IsValidRelativePrivateUploadUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return false;
        return RelativePrivateUploadUrlRegex.IsMatch(url.Trim());
    }

    private string GetUploadsFolderPath()
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }
        return Path.Combine(webRoot, "uploads");
    }

    private static bool HasValidMagicBytes(byte[] bytes, string extension)
    {
        if (bytes.Length < 12)
            return false;

        // JPEG: FF D8 FF
        if (extension is ".jpg" or ".jpeg")
            return bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (extension == ".png")
            return bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 &&
                   bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A;

        // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
        if (extension == ".webp")
            return bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                   bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;

        return false;
    }

    private static SKBitmap ApplyExifOrientation(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        switch (origin)
        {
            case SKEncodedOrigin.TopLeft:
            default:
                return bitmap.Copy();

            case SKEncodedOrigin.BottomRight: // 180 deg
            {
                var rotated = new SKBitmap(bitmap.Width, bitmap.Height, bitmap.ColorType, bitmap.AlphaType);
                using var canvas = new SKCanvas(rotated);
                canvas.RotateDegrees(180, bitmap.Width / 2f, bitmap.Height / 2f);
                canvas.DrawBitmap(bitmap, 0, 0);
                return rotated;
            }

            case SKEncodedOrigin.RightTop: // 90 deg CW
            {
                var rotated = new SKBitmap(bitmap.Height, bitmap.Width, bitmap.ColorType, bitmap.AlphaType);
                using var canvas = new SKCanvas(rotated);
                canvas.Translate(rotated.Width, 0);
                canvas.RotateDegrees(90);
                canvas.DrawBitmap(bitmap, 0, 0);
                return rotated;
            }

            case SKEncodedOrigin.LeftBottom: // 270 deg CW
            {
                var rotated = new SKBitmap(bitmap.Height, bitmap.Width, bitmap.ColorType, bitmap.AlphaType);
                using var canvas = new SKCanvas(rotated);
                canvas.Translate(0, rotated.Height);
                canvas.RotateDegrees(270);
                canvas.DrawBitmap(bitmap, 0, 0);
                return rotated;
            }
        }
    }
}
