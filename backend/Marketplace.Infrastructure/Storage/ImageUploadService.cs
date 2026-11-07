using System.Text.RegularExpressions;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
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
        @"^/api/files/private/(?<file>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|webp|pdf))$",
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

    public Task<ImageUploadResult> ProcessAndSaveImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder)
        => ProcessAndSaveImageAsync(uploaderId, fileStream, originalFileName, fileLength, subFolder, null, FileCategory.ProductImage);

    public Task<ImageUploadResult> ProcessAndSavePrivateImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder)
        => ProcessAndSavePrivateImageAsync(uploaderId, fileStream, originalFileName, fileLength, subFolder, null, FileCategory.ReturnEvidence);

    public async Task<ImageUploadResult> ProcessAndSaveImageAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = null,
        string? clientContentType = null,
        FileCategory category = FileCategory.ProductImage)
    {
        var (cleanBytes, finalWidth, finalHeight, contentType, canonicalExtension) =
            await CleanAndValidateImageAsync(fileStream, originalFileName, fileLength, clientContentType);

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
            Category = category,
            IsPrivate = false,
            IsLegalHold = false,
            RetentionExpiresAt = null,
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
        string? subFolder = "returns",
        string? clientContentType = null,
        FileCategory category = FileCategory.ReturnEvidence)
    {
        var (cleanBytes, finalWidth, finalHeight, contentType, canonicalExtension) =
            await CleanAndValidateImageAsync(fileStream, originalFileName, fileLength, clientContentType);

        var normalizedSubFolder = string.IsNullOrWhiteSpace(subFolder)
            ? "returns"
            : subFolder.Trim().Trim('/', '\\').ToLowerInvariant();

        var fileName = $"{Guid.NewGuid():D}{canonicalExtension}";
        var relativeUrl = await _storageProvider.SaveFileAsync(
            cleanBytes,
            fileName,
            normalizedSubFolder,
            isPrivate: true);

        var disputeRetentionDays = _configuration.GetValue<int>("Uploads:DisputeDocumentRetentionDays", 180);
        var uploadedFile = new UploadedFile
        {
            UploaderId = uploaderId,
            FileName = fileName,
            RelativeUrl = relativeUrl,
            ContentType = contentType,
            SizeBytes = cleanBytes.LongLength,
            Width = finalWidth,
            Height = finalHeight,
            Category = category,
            IsPrivate = true,
            IsLegalHold = false,
            RetentionExpiresAt = DateTime.UtcNow.AddDays(disputeRetentionDays),
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

    public async Task<ImageUploadResult> ProcessAndSavePrivateDocumentAsync(
        int uploaderId,
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? subFolder = "disputes",
        string? clientContentType = null,
        FileCategory category = FileCategory.DisputeEvidence)
    {
        var extension = Path.GetExtension(originalFileName)?.ToLowerInvariant();
        if (extension is ".jpg" or ".jpeg" or ".png" or ".webp")
        {
            return await ProcessAndSavePrivateImageAsync(uploaderId, fileStream, originalFileName, fileLength, subFolder, clientContentType, category);
        }

        if (extension != ".pdf")
        {
            throw new BadRequestException("Unsupported document type. Only PDF and image files are permitted.");
        }

        if (fileStream == null || fileLength <= 0)
        {
            throw new BadRequestException("No document file provided.");
        }

        var maxFileSizeBytes = _configuration.GetValue<long>("Uploads:MaxFileSizeBytes", 6L * 1024 * 1024);
        if (fileLength > maxFileSizeBytes)
        {
            throw new BadRequestException($"Document size exceeds the {maxFileSizeBytes / (1024 * 1024)}MB limit.");
        }

        if (!string.IsNullOrWhiteSpace(clientContentType))
        {
            var mime = clientContentType.Trim().ToLowerInvariant();
            if (mime != "application/pdf")
            {
                throw new BadRequestException($"MIME type '{clientContentType}' does not match PDF document.");
            }
        }

        await using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms);
        var rawBytes = ms.ToArray();

        if (rawBytes.Length == 0 || rawBytes.Length > maxFileSizeBytes)
        {
            throw new BadRequestException($"Document size exceeds the {maxFileSizeBytes / (1024 * 1024)}MB limit.");
        }

        // PDF Magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
        if (rawBytes.Length < 5 ||
            rawBytes[0] != 0x25 || rawBytes[1] != 0x50 || rawBytes[2] != 0x44 || rawBytes[3] != 0x46 || rawBytes[4] != 0x2D)
        {
            throw new BadRequestException("Invalid PDF header signature. File is not a valid PDF document.");
        }

        // Scan for dangerous embedded elements in PDF
        var pdfText = System.Text.Encoding.Latin1.GetString(rawBytes);
        if (pdfText.Contains("/JavaScript") || pdfText.Contains("/JS") || pdfText.Contains("/Launch") ||
            pdfText.Contains("/EmbeddedFiles"))
        {
            throw new BadRequestException("PDF document contains forbidden interactive or executable elements.");
        }

        var normalizedSubFolder = string.IsNullOrWhiteSpace(subFolder)
            ? "disputes"
            : subFolder.Trim().Trim('/', '\\').ToLowerInvariant();

        var fileName = $"{Guid.NewGuid():D}.pdf";
        var relativeUrl = await _storageProvider.SaveFileAsync(
            rawBytes,
            fileName,
            normalizedSubFolder,
            isPrivate: true);

        var retentionDays = _configuration.GetValue<int>("Uploads:DisputeDocumentRetentionDays", 180);
        var uploadedFile = new UploadedFile
        {
            UploaderId = uploaderId,
            FileName = fileName,
            RelativeUrl = relativeUrl,
            ContentType = "application/pdf",
            SizeBytes = rawBytes.LongLength,
            Width = 0,
            Height = 0,
            Category = category,
            IsPrivate = true,
            IsLegalHold = false,
            RetentionExpiresAt = DateTime.UtcNow.AddDays(retentionDays),
            CreatedAt = DateTime.UtcNow
        };

        await _uow.UploadedFiles.AddAsync(uploadedFile);
        await _uow.SaveChangesAsync();

        return new ImageUploadResult(
            relativeUrl,
            fileName,
            "application/pdf",
            0,
            0,
            rawBytes.LongLength);
    }

    private async Task<(byte[] CleanBytes, int Width, int Height, string ContentType, string CanonicalExtension)> CleanAndValidateImageAsync(
        Stream fileStream,
        string originalFileName,
        long fileLength,
        string? clientContentType)
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

        // Validate client Content-Type if provided (never trust client blindly, but reject mismatched / executable MIME)
        if (!string.IsNullOrWhiteSpace(clientContentType))
        {
            var rawMime = clientContentType.Trim().ToLowerInvariant();
            if (rawMime.Contains("javascript") || rawMime.Contains("html") || rawMime.Contains("executable") ||
                rawMime.Contains("msdownload") || rawMime.Contains("bat") || rawMime.Contains("sh") ||
                rawMime.Contains("php") || rawMime.Contains("cmd"))
            {
                throw new BadRequestException("Unsupported or executable MIME type.");
            }

            var isMimeValid = extension switch
            {
                ".jpg" or ".jpeg" => rawMime is "image/jpeg" or "image/pjpeg" or "image/jpg",
                ".png" => rawMime is "image/png" or "image/x-png",
                ".webp" => rawMime is "image/webp",
                _ => false
            };

            if (!isMimeValid)
            {
                throw new BadRequestException($"MIME type '{clientContentType}' does not match expected image format for extension '{extension}'.");
            }
        }

        await using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        var rawBytes = memoryStream.ToArray();

        if (rawBytes.Length == 0 || rawBytes.LongLength > maxFileSizeBytes)
        {
            throw new BadRequestException($"File size exceeds the {maxFileSizeBytes / (1024 * 1024)}MB limit.");
        }

        // Reject executable and script signatures (defense in depth)
        if (IsExecutableOrScript(rawBytes))
        {
            throw new BadRequestException("Executable or script files are strictly prohibited.");
        }

        // 1. Magic-byte signature check
        if (!HasValidMagicBytes(rawBytes, extension))
        {
            throw new BadRequestException("Invalid image file header. Magic bytes do not match expected image signature.");
        }

        // 2. Decode, validate pixel dimensions, apply EXIF orientation, downscale if needed, and re-encode to strip all EXIF/GPS metadata
        var maxInputDimension = _configuration.GetValue<int>("Uploads:MaxInputDimension", 8192);
        var maxPixelCount = _configuration.GetValue<long>("Uploads:MaxPixelCount", 25_000_000L);
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

            // Decompression bomb / pixel flood protection
            if ((long)srcWidth * srcHeight > maxPixelCount)
            {
                throw new BadRequestException(
                    $"Image pixel count ({(long)srcWidth * srcHeight:N0}) exceeds the safety limit of {maxPixelCount:N0} pixels.");
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

            // 3. Final Output Validation: Inspect cleanBytes to verify all EXIF/GPS/metadata is completely absent
            VerifyCleanImageOutput(cleanBytes, expectedFormat);

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

    private static bool IsExecutableOrScript(byte[] bytes)
    {
        if (bytes == null || bytes.Length < 2)
            return false;

        // Windows PE / DOS executable (MZ)
        if (bytes[0] == 0x4D && bytes[1] == 0x5A)
            return true;

        // Linux ELF
        if (bytes.Length >= 4 && bytes[0] == 0x7F && bytes[1] == 0x45 && bytes[2] == 0x4C && bytes[3] == 0x46)
            return true;

        // Java Class
        if (bytes.Length >= 4 && bytes[0] == 0xCA && bytes[1] == 0xFE && bytes[2] == 0xBA && bytes[3] == 0xBE)
            return true;

        // Mach-O
        if (bytes.Length >= 4 && (
            (bytes[0] == 0xFE && bytes[1] == 0xED && bytes[2] == 0xFA && bytes[3] == 0xCE) ||
            (bytes[0] == 0xCF && bytes[1] == 0xFA && bytes[2] == 0xED && bytes[3] == 0xFE)))
            return true;

        // Script markers in header
        var headerAscii = System.Text.Encoding.Latin1.GetString(bytes.AsSpan(0, Math.Min(bytes.Length, 512))).ToLowerInvariant();
        if (headerAscii.StartsWith("#!/") ||
            headerAscii.Contains("<?php") ||
            headerAscii.Contains("<html") ||
            headerAscii.Contains("<script") ||
            headerAscii.Contains("<!doctype"))
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Inspects the re-encoded image buffer to ensure prohibited EXIF, GPS, camera metadata, and thumbnails are absent.
    /// </summary>
    public static void VerifyCleanImageOutput(byte[] bytes, SKEncodedImageFormat format)
    {
        if (bytes == null || bytes.Length == 0)
        {
            throw new BadRequestException("Sanitized output image is empty.");
        }

        switch (format)
        {
            case SKEncodedImageFormat.Jpeg:
            {
                // Scan JPEG markers: APP1 (0xFFE1) must not exist with Exif or XMP
                if (bytes.Length > 4 && bytes[0] == 0xFF && bytes[1] == 0xD8)
                {
                    var offset = 2;
                    while (offset + 4 <= bytes.Length && bytes[offset] == 0xFF)
                    {
                        var marker = bytes[offset + 1];
                        if (marker == 0xDA || marker == 0xD9) break; // Start of scan or end of image
                        var segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
                        if (segLen < 2) break;

                        if (marker == 0xE1) // APP1 segment
                        {
                            var payloadOffset = offset + 4;
                            var payloadLength = Math.Min(segLen - 2, bytes.Length - payloadOffset);
                            var payloadStr = System.Text.Encoding.Latin1.GetString(bytes, payloadOffset, payloadLength);
                            if (payloadStr.StartsWith("Exif\0\0", StringComparison.Ordinal) ||
                                payloadStr.Contains("http://ns.adobe.com/xap/1.0/") ||
                                payloadStr.Contains("GPS"))
                            {
                                throw new InvalidOperationException("Sanitization verification failed: EXIF/GPS APP1 segment found in output JPEG.");
                            }
                        }

                        offset += 2 + segLen;
                    }
                }

                // Global string check for sensitive markers
                var latin1 = System.Text.Encoding.Latin1.GetString(bytes);
                if (latin1.Contains("GPSLatitude") || latin1.Contains("GPSLongitude") || latin1.Contains("GPS_CAIRO"))
                {
                    throw new InvalidOperationException("Sanitization verification failed: GPS metadata found in output JPEG.");
                }
                break;
            }

            case SKEncodedImageFormat.Png:
            {
                // Verify no eXIf or prohibited metadata chunks
                if (bytes.Length > 8)
                {
                    var offset = 8;
                    while (offset + 8 <= bytes.Length)
                    {
                        var chunkLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
                        if (chunkLen < 0 || offset + 8 + chunkLen + 4 > bytes.Length) break;
                        var chunkType = System.Text.Encoding.ASCII.GetString(bytes, offset + 4, 4);

                        if (chunkType is "eXIf" or "iTXt" or "tEXt" or "zTXt")
                        {
                            var chunkData = System.Text.Encoding.Latin1.GetString(bytes, offset + 8, chunkLen);
                            if (chunkType == "eXIf" || chunkData.Contains("GPS") || chunkData.Contains("Exif"))
                            {
                                throw new InvalidOperationException($"Sanitization verification failed: Metadata chunk '{chunkType}' found in output PNG.");
                            }
                        }

                        offset += 8 + chunkLen + 4;
                    }
                }
                break;
            }

            case SKEncodedImageFormat.Webp:
            {
                // RIFF container checks
                var latin1 = System.Text.Encoding.Latin1.GetString(bytes);
                if (latin1.Contains("EXIF") || latin1.Contains("XMP "))
                {
                    throw new InvalidOperationException("Sanitization verification failed: EXIF/XMP chunk found in output WebP.");
                }
                break;
            }
        }
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
