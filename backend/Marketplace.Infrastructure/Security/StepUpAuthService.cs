using System.Collections.Concurrent;
using System.Security.Cryptography;
using Marketplace.Application.Exceptions;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Security;

public class StepUpAuthService : IStepUpAuthService
{
    private class StepUpGrant
    {
        public string Token { get; set; } = string.Empty;
        public int AdminId { get; set; }
        public string Scope { get; set; } = string.Empty;
        public string? TargetEntity { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsConsumed { get; set; }
        public DateTime? ConsumedAt { get; set; }
        public string Method { get; set; } = string.Empty;
    }

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPasswordHasher _hasher;
    private readonly ITotpService _totp;
    private readonly ILogger<StepUpAuthService> _logger;

    private readonly ConcurrentDictionary<string, StepUpGrant> _grants = new();
    private readonly ConcurrentDictionary<int, (int FailureCount, DateTime LastFailure)> _rateLimits = new();

    public StepUpAuthService(
        IServiceScopeFactory scopeFactory,
        IPasswordHasher hasher,
        ITotpService totp,
        ILogger<StepUpAuthService> logger)
    {
        _scopeFactory = scopeFactory;
        _hasher = hasher;
        _totp = totp;
        _logger = logger;
    }

    public async Task<StepUpChallengeResponse> ChallengeAsync(
        int adminId,
        StepUpChallengeRequest request,
        string? clientIp,
        CancellationToken cancellationToken = default)
    {
        CleanupExpiredGrants();

        using var scope = _scopeFactory.CreateScope();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var admin = await uow.Users.GetByIdAsync(adminId);
        if (admin == null || admin.Role != UserRole.Admin || !admin.IsActive)
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                $"Re-authentication rejected: User is not an active Admin. IP: {clientIp ?? "unknown"}", cancellationToken);
            throw new ForbiddenException("صلاحية المشرف مطلوبة لإجراء هذه العملية (Admin role required).");
        }

        // Rate limiting: max 5 failed attempts per 15 minutes
        if (_rateLimits.TryGetValue(adminId, out var rateInfo))
        {
            if (rateInfo.FailureCount >= 5 && (DateTime.UtcNow - rateInfo.LastFailure).TotalMinutes < 15)
            {
                await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                    $"Re-authentication rejected: Rate limit exceeded (5 failed attempts). IP: {clientIp ?? "unknown"}", cancellationToken);
                throw new TooManyRequestsException("تم تجاوز الحد الأقصى لمحاولات المصادقة الإضافية (5 محاولات). يرجى المحاولة بعد 15 دقيقة.");
            }
            if ((DateTime.UtcNow - rateInfo.LastFailure).TotalMinutes >= 15)
            {
                _rateLimits.TryRemove(adminId, out _);
            }
        }

        // 1. Password Verification
        if (string.IsNullOrWhiteSpace(request.Password))
        {
            RecordFailure(adminId);
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                $"Re-authentication failed: Missing password. IP: {clientIp ?? "unknown"}", cancellationToken);
            throw new UnauthorizedException("كلمة مرور المشرف مطلوبة لتأكيد العملية (Admin step-up password is required).");
        }

        if (!_hasher.Verify(request.Password, admin.PasswordHash ?? string.Empty))
        {
            RecordFailure(adminId);
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                $"Re-authentication failed: Invalid password. IP: {clientIp ?? "unknown"}", cancellationToken);
            throw new UnauthorizedException("كلمة مرور المشرف غير صحيحة (Invalid admin password).");
        }

        // 2. TOTP 2FA Verification (if configured on user)
        var method = "Password";
        if (admin.IsTwoFactorEnabled && !string.IsNullOrWhiteSpace(admin.TwoFactorSecret))
        {
            method = "Password+TOTP";
            if (string.IsNullOrWhiteSpace(request.TotpCode))
            {
                RecordFailure(adminId);
                await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                    $"Re-authentication failed: Missing required TOTP code. IP: {clientIp ?? "unknown"}", cancellationToken);
                throw new UnauthorizedException("رمز المصادقة الثنائية (TOTP) مطلوب لإتمام العملية (Admin step-up TOTP code is required).");
            }

            if (!_totp.VerifyCode(admin.TwoFactorSecret, request.TotpCode.Trim()))
            {
                RecordFailure(adminId);
                await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
                    $"Re-authentication failed: Invalid or expired TOTP code. IP: {clientIp ?? "unknown"}", cancellationToken);
                throw new UnauthorizedException("رمز المصادقة الثنائية (TOTP) غير صحيح أو منتهي الصلاحية (Invalid or expired TOTP code).");
            }
        }

        // Reset rate limit on success
        _rateLimits.TryRemove(adminId, out _);

        // Issue 5-minute single-use step-up grant
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var expiresAt = DateTime.UtcNow.AddMinutes(5);

        var grant = new StepUpGrant
        {
            Token = rawToken,
            AdminId = adminId,
            Scope = request.Scope?.Trim() ?? "*",
            TargetEntity = request.TargetEntity?.Trim(),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            IsConsumed = false,
            Method = method
        };

        _grants[rawToken] = grant;

        await RecordAuditLogInScopeAsync(uow, adminId, "StepUpChallenge", request.Scope, request.TargetEntity,
            $"Re-authentication successful. Method: {method}. Scope: {grant.Scope}. Target: {grant.TargetEntity ?? "any"}.", cancellationToken);

        _logger.LogInformation("Admin #{AdminId} successfully completed step-up re-authentication ({Method}) for scope {Scope}",
            adminId, method, grant.Scope);

        return new StepUpChallengeResponse
        {
            StepUpToken = rawToken,
            Scope = grant.Scope,
            ExpiresInSeconds = 300,
            ExpiresAt = expiresAt,
            Method = method
        };
    }

    public async Task<bool> ValidateAndConsumeGrantAsync(
        int adminId,
        string? stepUpToken,
        string requiredScope,
        string? targetEntity = null,
        CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        if (string.IsNullOrWhiteSpace(stepUpToken))
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Missing X-Step-Up-Token header for sensitive operation '{requiredScope}'.", cancellationToken);
            throw new ForbiddenException("مطلوب تأكيد الهوية مسبقاً (Step-Up Authentication) لإجراء هذه العملية الحساسة.");
        }

        if (!_grants.TryGetValue(stepUpToken.Trim(), out var grant))
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Invalid or non-existent step-up token for sensitive operation '{requiredScope}'.", cancellationToken);
            throw new ForbiddenException("رمز المصادقة الإضافية غير صحيح أو غير مسجل (Invalid step-up token).");
        }

        if (grant.AdminId != adminId)
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Step-up token admin mismatch (Expected: {grant.AdminId}, Actual: {adminId}).", cancellationToken);
            throw new ForbiddenException("رمز المصادقة الإضافية لا يخص المشرف الحالي (Admin identity mismatch).");
        }

        if (DateTime.UtcNow > grant.ExpiresAt)
        {
            _grants.TryRemove(stepUpToken.Trim(), out _);
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Step-up token expired at {grant.ExpiresAt:u}.", cancellationToken);
            throw new ForbiddenException("انتهت صلاحية رمز المصادقة الإضافية. يرجى إعادة تأكيد كلمة المرور (Step-up token expired).");
        }

        if (grant.IsConsumed)
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Attempted replay of already consumed step-up token (ConsumedAt: {grant.ConsumedAt:u}).", cancellationToken);
            throw new ForbiddenException("تم استخدام رمز المصادقة الإضافية مسبقاً ولا يمكن إعادة استخدامه (Token already consumed / replay detected).");
        }

        // Scope validation
        if (grant.Scope != "*" && !string.Equals(grant.Scope, requiredScope, StringComparison.OrdinalIgnoreCase))
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Scope mismatch (Token scope: '{grant.Scope}', Required scope: '{requiredScope}').", cancellationToken);
            throw new ForbiddenException($"نطاق رمز المصادقة الإضافية '{grant.Scope}' لا يطابق العملية المطلوبة '{requiredScope}'.");
        }

        // Target Entity validation (if specified in grant)
        if (!string.IsNullOrWhiteSpace(grant.TargetEntity) &&
            !string.IsNullOrWhiteSpace(targetEntity) &&
            !string.Equals(grant.TargetEntity, targetEntity, StringComparison.OrdinalIgnoreCase))
        {
            await RecordAuditLogInScopeAsync(uow, adminId, "StepUpViolation", requiredScope, targetEntity,
                $"Rejected: Target entity mismatch (Token entity: '{grant.TargetEntity}', Requested entity: '{targetEntity}').", cancellationToken);
            throw new ForbiddenException("رمز المصادقة الإضافية مخصص لكيان آخر ولا يمكن استخدامه لهذا الكيان.");
        }

        // Atomic one-time consumption (single-use guarantee)
        grant.IsConsumed = true;
        grant.ConsumedAt = DateTime.UtcNow;

        await RecordAuditLogInScopeAsync(uow, adminId, "StepUpConsumed", requiredScope, targetEntity,
            $"Step-up grant successfully consumed for operation '{requiredScope}' on entity {targetEntity ?? "N/A"}.", cancellationToken);

        _logger.LogInformation("Step-up grant consumed by Admin #{AdminId} for {Scope} on entity {Target}",
            adminId, requiredScope, targetEntity ?? "N/A");

        return true;
    }

    private void RecordFailure(int adminId)
    {
        _rateLimits.AddOrUpdate(
            adminId,
            _ => (1, DateTime.UtcNow),
            (_, existing) => (existing.FailureCount + 1, DateTime.UtcNow));
    }

    private void CleanupExpiredGrants()
    {
        var now = DateTime.UtcNow;
        var expiredTokens = _grants
            .Where(kv => kv.Value.ExpiresAt < now.AddMinutes(-5))
            .Select(kv => kv.Key)
            .ToList();

        foreach (var tok in expiredTokens)
        {
            _grants.TryRemove(tok, out _);
        }
    }

    private static async Task RecordAuditLogInScopeAsync(
        IUnitOfWork uow,
        int adminId,
        string action,
        string? scope,
        string? targetEntity,
        string details,
        CancellationToken cancellationToken)
    {
        try
        {
            await uow.AdminAuditLogs.AddAsync(new AdminAuditLog
            {
                AdminId = adminId,
                Action = action,
                EntityType = scope ?? "StepUp",
                EntityId = targetEntity,
                Details = details,
                CreatedAt = DateTime.UtcNow
            });
            await uow.SaveChangesAsync();
        }
        catch
        {
            // Logging failure should not mask business errors
        }
    }
}
