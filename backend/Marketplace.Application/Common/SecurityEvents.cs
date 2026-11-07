using System.Text.Json;
using System.Text.Json.Serialization;

namespace Marketplace.Application.Common;

public enum SecurityEventCategory
{
    Authentication,
    Authorization,
    MarketplaceFraud,
    Infrastructure,
    ExternalIntegration,
    PrivacyAndDataProtection
}

public enum SecurityEventSeverity
{
    Informational,
    Warning,
    Error,
    Critical
}

public enum SecurityEventOutcome
{
    Success,
    Failure,
    Blocked
}

public static class SecurityEventIds
{
    // Authentication
    public const string AuthLoginSuccess = "SEC_AUTH_LOGIN_SUCCESS";
    public const string AuthLoginFailed = "SEC_AUTH_LOGIN_FAILED";
    public const string AuthBruteForceDetected = "SEC_AUTH_BRUTE_FORCE_DETECTED";
    public const string AuthTokenRefreshSuccess = "SEC_AUTH_TOKEN_REFRESH_SUCCESS";
    public const string AuthTokenRefreshFailed = "SEC_AUTH_TOKEN_REFRESH_FAILED";
    public const string AuthTokenReuseDetected = "SEC_AUTH_TOKEN_REUSE_DETECTED";
    public const string AuthSessionRevoked = "SEC_AUTH_SESSION_REVOKED";
    public const string Auth2FaFailed = "SEC_AUTH_2FA_FAILED";
    public const string AuthStepUpFailed = "SEC_AUTH_STEPUP_FAILED";

    // Authorization
    public const string AuthzUnauthorized = "SEC_AUTHZ_UNAUTHORIZED";
    public const string AuthzForbidden = "SEC_AUTHZ_FORBIDDEN";
    public const string AuthzCrossTenantAttempt = "SEC_AUTHZ_CROSS_TENANT_ATTEMPT";
    public const string AuthzPrivilegeEscalation = "SEC_AUTHZ_PRIVILEGE_ESCALATION";
    public const string AuthzAdminRouteBlocked = "SEC_AUTHZ_ADMIN_ROUTE_BLOCKED";

    // Marketplace Fraud
    public const string FraudPriceManipulation = "SEC_FRAUD_PRICE_MANIPULATION";
    public const string FraudDiscountTampering = "SEC_FRAUD_DISCOUNT_TAMPERING";
    public const string FraudShippingTampering = "SEC_FRAUD_SHIPPING_TAMPERING";
    public const string FraudConcurrencyRace = "SEC_FRAUD_CONCURRENCY_RACE";
    public const string FraudIdempotencyReplayed = "SEC_FRAUD_IDEMPOTENCY_REPLAYED";
    public const string FraudCouponAbuse = "SEC_FRAUD_COUPON_ABUSE";
    public const string FraudCodRefusalExceeded = "SEC_FRAUD_COD_REFUSAL_EXCEEDED";
    public const string FraudWalletTampering = "SEC_FRAUD_WALLET_TAMPERING";
    public const string FraudDuplicateSettlement = "SEC_FRAUD_DUPLICATE_SETTLEMENT";

    // Infrastructure
    public const string InfraKestrelLimitExceeded = "SEC_INFRA_KESTREL_LIMIT_EXCEEDED";
    public const string InfraDevRouteBlocked = "SEC_INFRA_DEV_ROUTE_BLOCKED";
    public const string InfraPathTraversalBlocked = "SEC_INFRA_PATH_TRAVERSAL_BLOCKED";
    public const string InfraSwaggerBlocked = "SEC_INFRA_SWAGGER_BLOCKED";
    public const string InfraAdminPortalDisabled = "SEC_INFRA_ADMIN_PORTAL_DISABLED";

    // External Integration
    public const string IntegrationWebhookValid = "SEC_INTEGRATION_WEBHOOK_VALID";
    public const string IntegrationWebhookTampered = "SEC_INTEGRATION_WEBHOOK_TAMPERED";
    public const string IntegrationWebhookExpired = "SEC_INTEGRATION_WEBHOOK_EXPIRED";
    public const string IntegrationWebhookReplayed = "SEC_INTEGRATION_WEBHOOK_REPLAYED";
    public const string IntegrationSsrfBlocked = "SEC_INTEGRATION_SSRF_BLOCKED";

    // Privacy
    public const string PrivacyExportRequested = "SEC_PRIVACY_EXPORT_REQUESTED";
    public const string PrivacyDeletionExecuted = "SEC_PRIVACY_DELETION_EXECUTED";
    public const string PrivacyIncidentReported = "SEC_PRIVACY_INCIDENT_REPORTED";
}

public sealed record SecurityEvent
{
    [JsonPropertyName("timestamp")]
    public DateTime TimestampUtc { get; init; } = DateTime.UtcNow;

    [JsonPropertyName("eventId")]
    public string EventId { get; init; } = string.Empty;

    [JsonPropertyName("category")]
    public SecurityEventCategory Category { get; init; }

    [JsonPropertyName("severity")]
    public SecurityEventSeverity Severity { get; init; }

    [JsonPropertyName("actorId")]
    public string? ActorId { get; init; }

    [JsonPropertyName("actorRole")]
    public string? ActorRole { get; init; }

    [JsonPropertyName("clientIp")]
    public string? ClientIp { get; init; }

    [JsonPropertyName("userAgent")]
    public string? UserAgent { get; init; }

    [JsonPropertyName("correlationId")]
    public string? CorrelationId { get; init; }

    [JsonPropertyName("targetResource")]
    public string TargetResource { get; init; } = string.Empty;

    [JsonPropertyName("outcome")]
    public SecurityEventOutcome Outcome { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    [JsonPropertyName("metadata")]
    public Dictionary<string, object?> Metadata { get; init; } = new(StringComparer.OrdinalIgnoreCase);
}

public interface ISecurityEventLogger
{
    void LogSecurityEvent(SecurityEvent evt);

    void LogAuthEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null);

    void LogAuthzEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string? actorRole,
        string resource,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason);

    void LogFraudEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string resource,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null);

    void LogIntegrationEvent(
        string eventId,
        SecurityEventSeverity severity,
        string provider,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null);
}
