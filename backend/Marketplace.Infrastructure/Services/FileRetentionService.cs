using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Services;

public class FileRetentionService : IFileRetentionService
{
    private readonly IUnitOfWork _uow;
    private readonly IFileStorageProvider _storageProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FileRetentionService> _logger;

    public FileRetentionService(
        IUnitOfWork uow,
        IFileStorageProvider storageProvider,
        IConfiguration configuration,
        ILogger<FileRetentionService> logger)
    {
        _uow = uow;
        _storageProvider = storageProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public DateTime CalculateRetentionExpiry(FileCategory category, DateTime uploadTime)
    {
        var tempHours = _configuration.GetValue<int>("Uploads:TemporaryUploadRetentionHours", 24);
        var disputeDays = _configuration.GetValue<int>("Uploads:DisputeDocumentRetentionDays", 180);
        var mediaYears = _configuration.GetValue<int>("Uploads:MediaRetentionYears", 10);

        return category switch
        {
            FileCategory.TemporaryUpload => uploadTime.AddHours(tempHours),
            FileCategory.DisputeEvidence or FileCategory.ReturnEvidence => uploadTime.AddDays(disputeDays),
            _ => uploadTime.AddYears(mediaYears)
        };
    }

    public async Task<bool> CanDeleteFileAsync(UploadedFile file)
    {
        if (file == null || file.IsDeleted)
        {
            return false;
        }

        // Prohibited when under legal or operational hold
        if (file.IsLegalHold)
        {
            _logger.LogWarning("Deletion blocked: file '{FileName}' is flagged with an active legal hold.", file.FileName);
            return false;
        }

        // Prohibited when associated with an active return or dispute
        if (file.Category is FileCategory.ReturnEvidence or FileCategory.DisputeEvidence)
        {
            var activeReturns = await _uow.ReturnRequests.FindAsync(r =>
                r.DefectImageUrl != null &&
                (r.DefectImageUrl.Contains(file.FileName) || r.DefectImageUrl == file.RelativeUrl) &&
                r.Status != ReturnStatus.Rejected &&
                r.Status != ReturnStatus.Completed);

            if (activeReturns.Any())
            {
                _logger.LogWarning("Deletion blocked: file '{FileName}' belongs to an active unresolved return or dispute.", file.FileName);
                return false;
            }
        }

        return true;
    }

    public async Task<bool> SetLegalHoldAsync(string fileName, bool isHold, int requestedByUserId)
    {
        var safeFileName = Path.GetFileName(fileName);
        var file = (await _uow.UploadedFiles.FindAsync(f => !f.IsDeleted && f.FileName == safeFileName)).FirstOrDefault();
        if (file == null)
        {
            return false;
        }

        file.IsLegalHold = isHold;
        await _uow.SaveChangesAsync();

        _logger.LogInformation("Legal hold set to {IsHold} on file '{FileName}' by user {UserId}.", isHold, safeFileName, requestedByUserId);
        return true;
    }

    public async Task<int> PurgeExpiredFilesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var expiredFiles = (await _uow.UploadedFiles.FindAsync(f =>
            !f.IsDeleted &&
            !f.IsLegalHold &&
            f.RetentionExpiresAt != null &&
            f.RetentionExpiresAt <= now)).ToList();

        var purgedCount = 0;
        foreach (var file in expiredFiles)
        {
            if (!await CanDeleteFileAsync(file))
            {
                continue;
            }

            try
            {
                var deleted = await _storageProvider.DeleteFileAsync(file.FileName, file.IsPrivate, cancellationToken);
                file.IsDeleted = true;
                file.DeletedAt = DateTime.UtcNow;
                purgedCount++;

                _logger.LogInformation("Purged expired file '{FileName}' (Category: {Category}, WasDeletedFromStorage: {Deleted}).",
                    file.FileName, file.Category, deleted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to purge expired file '{FileName}'.", file.FileName);
            }
        }

        if (purgedCount > 0)
        {
            await _uow.SaveChangesAsync();
        }

        return purgedCount;
    }
}
