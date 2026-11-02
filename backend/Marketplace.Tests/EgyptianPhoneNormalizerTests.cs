using Marketplace.Application.Common;
using Xunit;

namespace Marketplace.Tests;

public class EgyptianPhoneNormalizerTests
{
    [Theory]
    [InlineData("01012345678", "+201012345678")]
    [InlineData("01112345678", "+201112345678")]
    [InlineData("01212345678", "+201212345678")]
    [InlineData("01512345678", "+201512345678")]
    [InlineData("201012345678", "+201012345678")]
    [InlineData("00201012345678", "+201012345678")]
    [InlineData("+201012345678", "+201012345678")]
    [InlineData("1012345678", "+201012345678")]
    public void Normalize_StandardAsciiDigits_NormalizesToCanonicalE164(string input, string expected)
    {
        var result = EgyptianPhoneNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("٠١٠١٢٣٤٥٦٧٨", "+201012345678")]
    [InlineData("٠١١١٢٣٤٥٦٧٨", "+201112345678")]
    [InlineData("٠١٢١٢٣٤٥٦٧٨", "+201212345678")]
    [InlineData("٠١٥١٢٣٤٥٦٧٨", "+201512345678")]
    [InlineData("٢٠١٠١٢٣٤٥٦٧٨", "+201012345678")]
    public void Normalize_EasternArabicNumerals_ConvertsAndNormalizes(string input, string expected)
    {
        var result = EgyptianPhoneNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("۰۱۰۱۲۳۴۵۶۷۸", "+201012345678")]
    [InlineData("۰۱۱۱۲۳۴۵۶۷۸", "+201112345678")]
    [InlineData("۰۱۲۱۲۳۴۵۶۷۸", "+201212345678")]
    [InlineData("۰۱۵۱۲۳۴۵۶۷۸", "+201512345678")]
    public void Normalize_ExtendedArabicIndicNumerals_ConvertsAndNormalizes(string input, string expected)
    {
        var result = EgyptianPhoneNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("   ", "")]
    public void Normalize_NullOrWhitespace_ReturnsEmptyString(string? input, string expected)
    {
        var result = EgyptianPhoneNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("٠١٢٣٤٥٦٧٨٩", "0123456789")]
    [InlineData("۰۱۲۳۴۵۶۷۸۹", "0123456789")]
    [InlineData("abc-123-٠١٢", "abc-123-012")]
    public void ToAsciiDigits_ConvertsOnlyArabicDigits(string input, string expected)
    {
        var result = EgyptianPhoneNormalizer.ToAsciiDigits(input);
        Assert.Equal(expected, result);
    }
}
