using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Interfaces;

public interface IFileRetentionService
{
    DateTime CalculateRetentionExpiry(FileCategory category, DateTime uploadTime);
    Task<bool> CanDeleteFileAsync(UploadedFile file);
    Task<bool> SetLegalHoldAsync(string fileName, bool isHold, int requestedByUserId);
    Task<int> PurgeExpiredFilesAsync(CancellationToken cancellationToken = default);
}
