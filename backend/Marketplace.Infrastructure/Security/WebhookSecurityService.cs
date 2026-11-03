using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Security;

public class WebhookSecurityService : IWebhookSecurityService
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<WebhookSecurityService> _logger;

    public WebhookSecurityService(IUnitOfWork uow, ILogger<WebhookSecurityService> logger)
    {
        _uow = uow;
        _logger = logger;
    }

    /// <summary>
    /// Verifies the carrier webhook HMAC-SHA256 signature against the exact raw request bytes.
    /// Utilizes constant-time comparison to prevent timing side-channel attacks.
    /// Supports hex format (with or without 'sha256=' prefix) and base64 format.
    /// </summary>
    public bool VerifyBostaSignature(byte[] rawBodyBytes, string? signatureHeader, string webhookSecret)
    {
        if (rawBodyBytes == null || rawBodyBytes.Length == 0 ||
            string.IsNullOrWhiteSpace(signatureHeader) ||
            string.IsNullOrWhiteSpace(webhookSecret))
        {
            return false;
        }

        var header = signatureHeader.Trim();
        if (header.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            header = header.Substring("sha256=".Length);
        }
        else if (header.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase))
        {
            header = header.Substring("sha256:".Length);
        }

        try
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
            var computedHash = hmac.ComputeHash(rawBodyBytes);
            var computedHex = Convert.ToHexString(computedHash);

            // Compare Hex format using constant-time comparison
            if (header.Length == computedHex.Length)
            {
                var headerBytes = Encoding.UTF8.GetBytes(header.ToUpperInvariant());
                var computedHexBytes = Encoding.UTF8.GetBytes(computedHex);
                if (CryptographicOperations.FixedTimeEquals(headerBytes, computedHexBytes))
                {
                    return true;
                }
            }

            // Compare Base64 format if header might be base64
            var computedBase64 = Convert.ToBase64String(computedHash);
            if (header.Length == computedBase64.Length)
            {
                var headerBytes = Encoding.UTF8.GetBytes(header);
                var computedB64Bytes = Encoding.UTF8.GetBytes(computedBase64);
                if (CryptographicOperations.FixedTimeEquals(headerBytes, computedB64Bytes))
                {
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while verifying Bosta webhook signature.");
            return false;
        }

        return false;
    }

    /// <summary>
    /// Verifies that the webhook timestamp is within the allowable window to prevent replay attacks.
    /// Rejects timestamps that are older than maxAgeSeconds or more than 60 seconds into the future.
    /// </summary>
    public bool VerifyTimestamp(DateTime? timestamp, int maxAgeSeconds = 300)
    {
        if (!timestamp.HasValue)
        {
            return false;
        }

        var utcNow = DateTime.UtcNow;
        var eventTime = timestamp.Value.ToUniversalTime();

        var ageSeconds = (utcNow - eventTime).TotalSeconds;

        // Allow at most 60 seconds of future clock skew, and at most maxAgeSeconds of historical age
        if (ageSeconds < -60 || ageSeconds > maxAgeSeconds)
        {
            _logger.LogWarning("Webhook timestamp out of valid bounds. EventTime: {EventTime}, Now: {Now}, AgeSeconds: {AgeSeconds}",
                eventTime, utcNow, ageSeconds);
            return false;
        }

        return true;
    }

    /// <summary>
    /// Checks whether an event with the given provider and provider event ID has already been processed.
    /// </summary>
    public async Task<bool> IsEventProcessedAsync(string provider, string eventId)
    {
        if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(eventId))
        {
            return false;
        }

        var existing = await _uow.ProcessedWebhookEvents.FindAsync(e => e.Provider == provider && e.EventId == eventId);
        return existing.Any();
    }

    /// <summary>
    /// Attempts to record a processed webhook event in the database.
    /// Enforces idempotency via the unique database index on (Provider, EventId).
    /// </summary>
    public async Task<bool> TryRecordProcessedEventAsync(ProcessedWebhookEvent evt)
    {
        try
        {
            await _uow.ProcessedWebhookEvents.AddAsync(evt);
            await _uow.SaveChangesAsync();
            return true;
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Duplicate webhook event race condition caught for provider {Provider}, event {EventId}",
                evt.Provider, evt.EventId);
            return false;
        }
    }
}
