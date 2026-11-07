using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.DTOs.Users;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Services;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Data;
using Marketplace.Infrastructure.Repositories;
using Marketplace.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Xunit;

namespace Marketplace.Tests;

/// <summary>
/// PostgreSQL-backed (TEST_DB) tests verifying Phase 4 BCrypt transparent migration,
/// refresh token rotation, token-family replay detection, grace-window removal,
/// logout/password-change session revocation, and multi-device isolation on real PostgreSQL tables.
/// </summary>
public class Phase4AuthAndRefreshTokenPgTests
{
    private const string TestPassword = "Phase4-Password-99!";

    private sealed class TestHostEnv : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "Marketplace.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class NoopGoogleValidator : IGoogleTokenValidator
    {
        public Task<GoogleUserInfo> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class NoopVerificationService : IVerificationService
    {
        public string NormalizeTarget(string target, out VerificationChannel channel)
        {
            channel = VerificationChannel.Email;
            return target.Trim().ToLowerInvariant();
        }
        public string MaskTarget(string target) => target;
        public Task<string> GenerateAndSendCodeAsync(User user, string target, VerificationChannel channel, VerificationPurpose purpose, string? clientIp = null, CancellationToken cancellationToken = default)
            => Task.FromResult("123456");
        public Task<VerificationCode> ValidateAndConsumeCodeAsync(string target, string code, VerificationPurpose purpose, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private static IConfiguration BuildConfig(int bcryptWorkFactor = 12) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Auth:BCryptWorkFactor"] = bcryptWorkFactor.ToString(),
            ["Auth:RequireVerification"] = "false",
            ["Auth:RefreshTokenLifetimeDays"] = "60",
            ["Auth:MaxActiveDevicesPerUser"] = "5",
            ["Admin:Require2FA"] = "false",
            ["Security:TwoFactorEncryptionKey"] = "Phase4UnitTestTwoFactorKey_AtLeast32Chars!"
        }).Build();

    private static (AuthService auth, UserService userSvc, AppDbContext db) CreateServices(int bcryptWorkFactor = 12)
    {
        var db = PgTestDb.CreateContext();
        db.AssertSafeForDestructiveOperations();
        var uow = new UnitOfWork(db);
        var hasher = new BCryptPasswordHasher(bcryptWorkFactor);
        var jwt = new JwtService(Options.Create(new JwtSettings
        {
            Key = "Phase4PgTestJwtSecretKey_MustBeAtLeast32BytesLong!",
            Issuer = "MarketplaceAPI",
            Audience = "MarketplaceClients",
            ExpiryMinutes = 15
        }));
        var cfg = BuildConfig(bcryptWorkFactor);
        var totp = new TotpService();
        var protector = new AesGcmSecretProtector(cfg, new TestHostEnv());
        var auth = new AuthService(uow, hasher, jwt, new NoopGoogleValidator(), new NoopVerificationService(), cfg, totp, protector);
        var userSvc = new UserService(uow, hasher, cfg, new NoopGoogleValidator());
        return (auth, userSvc, db);
    }

    private static string Sha256Hex(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();

    [PgFact]
    public async Task Test04_05_LegacyWorkFactorHash_AuthenticatesAndTransparentlyRehashesOnLogin()
    {
        var (auth, _, db) = CreateServices(bcryptWorkFactor: 12);
        await using var _ = db;
        await db.Database.MigrateAsync();

        var legacyHashCost10 = BCrypt.Net.BCrypt.HashPassword(TestPassword, 10);
        Assert.Equal("10", legacyHashCost10.Substring(4, 2));

        var email = $"rehash_{Guid.NewGuid():N}@example.com";
        var user = new User
        {
            Name = "Legacy Hash User",
            Email = email,
            Phone = $"+2010{Random.Shared.Next(10000000, 99999999)}",
            PasswordHash = legacyHashCost10,
            Role = UserRole.Buyer,
            IsActive = true,
            EmailVerifiedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // Login with legacy cost-10 hash succeeds
        var loginRes = await auth.LoginAsync(new LoginRequest
        {
            Identifier = email,
            Password = TestPassword,
            DeviceId = "dev-rehash-1"
        });
        Assert.False(string.IsNullOrWhiteSpace(loginRes.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(loginRes.RefreshToken));

        // Verify stored hash in PostgreSQL was transparently upgraded to cost 12 with a fresh salt
        await using var verifyDb = PgTestDb.CreateContext();
        var updatedUser = await verifyDb.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
        Assert.NotNull(updatedUser.PasswordHash);
        Assert.StartsWith("$2", updatedUser.PasswordHash);
        Assert.Equal("12", updatedUser.PasswordHash!.Substring(4, 2));
        Assert.NotEqual(legacyHashCost10, updatedUser.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify(TestPassword, updatedUser.PasswordHash));
    }

    [PgFact]
    public async Task Test07_08_09_TokenRotation_FamilyChain_AndImmediateReplayRevocationWithoutGraceWindow()
    {
        var (auth, _, db) = CreateServices(bcryptWorkFactor: 10);
        await using var _ = db;
        await db.Database.MigrateAsync();

        var email = $"family_{Guid.NewGuid():N}@example.com";
        var user = new User
        {
            Name = "Family Rotation User",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword, 10),
            Role = UserRole.Buyer,
            IsActive = true,
            EmailVerifiedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var login = await auth.LoginAsync(new LoginRequest
        {
            Identifier = email,
            Password = TestPassword,
            DeviceId = "device-family-1"
        });
        var t1Raw = login.RefreshToken!;
        var t1Hash = Sha256Hex(t1Raw);

        // Rotate T1 -> T2
        var (authRotate, _, dbRotate) = CreateServices(bcryptWorkFactor: 10);
        await using var _r = dbRotate;
        var rotated = await authRotate.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = t1Raw,
            DeviceId = "device-family-1"
        });
        var t2Raw = rotated.RefreshToken!;
        var t2Hash = Sha256Hex(t2Raw);
        Assert.NotEqual(t1Raw, t2Raw);

        // Inspect DB: T1 and T2 share FamilyId; T1 is ConsumedAt != null, RevokeReason == "Rotated", ReplacedByTokenId == T2.Id
        await using (var checkDb = PgTestDb.CreateContext())
        {
            var t1Row = await checkDb.RefreshTokens.AsNoTracking().FirstAsync(t => t.TokenHash == t1Hash);
            var t2Row = await checkDb.RefreshTokens.AsNoTracking().FirstAsync(t => t.TokenHash == t2Hash);

            Assert.NotEqual(Guid.Empty, t1Row.FamilyId);
            Assert.Equal(t1Row.FamilyId, t2Row.FamilyId);
            Assert.NotNull(t1Row.ConsumedAt);
            Assert.NotNull(t1Row.RevokedAt);
            Assert.Equal("Rotated", t1Row.RevokeReason);
            Assert.Equal(t2Row.Id, t1Row.ReplacedByTokenId);
            Assert.Null(t2Row.ConsumedAt);
            Assert.Null(t2Row.RevokedAt);
        }

        // Test 8 & 9: Immediately replay T1 (within milliseconds — inside the removed 20s grace window!) with the SAME DeviceId.
        // Must be rejected with UnauthorizedException and revoke the entire token family (including T2) + write AdminAuditLog.
        var (authReplay, _, dbReplay) = CreateServices(bcryptWorkFactor: 10);
        await using var _rep = dbReplay;
        await Assert.ThrowsAsync<UnauthorizedException>(() => authReplay.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = t1Raw,
            DeviceId = "device-family-1"
        }));

        // Verify T2 is now revoked with RevokeReason = "ReuseDetected" and cannot be used to refresh
        var (authT2, _, dbT2) = CreateServices(bcryptWorkFactor: 10);
        await using var _t2 = dbT2;
        await Assert.ThrowsAsync<UnauthorizedException>(() => authT2.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = t2Raw,
            DeviceId = "device-family-1"
        }));

        await using (var verifyDb = PgTestDb.CreateContext())
        {
            var t2RowAfter = await verifyDb.RefreshTokens.AsNoTracking().FirstAsync(t => t.TokenHash == t2Hash);
            Assert.NotNull(t2RowAfter.RevokedAt);
            Assert.Equal("ReuseDetected", t2RowAfter.RevokeReason);

            var familyIdStr = t2RowAfter.FamilyId.ToString();
            var auditExists = await verifyDb.AdminAuditLogs.AsNoTracking()
                .AnyAsync(a => a.Action == "RefreshTokenReuseDetected" && a.EntityId == familyIdStr);
            Assert.True(auditExists);
        }
    }

    [PgFact]
    public async Task Test06_ConcurrentRefreshCalls_AtomicConsumption_NeverLeavesMultipleActiveTokensInFamily()
    {
        var (authInit, _, dbInit) = CreateServices(bcryptWorkFactor: 10);
        await using var _ = dbInit;
        await dbInit.Database.MigrateAsync();

        var email = $"concurrent_{Guid.NewGuid():N}@example.com";
        var user = new User
        {
            Name = "Concurrent Refresh User",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword, 10),
            Role = UserRole.Buyer,
            IsActive = true,
            EmailVerifiedAt = DateTime.UtcNow
        };
        dbInit.Users.Add(user);
        await dbInit.SaveChangesAsync();

        var login = await authInit.LoginAsync(new LoginRequest
        {
            Identifier = email,
            Password = TestPassword,
            DeviceId = "device-concurrent-1"
        });
        var rawToken = login.RefreshToken!;
        var familyId = (await dbInit.RefreshTokens.AsNoTracking().FirstAsync(t => t.UserId == user.Id)).FamilyId;

        // Fire two concurrent refresh operations on separate DbContext instances with the exact same refresh token
        async Task<bool> TryRefreshAsync()
        {
            var (auth, _, db) = CreateServices(bcryptWorkFactor: 10);
            await using var _d = db;
            try
            {
                await auth.RefreshTokenAsync(new RefreshTokenRequest
                {
                    RefreshToken = rawToken,
                    DeviceId = "device-concurrent-1"
                });
                return true;
            }
            catch (UnauthorizedException)
            {
                return false;
            }
        }

        var results = await Task.WhenAll(TryRefreshAsync(), TryRefreshAsync());
        var successes = results.Count(r => r);

        // Exactly one request wins the atomic conditional UPDATE (`ConsumedAt IS NULL`), and the second request
        // sees `ConsumedAt != null` or `consumed == 0`, triggering replay detection and revoking the family!
        Assert.Equal(1, successes);

        await using var verifyDb = PgTestDb.CreateContext();
        var activeInFamily = await verifyDb.RefreshTokens.AsNoTracking()
            .CountAsync(t => t.FamilyId == familyId && t.RevokedAt == null);
        // Because the losing concurrent request triggered family revocation, 0 tokens remain active in the compromised family
        Assert.Equal(0, activeInFamily);
    }

    [PgFact]
    public async Task Test10_11_12_MultiDeviceIsolation_Logout_AndPasswordChangeRevocation()
    {
        var (auth, userSvc, db) = CreateServices(bcryptWorkFactor: 10);
        await using var _ = db;
        await db.Database.MigrateAsync();

        var email = $"multidev_{Guid.NewGuid():N}@example.com";
        var user = new User
        {
            Name = "Multi Device User",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword, 10),
            Role = UserRole.Buyer,
            IsActive = true,
            EmailVerifiedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        // Login on Device A and Device B
        var loginA = await auth.LoginAsync(new LoginRequest { Identifier = email, Password = TestPassword, DeviceId = "device-A" });
        var loginB = await auth.LoginAsync(new LoginRequest { Identifier = email, Password = TestPassword, DeviceId = "device-B" });
        var loginC = await auth.LoginAsync(new LoginRequest { Identifier = email, Password = TestPassword, DeviceId = "device-C" });

        // Rotate Device A (T_A1 -> T_A2), then replay T_A1 -> revokes Device A's family ONLY
        var (authA1, _, dbA1) = CreateServices(10);
        await using var _a1 = dbA1;
        var rotatedA = await authA1.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = loginA.RefreshToken!, DeviceId = "device-A" });

        var (authA2, _, dbA2) = CreateServices(10);
        await using var _a2 = dbA2;
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authA2.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = loginA.RefreshToken!, DeviceId = "device-A" }));

        // Device A's rotated token is revoked, but Device B and Device C are completely unaffected!
        var (authA3, _, dbA3) = CreateServices(10);
        await using var _a3 = dbA3;
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authA3.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = rotatedA.RefreshToken!, DeviceId = "device-A" }));

        var (authB1, _, dbB1) = CreateServices(10);
        await using var _b1 = dbB1;
        var rotatedB = await authB1.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = loginB.RefreshToken!, DeviceId = "device-B" });
        Assert.False(string.IsNullOrWhiteSpace(rotatedB.RefreshToken));

        // Test 10: Logout on Device B revokes Device B's token (RevokeReason = "Logout"), leaving Device C active
        var (authLogout, _, dbLogout) = CreateServices(10);
        await using var _lo = dbLogout;
        await authLogout.LogoutAsync(new LogoutRequest { RefreshToken = rotatedB.RefreshToken! });

        var (authB2, _, dbB2) = CreateServices(10);
        await using var _b2 = dbB2;
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authB2.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = rotatedB.RefreshToken!, DeviceId = "device-B" }));

        // Device C can still refresh prior to password change
        var (authC1, _, dbC1) = CreateServices(10);
        await using var _c1 = dbC1;
        var rotatedC = await authC1.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = loginC.RefreshToken!, DeviceId = "device-C" });
        Assert.False(string.IsNullOrWhiteSpace(rotatedC.RefreshToken));

        // Test 11: Password change revokes ALL remaining active refresh tokens (Device C) and increments TokenVersion
        var (_, userSvcPw, dbPw) = CreateServices(10);
        await using var _pw = dbPw;
        var newPass = "NewPhase4-Pass-88!";
        await userSvcPw.ChangePasswordAsync(user.Id, new ChangePasswordRequest
        {
            CurrentPassword = TestPassword,
            NewPassword = newPass
        });

        var (authC2, _, dbC2) = CreateServices(10);
        await using var _c2 = dbC2;
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authC2.RefreshTokenAsync(new RefreshTokenRequest { RefreshToken = rotatedC.RefreshToken!, DeviceId = "device-C" }));

        await using var verifyDb = PgTestDb.CreateContext();
        var cHash = Sha256Hex(rotatedC.RefreshToken!);
        var cRow = await verifyDb.RefreshTokens.AsNoTracking().FirstAsync(t => t.TokenHash == cHash);
        Assert.NotNull(cRow.RevokedAt);
        Assert.Equal("PasswordChange", cRow.RevokeReason);
    }
}
