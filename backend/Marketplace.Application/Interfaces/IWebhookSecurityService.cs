using Marketplace.Domain.Entities;

namespace Marketplace.Application.Interfaces;

public interface IWebhookSecurityService
{
    bool VerifyBostaSignature(byte[] rawBodyBytes, string? signatureHeader, string webhookSecret);
    bool VerifyTimestamp(DateTime? timestamp, int maxAgeSeconds = 300);
    Task<bool> IsEventProcessedAsync(string provider, string eventId);
    Task<bool> TryRecordProcessedEventAsync(ProcessedWebhookEvent evt);
}
