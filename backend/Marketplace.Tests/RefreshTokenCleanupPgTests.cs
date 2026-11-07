using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Marketplace.Infrastructure.BackgroundServices;
using Marketplace.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Marketplace.Tests;

/// <summary>PostgreSQL-only (TEST_DB) tests for RefreshTokenCleanupService. Skipped (NOT RUN) without TEST_DB.</summary>
public class RefreshTokenCleanupPgTests
{
    private const long AdvisoryLockKey = 0x52544B43_4C4E50L;

    private static IConfiguration Config(int batchSize = 500, int retentionDays = 30) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Auth:RefreshTokenCleanup:BatchSize"] = batchSize.ToString(),
            ["Auth:RefreshTokenCleanup:SecurityRetentionDays"] = retentionDays.ToString(),
            ["Auth:RefreshTokenCleanup:MaxBatchesPerRun"] = "100",
        }).Build();

    private static IServiceScopeFactory RealScopes()
    {
        var sc = new ServiceCollection();
        sc.AddScoped(_ => PgTestDb.CreateContext());
        return sc.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private static async Task<AppDbContext> PreparedContextAsync()
    {
        var db = PgTestDb.CreateContext();
        db.AssertSafeForDestructiveOperations();
        await db.Database.MigrateAsync(); // test DB only (name must end with _test)
        return db;
    }

    private static async Task<User> NewUserAsync(AppDbContext db)
    {
        var u = new User
        {
            Name = "Cleanup Test",
            Email = $"cleanup_{Guid.NewGuid():N}@example.com",
            Role = UserRole.Buyer,
            IsActive = true,
            PasswordHash = "x"
        };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u;
    }

    private static RefreshToken Tok(int userId, Guid family, DateTime expires, DateTime? revoked = null, DateTime? consumed = null) => new()
    {
        UserId = userId,
        FamilyId = family,
        TokenHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
        DeviceId = "dev-" + family.ToString("N")[..8],
        CreatedAt = DateTime.UtcNow.AddDays(-60),
        ExpiresAt = expires,
        RevokedAt = revoked,
        ConsumedAt = consumed
    };

    [PgFact]
    public async Task Test13_14_ExpiredTokensDeleted_RevokedTokensKeptForSecurityRetention_LiveSessionsUntouched()
    {
        await using var db = await PreparedContextAsync();
        var user = await NewUserAsync(db);
        var now = DateTime.UtcNow;

        var expiredOld = Tok(user.Id, Guid.NewGuid(), now.AddDays(-40));                              // dead, old -> delete
        var revokedRecent = Tok(user.Id, Guid.NewGuid(), now.AddDays(20), revoked: now.AddDays(-5));  // dead, recent -> keep (evidence)
        var revokedOld = Tok(user.Id, Guid.NewGuid(), now.AddDays(20), revoked: now.AddDays(-40));    // dead, old -> delete

        var liveFamily = Guid.NewGuid();
        var rotatedOld = Tok(user.Id, liveFamily, now.AddDays(20), revoked: now.AddDays(-40), consumed: now.AddDays(-40)); // rotated, old -> delete
        var liveActive = Tok(user.Id, liveFamily, now.AddDays(20));                                                     // live -> keep

        var mixedFamily = Guid.NewGuid();
        var revokedOldButFamilyLive = Tok(user.Id, mixedFamily, now.AddDays(20), revoked: now.AddDays(-40)); // old revoked but family has live token -> keep
        var mixedLive = Tok(user.Id, mixedFamily, now.AddDays(20));

        db.RefreshTokens.AddRange(expiredOld, revokedRecent, revokedOld, rotatedOld, liveActive, revokedOldButFamilyLive, mixedLive);
        await db.SaveChangesAsync();
        rotatedOld.ReplacedByTokenId = liveActive.Id; // self-FK that must be handled safely
        await db.SaveChangesAsync();

        var svc = new RefreshTokenCleanupService(RealScopes(), Config(), NullLogger<RefreshTokenCleanupService>.Instance);
        var deleted = await svc.PurgeExpiredTokensAsync();

        await using var verify = PgTestDb.CreateContext();
        var ids = new[] { expiredOld.Id, revokedRecent.Id, revokedOld.Id, rotatedOld.Id, liveActive.Id, revokedOldButFamilyLive.Id, mixedLive.Id };
        var remaining = (await verify.RefreshTokens.Where(t => ids.Contains(t.Id)).Select(t => t.Id).ToListAsync()).ToHashSet();

        Assert.True(deleted >= 3);
        Assert.DoesNotContain(expiredOld.Id, remaining);
        Assert.DoesNotContain(revokedOld.Id, remaining);
        Assert.DoesNotContain(rotatedOld.Id, remaining);
        Assert.Contains(revokedRecent.Id, remaining);          // security retention
        Assert.Contains(liveActive.Id, remaining);             // live session
        Assert.Contains(revokedOldButFamilyLive.Id, remaining);
        Assert.Contains(mixedLive.Id, remaining);

        var m = svc.GetMetrics();
        Assert.Equal(0, m.ConsecutiveFailures);
        Assert.True(m.TotalDeleted >= 3);
        Assert.NotNull(m.LastSuccessAt);
    }

    [PgFact]
    public async Task Test13b_LargeBacklog_IsDeletedInBoundedBatches()
    {
        await using var db = await PreparedContextAsync();
        var user = await NewUserAsync(db);
        var old = DateTime.UtcNow.AddDays(-90);
        var batch = Enumerable.Range(0, 35).Select(_ => Tok(user.Id, Guid.NewGuid(), old)).ToList();
        db.RefreshTokens.AddRange(batch);
        await db.SaveChangesAsync();

        var svc = new RefreshTokenCleanupService(RealScopes(), Config(batchSize: 10), NullLogger<RefreshTokenCleanupService>.Instance);
        var deleted = await svc.PurgeExpiredTokensAsync();

        await using var verify = PgTestDb.CreateContext();
        var ids = batch.Select(t => t.Id).ToList();
        Assert.Equal(0, await verify.RefreshTokens.CountAsync(t => ids.Contains(t.Id)));
        Assert.True(deleted >= 35);
    }

    [PgFact]
    public async Task Test15_DatabaseFailure_IsHandledSafely_AndNextRunRecovers()
    {
        await using var db = await PreparedContextAsync();

        var calls = 0;
        var real = RealScopes();
        var flaky = new FlakyScopeFactory(real, () => calls++ == 0);

        var svc = new RefreshTokenCleanupService(flaky, Config(), NullLogger<RefreshTokenCleanupService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.PurgeExpiredTokensAsync());
        var failed = svc.GetMetrics();
        Assert.Equal(1, failed.ConsecutiveFailures);
        Assert.Equal(nameof(InvalidOperationException), failed.LastFailureType);
        Assert.NotNull(failed.LastFailureAt);

        var deleted = await svc.PurgeExpiredTokensAsync(); // retry succeeds
        var ok = svc.GetMetrics();
        Assert.True(deleted >= 0);
        Assert.Equal(0, ok.ConsecutiveFailures);
        Assert.Null(ok.LastFailureType);
        Assert.NotNull(ok.LastSuccessAt);
    }

    [PgFact]
    public async Task Test15b_ConcurrentCleanup_IsPreventedByAdvisoryLock()
    {
        await using var db = await PreparedContextAsync();
        var user = await NewUserAsync(db);
        var dead = Tok(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-90));
        db.RefreshTokens.Add(dead);
        await db.SaveChangesAsync();

        // Another "instance" holds the cleanup lock on its own session.
        await using var holder = PgTestDb.CreateContext();
        var conn = holder.Database.GetDbConnection();
        await conn.OpenAsync();
        try
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $"SELECT pg_advisory_lock({AdvisoryLockKey})";
                await cmd.ExecuteScalarAsync();
            }

            var svc = new RefreshTokenCleanupService(RealScopes(), Config(), NullLogger<RefreshTokenCleanupService>.Instance);
            var deleted = await svc.PurgeExpiredTokensAsync();

            Assert.Equal(0, deleted);
            Assert.True(svc.GetMetrics().SkippedBecauseLocked >= 1);
            await using var verify = PgTestDb.CreateContext();
            Assert.True(await verify.RefreshTokens.AnyAsync(t => t.Id == dead.Id)); // untouched while locked
        }
        finally
        {
            using var unlock = conn.CreateCommand();
            unlock.CommandText = $"SELECT pg_advisory_unlock({AdvisoryLockKey})";
            await unlock.ExecuteScalarAsync();
            await conn.CloseAsync();
        }
    }

    private sealed class FlakyScopeFactory : IServiceScopeFactory
    {
        private readonly IServiceScopeFactory _inner;
        private readonly Func<bool> _failNow;
        public FlakyScopeFactory(IServiceScopeFactory inner, Func<bool> failNow) { _inner = inner; _failNow = failNow; }
        public IServiceScope CreateScope()
        {
            if (_failNow()) throw new InvalidOperationException("simulated database outage");
            return _inner.CreateScope();
        }
    }
}
