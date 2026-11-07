using Marketplace.Infrastructure.Auth;
using Xunit;

namespace Marketplace.Tests;

public class PasswordHasherTests
{
    private const string Password = "Correct-Horse-Battery-9!";

    [Fact]
    public void Test01_NewHash_IsBcrypt_WithConfiguredWorkFactor_AndUniqueSalt()
    {
        var hasher = new BCryptPasswordHasher(12);
        var h1 = hasher.Hash(Password);
        var h2 = hasher.Hash(Password);

        Assert.StartsWith("$2", h1);
        Assert.Equal(60, h1.Length);
        Assert.Equal("12", h1.Substring(4, 2));
        Assert.NotEqual(h1, h2);               // automatic unique salts
        Assert.DoesNotContain(Password, h1);   // never plaintext
    }

    [Fact]
    public void Test02_Verify_AcceptsCorrectPassword()
    {
        var hasher = new BCryptPasswordHasher(10);
        Assert.True(hasher.Verify(Password, hasher.Hash(Password)));
    }

    [Fact]
    public void Test03_Verify_RejectsWrongPassword_AndNeverThrowsOnGarbage()
    {
        var hasher = new BCryptPasswordHasher(10);
        var hash = hasher.Hash(Password);

        Assert.False(hasher.Verify("wrong", hash));
        Assert.False(hasher.Verify(Password, ""));
        Assert.False(hasher.Verify(Password, "not-a-bcrypt-hash"));
        Assert.False(hasher.Verify(Password, "plaintext-password-stored"));
        Assert.False(hasher.Verify("", hash));
    }

    [Fact]
    public void Test04_ExistingHash_Compatibility_LowerCostHashStillVerifies()
    {
        // Simulates hashes produced by the previous implementation (library default work factor 11).
        var legacy = BCrypt.Net.BCrypt.HashPassword(Password, 11);
        var hasher = new BCryptPasswordHasher(12);

        Assert.True(hasher.Verify(Password, legacy));
        Assert.False(hasher.Verify("wrong", legacy));
    }

    [Fact]
    public void Test05_Rehash_DetectedForLowerCost_NotForCurrent_AndNeverForUnknownFormats()
    {
        var legacy = BCrypt.Net.BCrypt.HashPassword(Password, 10);
        var hasher = new BCryptPasswordHasher(12);

        Assert.True(hasher.NeedsRehash(legacy));

        var upgraded = hasher.Hash(Password);
        Assert.False(hasher.NeedsRehash(upgraded));
        Assert.True(hasher.Verify(Password, upgraded));   // still verifies after migration

        Assert.False(hasher.NeedsRehash(""));
        Assert.False(hasher.NeedsRehash("garbage"));
    }

    [Fact]
    public void Test06_WorkFactor_IsClampedToSafeRange()
    {
        Assert.Equal(BCryptPasswordHasher.MinWorkFactor, new BCryptPasswordHasher(4).WorkFactor);
        Assert.Equal(BCryptPasswordHasher.MaxWorkFactor, new BCryptPasswordHasher(40).WorkFactor);
    }
}
