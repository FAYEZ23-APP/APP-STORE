using Marketplace.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Marketplace.Tests;

public class TwoFactorSecretProtectorTests
{
    private class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "Marketplace.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static AesGcmSecretProtector CreateProtector(string? encryptionKey = null, string env = "Development")
    {
        var configBuilder = new ConfigurationBuilder();
        if (encryptionKey != null)
        {
            configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Security:TwoFactorEncryptionKey"] = encryptionKey
            });
        }
        var configuration = configBuilder.Build();
        var environment = new TestHostEnvironment { EnvironmentName = env };
        return new AesGcmSecretProtector(configuration, environment);
    }

    [Fact]
    public void Protect_EncryptsWithPrefixAndFormat()
    {
        var protector = CreateProtector("MySuperSecretTestKeyThatIs32BytesLong!");
        var plaintext = "JBSWY3DPEHPK3PXP";

        var encrypted = protector.Protect(plaintext);

        Assert.NotNull(encrypted);
        Assert.StartsWith("ENC:v1:", encrypted);
        var parts = encrypted["ENC:v1:".Length..].Split(':');
        Assert.Equal(3, parts.Length); // nonce, ciphertext, tag
    }

    [Fact]
    public void ProtectAndUnprotect_RoundTripRestoresPlaintext()
    {
        var protector = CreateProtector("CustomSecretKeyForRoundTripTesting12345");
        var original = "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ";

        var encrypted = protector.Protect(original);
        var decrypted = protector.Unprotect(encrypted);

        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void Protect_IsIdempotentWhenAlreadyEncrypted()
    {
        var protector = CreateProtector("MyTestKeyForIdempotencyVerification!");
        var original = "JBSWY3DPEHPK3PXP";

        var encryptedOnce = protector.Protect(original);
        var encryptedTwice = protector.Protect(encryptedOnce);

        Assert.Equal(encryptedOnce, encryptedTwice);
    }

    [Fact]
    public void Unprotect_LegacyPlaintext_ReturnsTransparently()
    {
        var protector = CreateProtector("MyTestKeyForLegacyPlaintextSupport!");
        var legacyPlaintext = "JBSWY3DPEHPK3PXP";

        var result = protector.Unprotect(legacyPlaintext);

        Assert.Equal(legacyPlaintext, result);
    }

    [Fact]
    public void Protect_NullOrEmpty_ReturnsEmptyString()
    {
        var protector = CreateProtector();

        Assert.Equal(string.Empty, protector.Protect(null!));
        Assert.Equal(string.Empty, protector.Protect(""));
        Assert.Equal(string.Empty, protector.Protect("   "));
    }

    [Fact]
    public void Unprotect_InvalidEncryptedFormat_ThrowsFormatException()
    {
        var protector = CreateProtector();
        var corruptPayload = "ENC:v1:corrupt_without_colon_parts";

        Assert.Throws<FormatException>(() => protector.Unprotect(corruptPayload));
    }
}
