using Marketplace.Application.Common;
using Xunit;

namespace Marketplace.Tests;

public class LogMaskingTests
{
    [Fact]
    public void MaskCode_AlwaysReturnsSixAsterisks()
    {
        Assert.Equal("******", LogMasking.MaskCode("123456"));
        Assert.Equal("******", LogMasking.MaskCode("987654"));
        Assert.Equal("******", LogMasking.MaskCode(null));
        Assert.Equal("******", LogMasking.MaskCode(""));
    }

    [Theory]
    [InlineData("+201012345678", "+20******5678")]
    [InlineData("01012345678", "******5678")]
    [InlineData("1234", "******")]
    [InlineData("+201234", "+20******1234")]
    [InlineData(null, "***")]
    [InlineData("", "***")]
    public void MaskPhone_MasksMiddleDigitsPreservingCountryCodeAndTail(string? input, string expected)
    {
        var result = LogMasking.MaskPhone(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("fayez@example.com", "fa***@example.com")]
    [InlineData("admin@marketplace.local", "ad***@marketplace.local")]
    [InlineData("a@b.com", "a***@b.com")]
    [InlineData(null, "***")]
    [InlineData("", "***")]
    [InlineData("invalid-email", "***")]
    public void MaskEmail_MasksLocalPartPreservingDomain(string? input, string expected)
    {
        var result = LogMasking.MaskEmail(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void MaskTarget_DistinguishesEmailAndPhoneCorrectly()
    {
        Assert.Equal("fa***@example.com", LogMasking.MaskTarget("fayez@example.com"));
        Assert.Equal("+20******5678", LogMasking.MaskTarget("+201012345678"));
        Assert.Equal("***", LogMasking.MaskTarget(null));
    }
}
