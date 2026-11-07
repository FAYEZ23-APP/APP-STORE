using System.Text;
using Marketplace.Application.Common;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Marketplace.Infrastructure.Services;
using Marketplace.Infrastructure.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SkiaSharp;
using Xunit;

namespace Marketplace.Tests;

public class FileSecurityAndValidationTests
{
    private readonly ImageUploadService _uploadService;
    private readonly LocalFileStorageProvider _storageProvider;
    private readonly FakeUnitOfWork _fakeUow;
    private readonly IConfiguration _config;
    private readonly string _tempPublicPath;
    private readonly string _tempPrivatePath;

    public FileSecurityAndValidationTests()
    {
        _tempPublicPath = Path.Combine(Path.GetTempPath(), "egyptshop_test_public_" + Guid.NewGuid().ToString("N"));
        _tempPrivatePath = Path.Combine(Path.GetTempPath(), "egyptshop_test_private_" + Guid.NewGuid().ToString("N"));

        Directory.CreateDirectory(_tempPublicPath);
        Directory.CreateDirectory(_tempPrivatePath);

        var configValues = new Dictionary<string, string?>
        {
            ["Uploads:MaxFileSizeBytes"] = (5 * 1024 * 1024).ToString(),
            ["Uploads:MaxImageDimension"] = "1600",
            ["Uploads:MaxInputDimension"] = "8192",
            ["Uploads:MaxPixelCount"] = "25000000",
            ["Uploads:JpegWebpQuality"] = "85",
            ["Uploads:DisputeDocumentRetentionDays"] = "180",
            ["Uploads:TemporaryUploadRetentionHours"] = "24"
        };
        _config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        var storageSettings = Options.Create(new StorageSettings
        {
            LocalPublicPath = _tempPublicPath,
            LocalPrivatePath = _tempPrivatePath
        });

        var fakeEnv = new FakeWebHostEnvironment { WebRootPath = _tempPublicPath };
        _storageProvider = new LocalFileStorageProvider(fakeEnv, storageSettings, NullLogger<LocalFileStorageProvider>.Instance);

        _fakeUow = new FakeUnitOfWork();
        _uploadService = new ImageUploadService(_fakeUow, fakeEnv, _config, _storageProvider);
    }

    private static byte[] CreateValidBitmapBytes(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.CornflowerBlue);
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }

    private static byte[] CreateJpegWithExifAndGps()
    {
        var cleanJpeg = CreateValidBitmapBytes(200, 200, SKEncodedImageFormat.Jpeg);

        // Construct APP1 Exif segment containing GPS IFD and camera metadata
        var exifPayload = new List<byte>();
        exifPayload.AddRange(Encoding.ASCII.GetBytes("Exif\0\0"));
        exifPayload.AddRange(new byte[] { 0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08 }); // TIFF big-endian header
        exifPayload.AddRange(new byte[] { 0x00, 0x02 }); // 2 tags in IFD0
        // Tag 0x010F: Make = "Canon\0"
        exifPayload.AddRange(new byte[] { 0x01, 0x0F, 0x00, 0x02, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x26 });
        // Tag 0x8825: GPSInfo
        exifPayload.AddRange(new byte[] { 0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30 });
        exifPayload.AddRange(new byte[] { 0x00, 0x00, 0x00, 0x00 }); // Next IFD offset
        // Tag values:
        exifPayload.AddRange(Encoding.ASCII.GetBytes("Canon\0")); // Offset 38 (0x26)
        // GPS IFD (offset 48 / 0x30):
        exifPayload.AddRange(new byte[] { 0x00, 0x02 }); // 2 GPS tags
        exifPayload.AddRange(new byte[] { 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, (byte)'N', 0x00, 0x00, 0x00 });
        exifPayload.AddRange(new byte[] { 0x00, 0x03, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02, (byte)'E', 0x00, 0x00, 0x00 });
        exifPayload.AddRange(Encoding.ASCII.GetBytes("GPS_CAIRO_30.0444_31.2357\0"));

        var segLength = exifPayload.Count + 2;
        var app1Header = new byte[] { 0xFF, 0xE1, (byte)((segLength >> 8) & 0xFF), (byte)(segLength & 0xFF) };

        var finalBytes = new List<byte>();
        finalBytes.AddRange(cleanJpeg.Take(2)); // SOI: FF D8
        finalBytes.AddRange(app1Header);
        finalBytes.AddRange(exifPayload);
        finalBytes.AddRange(cleanJpeg.Skip(2)); // Rest of JPEG

        return finalBytes.ToArray();
    }

    [Fact]
    public async Task Test1_ValidJpegUpload_SucceedsAndGeneratesCleanOutput()
    {
        var rawBytes = CreateValidBitmapBytes(640, 480, SKEncodedImageFormat.Jpeg);
        using var stream = new MemoryStream(rawBytes);

        var result = await _uploadService.ProcessAndSaveImageAsync(10, stream, "test.jpg", rawBytes.Length, null, "image/jpeg");

        Assert.NotNull(result);
        Assert.EndsWith(".jpg", result.FileName);
        Assert.Equal("image/jpeg", result.ContentType);
        Assert.Equal(640, result.Width);
        Assert.Equal(480, result.Height);
    }

    [Fact]
    public async Task Test2_ValidPngUpload_SucceedsAndPreservesDimensions()
    {
        var rawBytes = CreateValidBitmapBytes(320, 240, SKEncodedImageFormat.Png);
        using var stream = new MemoryStream(rawBytes);

        var result = await _uploadService.ProcessAndSaveImageAsync(10, stream, "badge.png", rawBytes.Length, null, "image/png");

        Assert.NotNull(result);
        Assert.EndsWith(".png", result.FileName);
        Assert.Equal("image/png", result.ContentType);
        Assert.Equal(320, result.Width);
        Assert.Equal(240, result.Height);
    }

    [Fact]
    public async Task Test3_ValidWebpUpload_Succeeds()
    {
        var rawBytes = CreateValidBitmapBytes(500, 300, SKEncodedImageFormat.Webp);
        using var stream = new MemoryStream(rawBytes);

        var result = await _uploadService.ProcessAndSaveImageAsync(10, stream, "photo.webp", rawBytes.Length, null, "image/webp");

        Assert.NotNull(result);
        Assert.EndsWith(".webp", result.FileName);
        Assert.Equal("image/webp", result.ContentType);
        Assert.Equal(500, result.Width);
        Assert.Equal(300, result.Height);
    }

    [Fact]
    public async Task Test4_ImageWithGpsExif_StripsGpsMetadata()
    {
        var dirtyBytes = CreateJpegWithExifAndGps();
        var dirtyLatin1 = Encoding.Latin1.GetString(dirtyBytes);
        Assert.Contains("GPS_CAIRO", dirtyLatin1);

        using var stream = new MemoryStream(dirtyBytes);
        var result = await _uploadService.ProcessAndSaveImageAsync(10, stream, "camera.jpg", dirtyBytes.Length, null, "image/jpeg");

        var diskPath = Path.Combine(_tempPublicPath, result.FileName);
        Assert.True(File.Exists(diskPath));

        var cleanOnDisk = await File.ReadAllBytesAsync(diskPath);
        var cleanLatin1 = Encoding.Latin1.GetString(cleanOnDisk);

        Assert.DoesNotContain("GPS_CAIRO", cleanLatin1);
        Assert.DoesNotContain("Exif\0\0", cleanLatin1);
    }

    [Fact]
    public async Task Test5_ImageWithCameraMetadata_StripsMakeAndModel()
    {
        var dirtyBytes = CreateJpegWithExifAndGps();
        Assert.Contains("Canon", Encoding.Latin1.GetString(dirtyBytes));

        using var stream = new MemoryStream(dirtyBytes);
        var result = await _uploadService.ProcessAndSaveImageAsync(10, stream, "dslr.jpg", dirtyBytes.Length, null, "image/jpeg");

        var diskPath = Path.Combine(_tempPublicPath, result.FileName);
        var cleanOnDisk = await File.ReadAllBytesAsync(diskPath);
        var cleanLatin1 = Encoding.Latin1.GetString(cleanOnDisk);

        Assert.DoesNotContain("Canon", cleanLatin1);
    }

    [Fact]
    public async Task Test6_FileWithFakeImageExtension_Rejected()
    {
        var fakeTextContent = Encoding.UTF8.GetBytes("This is plain text disguised as an image file.");
        using var stream = new MemoryStream(fakeTextContent);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, stream, "fake.jpg", fakeTextContent.Length, null, "image/jpeg"));
    }

    [Fact]
    public async Task Test7_IncorrectMimeType_Rejected()
    {
        var rawBytes = CreateValidBitmapBytes(100, 100, SKEncodedImageFormat.Jpeg);
        using var stream = new MemoryStream(rawBytes);

        // Provided MIME type contradicts file extension
        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, stream, "photo.jpg", rawBytes.Length, null, "image/png"));
    }

    [Fact]
    public async Task Test8_ExecutableRenamedToJpg_Rejected()
    {
        // Windows PE executable header (MZ 0x4D 0x5A)
        var exeBytes = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF };
        using var stream = new MemoryStream(exeBytes);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, stream, "malware.jpg", exeBytes.Length, null, "image/jpeg"));
    }

    [Fact]
    public async Task Test9_MalformedImage_Rejected()
    {
        // Valid JPEG SOI (FF D8 FF E0) followed by corrupted garbage bytes
        var malformedBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xDE, 0xAD, 0xBE, 0xEF };
        using var stream = new MemoryStream(malformedBytes);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, stream, "corrupt.jpg", malformedBytes.Length, null, "image/jpeg"));
    }

    [Fact]
    public async Task Test10_OversizedImage_Rejected()
    {
        var oversizedStream = new MemoryStream(new byte[100]);
        var lengthExceedingMax = 10L * 1024 * 1024; // 10MB exceeds 5MB limit

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, oversizedStream, "large.jpg", lengthExceedingMax, null, "image/jpeg"));
    }

    [Fact]
    public async Task Test11_ExcessivePixelDimensions_Rejected()
    {
        // 9000x100 exceeds MaxInputDimension 8192
        var hugeBitmapBytes = CreateValidBitmapBytes(9000, 100, SKEncodedImageFormat.Jpeg);
        using var stream = new MemoryStream(hugeBitmapBytes);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSaveImageAsync(10, stream, "huge.jpg", hugeBitmapBytes.Length, null, "image/jpeg"));
    }

    [Fact]
    public async Task Test12_ValidPdfDisputeDocument_SucceedsInPrivateStorage()
    {
        var pdfBytes = Encoding.Latin1.GetBytes("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");
        using var stream = new MemoryStream(pdfBytes);

        var result = await _uploadService.ProcessAndSavePrivateDocumentAsync(
            15,
            stream,
            "dispute_statement.pdf",
            pdfBytes.Length,
            "disputes",
            "application/pdf",
            FileCategory.DisputeEvidence);

        Assert.NotNull(result);
        Assert.EndsWith(".pdf", result.FileName);
        Assert.Equal("application/pdf", result.ContentType);
        Assert.StartsWith("/api/files/private/", result.Url);

        var savedStream = await _storageProvider.GetPrivateFileStreamAsync(result.FileName, "disputes");
        Assert.NotNull(savedStream);
        savedStream.Dispose();
    }

    [Fact]
    public async Task Test13_DisputeDocumentWithForbiddenScript_Rejected()
    {
        var maliciousPdf = Encoding.Latin1.GetBytes("%PDF-1.4\n1 0 obj\n<< /JavaScript << /JS (app.alert('pwned')) >> >>\nendobj\n%%EOF");
        using var stream = new MemoryStream(maliciousPdf);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _uploadService.ProcessAndSavePrivateDocumentAsync(
                15,
                stream,
                "invoice.pdf",
                maliciousPdf.Length,
                "disputes",
                "application/pdf",
                FileCategory.DisputeEvidence));
    }

    [Fact]
    public async Task Test14_RetentionService_BlocksDeletionUnderLegalHold()
    {
        var retention = new FileRetentionService(_fakeUow, _storageProvider, _config, NullLogger<FileRetentionService>.Instance);

        var lockedFile = new UploadedFile
        {
            Id = 1,
            FileName = "evidence_held.jpg",
            Category = FileCategory.DisputeEvidence,
            IsLegalHold = true,
            RetentionExpiresAt = DateTime.UtcNow.AddDays(-10)
        };

        var canDelete = await retention.CanDeleteFileAsync(lockedFile);
        Assert.False(canDelete);
    }

    [Fact]
    public async Task Test15_RetentionService_AllowsPurgeWhenExpiredAndUnlocked()
    {
        var retention = new FileRetentionService(_fakeUow, _storageProvider, _config, NullLogger<FileRetentionService>.Instance);

        var expiredFile = new UploadedFile
        {
            Id = 2,
            FileName = "temp_expired.jpg",
            Category = FileCategory.TemporaryUpload,
            IsLegalHold = false,
            RetentionExpiresAt = DateTime.UtcNow.AddHours(-2)
        };

        var canDelete = await retention.CanDeleteFileAsync(expiredFile);
        Assert.True(canDelete);
    }

    [Fact]
    public void Test16_VerifyCleanImageOutput_ThrowsOnUnstrippedMetadata()
    {
        var dirtyBytes = CreateJpegWithExifAndGps();
        Assert.Throws<InvalidOperationException>(() =>
            ImageUploadService.VerifyCleanImageOutput(dirtyBytes, SKEncodedImageFormat.Jpeg));
    }
}

// ─── Test Fakes ─────────────────────────────────────────────────────────────

internal class FakeWebHostEnvironment : IWebHostEnvironment
{
    public string WebRootPath { get; set; } = string.Empty;
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
    public string ApplicationName { get; set; } = "Marketplace.Tests";
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
    public string EnvironmentName { get; set; } = "Testing";
}

internal class FakeRepository<T> : IRepository<T> where T : class
{
    public readonly List<T> List = new();
    public Task<T?> GetByIdAsync(int id)
    {
        var prop = typeof(T).GetProperty("Id");
        var item = List.FirstOrDefault(x => (int)prop!.GetValue(x)! == id);
        return Task.FromResult(item);
    }
    public Task<IEnumerable<T>> GetAllAsync() => Task.FromResult<IEnumerable<T>>(List.ToList());
    public Task<IEnumerable<T>> FindAsync(System.Linq.Expressions.Expression<Func<T, bool>> predicate)
    {
        var fn = predicate.Compile();
        return Task.FromResult<IEnumerable<T>>(List.Where(fn).ToList());
    }
    public IQueryable<T> Query() => List.AsQueryable();
    public Task AddAsync(T entity)
    {
        var prop = typeof(T).GetProperty("Id");
        if (prop != null && (int)prop.GetValue(entity)! == 0)
            prop.SetValue(entity, List.Count + 1);
        List.Add(entity);
        return Task.CompletedTask;
    }
    public void Update(T entity) { }
    public void Remove(T entity) => List.Remove(entity);
}

internal class FakeUnitOfWork : IUnitOfWork
{
    public FakeRepository<UploadedFile> UploadedFilesRepo = new();
    public FakeRepository<ReturnRequest> ReturnRequestsRepo = new();

    public IRepository<UploadedFile> UploadedFiles => UploadedFilesRepo;
    public IRepository<ReturnRequest> ReturnRequests => ReturnRequestsRepo;

    public IRepository<User> Users => throw new NotImplementedException();
    public IRepository<SellerProfile> SellerProfiles => throw new NotImplementedException();
    public IRepository<UserAddress> UserAddresses => throw new NotImplementedException();
    public IRepository<Product> Products => throw new NotImplementedException();
    public IRepository<Category> Categories => throw new NotImplementedException();
    public IRepository<Order> Orders => throw new NotImplementedException();
    public IRepository<Shipment> Shipments => throw new NotImplementedException();
    public IRepository<OrderItem> OrderItems => throw new NotImplementedException();
    public IRepository<UserConsent> UserConsents => throw new NotImplementedException();
    public IRepository<VendorWallet> VendorWallets => throw new NotImplementedException();
    public IRepository<WalletTransaction> WalletTransactions => throw new NotImplementedException();
    public IRepository<PayoutRequest> PayoutRequests => throw new NotImplementedException();
    public IRepository<Review> Reviews => throw new NotImplementedException();
    public IRepository<ReviewReport> ReviewReports => throw new NotImplementedException();
    public IRepository<UserDeviceToken> UserDeviceTokens => throw new NotImplementedException();
    public IRepository<ProductVariant> ProductVariants => throw new NotImplementedException();
    public IRepository<Coupon> Coupons => throw new NotImplementedException();
    public IRepository<CouponUsage> CouponUsages => throw new NotImplementedException();
    public IRepository<BuyerWallet> BuyerWallets => throw new NotImplementedException();
    public IRepository<BuyerWalletTransaction> BuyerWalletTransactions => throw new NotImplementedException();
    public IRepository<VerificationCode> VerificationCodes => throw new NotImplementedException();
    public IRepository<RefreshToken> RefreshTokens => throw new NotImplementedException();
    public IRepository<ExternalLogin> ExternalLogins => throw new NotImplementedException();
    public IRepository<WishlistItem> WishlistItems => throw new NotImplementedException();
    public IRepository<UserNotification> UserNotifications => throw new NotImplementedException();
    public IRepository<AdminAuditLog> AdminAuditLogs => throw new NotImplementedException();
    public IRepository<CodBlacklistEntry> CodBlacklistEntries => throw new NotImplementedException();
    public IRepository<ProcessedWebhookEvent> ProcessedWebhookEvents => throw new NotImplementedException();
    public IRepository<PrivacySubjectRequest> PrivacySubjectRequests => throw new NotImplementedException();
    public IRepository<ProcessorDeletionLog> ProcessorDeletionLogs => throw new NotImplementedException();
    public IRepository<PrivacyIncidentLog> PrivacyIncidentLogs => throw new NotImplementedException();
    public IRepository<ExchangeRequest> ExchangeRequests => throw new NotImplementedException();
    public IRepository<SupportTicket> SupportTickets => throw new NotImplementedException();
    public IRepository<SupportTicketMessage> SupportTicketMessages => throw new NotImplementedException();
    public IRepository<CarrierRemittanceBatch> CarrierRemittanceBatches => throw new NotImplementedException();
    public IRepository<TaxInvoice> TaxInvoices => throw new NotImplementedException();

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
    public Task BeginTransactionAsync() => Task.CompletedTask;
    public Task CommitTransactionAsync() => Task.CompletedTask;
    public Task RollbackTransactionAsync() => Task.CompletedTask;
    public void ClearChangeTracker() { }
    public Task<int> ExecuteSqlRawAsync(string sql, params object[] parameters) => Task.FromResult(0);
    public Task RecomputeProductRatingAsync(int productId) => Task.CompletedTask;
    public void Dispose() { }
}
