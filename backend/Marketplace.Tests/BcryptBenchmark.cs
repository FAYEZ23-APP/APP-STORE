using System.Diagnostics;
using System.Text;
using Marketplace.Infrastructure.Auth;
using Xunit;

namespace Marketplace.Tests;

/// <summary>
/// Opt-in benchmark (set BCRYPT_BENCH=1). Writes measured hash/verify latencies per work factor to
/// backend/tests/bcrypt_benchmark.txt so the cost factor can be chosen on the target machine.
/// </summary>
public class BcryptBenchmark
{
    [Fact]
    public void Benchmark_WorkFactors()
    {
        if (Environment.GetEnvironmentVariable("BCRYPT_BENCH") != "1") return;

        var sb = new StringBuilder();
        sb.AppendLine($"Machine: {Environment.ProcessorCount} logical cores, OS={Environment.OSVersion}, Runtime={Environment.Version}");
        sb.AppendLine($"Date(UTC): {DateTime.UtcNow:o}");
        sb.AppendLine("cost | hash avg ms | verify avg ms (n=5 after warm-up)");
        foreach (var cost in new[] { 10, 11, 12, 13, 14 })
        {
            var h = new BCryptPasswordHasher(cost);
            var hash = h.Hash("warm-up");
            var sw = Stopwatch.StartNew();
            for (var i = 0; i < 5; i++) h.Hash("benchmark-password");
            var hashMs = sw.Elapsed.TotalMilliseconds / 5;
            sw.Restart();
            for (var i = 0; i < 5; i++) h.Verify("warm-up", hash);
            var verifyMs = sw.Elapsed.TotalMilliseconds / 5;
            sb.AppendLine($"{cost,4} | {hashMs,11:F1} | {verifyMs,11:F1}");
        }

        var dir = AppContext.BaseDirectory;
        while (dir != null && !Directory.Exists(Path.Combine(dir, "Marketplace.Tests"))) dir = Path.GetDirectoryName(dir);
        File.WriteAllText(Path.Combine(dir ?? ".", "tests", "bcrypt_benchmark.txt"), sb.ToString());
    }
}
