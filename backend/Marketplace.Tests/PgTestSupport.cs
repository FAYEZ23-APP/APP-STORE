using Microsoft.EntityFrameworkCore;
using Marketplace.Infrastructure.Data;
using Xunit;

namespace Marketplace.Tests;

/// <summary>
/// Fact that runs ONLY against a PostgreSQL database named *_test supplied via TEST_DB (project rule 3).
/// If TEST_DB is unset / not PostgreSQL / not a _test database the test is reported as SKIPPED (= NOT RUN),
/// never silently passed and never switched to InMemory.
/// </summary>
public sealed class PgFactAttribute : FactAttribute
{
    public PgFactAttribute()
    {
        var reason = PgTestDb.UnavailableReason();
        if (reason != null) Skip = "NOT RUN: " + reason;
    }
}

public static class PgTestDb
{
    public static string? ConnectionString()
    {
        var v = Environment.GetEnvironmentVariable("TEST_DB");
        if (string.IsNullOrWhiteSpace(v))
        {
            try { v = Environment.GetEnvironmentVariable("TEST_DB", EnvironmentVariableTarget.User); } catch { }
        }
        return string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    }

    public static string? UnavailableReason()
    {
        var cs = ConnectionString();
        if (cs == null) return "TEST_DB is unset.";
        var lower = cs.ToLowerInvariant();
        if (lower.Contains("inmemory") || (!lower.Contains("host=") && !lower.Contains("server=")))
            return "TEST_DB is not a PostgreSQL connection string.";
        var m = System.Text.RegularExpressions.Regex.Match(cs, @"(?:^|;)\s*database\s*=\s*([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!m.Success || !m.Groups[1].Value.Trim().EndsWith("_test", StringComparison.OrdinalIgnoreCase))
            return "TEST_DB database name must end with '_test'.";
        return null;
    }

    public static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString()!)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .Options;
        return new AppDbContext(options);
    }
}
