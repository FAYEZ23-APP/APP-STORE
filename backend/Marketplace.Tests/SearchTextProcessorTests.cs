using Marketplace.Application.Services.Search;
using Xunit;

namespace Marketplace.Tests;

public class SearchTextProcessorTests
{
    [Theory]
    [InlineData("كِتَابٌ جَمِيلٌ", "كتاب جميل")] // Diacritics (Fatha, Damma, Tanween) stripped
    [InlineData("بـــــســــم الله", "بسم الله")] // Tatweel/Kashida stripped
    [InlineData("أحمد إبراهيم آمنة ٱبن", "احمد ابراهيم امنه ابن")] // Alef variants normalized
    [InlineData("سيارة جميلة", "سياره جميله")] // Taa Marbuta normalized to Ha
    [InlineData("على ومصطفى", "علي ومصطفي")] // Alef Maksura normalized to Yaa
    [InlineData("سؤال ومسؤول", "سوال ومسوول")] // Hamza on Waw normalized to Waw
    [InlineData("شاطئ وبئر", "شاطي وبير")] // Hamza on Yaa normalized to Yaa
    [InlineData("سعر ٥٠٠ جنيه", "سعر 500 جنيه")] // Eastern Arabic digits to ASCII
    public void NormalizeArabic_NormalizesFormsCorrectly(string input, string expected)
    {
        var result = SearchTextProcessor.NormalizeArabic(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("iPhone 15 Pro Max", "iphone 15 pro max")]
    [InlineData("Hello, World! 100%", "hello world 100")]
    public void NormalizeEnglish_ConvertsToLowerAndStripsPunctuation(string input, string expected)
    {
        var result = SearchTextProcessor.NormalizeEnglish(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("iPhone", "ifone")] // ph -> f
    [InlineData("Apple", "aple")] // duplicate p collapsed
    [InlineData("Wireless", "wireles")] // duplicate s collapsed
    public void NormalizeEnglishPhonetic_AppliesPhoneticSimplification(string input, string expected)
    {
        var result = SearchTextProcessor.NormalizeEnglishPhonetic(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Tokenize_FiltersStopWords()
    {
        var text = "هذا هاتف ممتاز في القاهرة ومن مصر";
        var tokens = SearchTextProcessor.Tokenize(text, filterStopWords: true);

        Assert.DoesNotContain("هذا", tokens);
        Assert.DoesNotContain("في", tokens);
        Assert.DoesNotContain("من", tokens);
        Assert.Contains("هاتف", tokens);
        Assert.Contains("ممتاز", tokens);
        Assert.Contains("القاهره", tokens);
        Assert.Contains("مصر", tokens);
    }

    [Fact]
    public void ExpandQueryTokens_ExpandsBilingualSynonyms()
    {
        var expansions = SearchTextProcessor.ExpandQueryTokens("هاتف");
        Assert.NotEmpty(expansions);

        var firstExpansion = expansions[0];
        Assert.Contains("هاتف", firstExpansion);
        Assert.True(firstExpansion.Contains("موبايل") || firstExpansion.Contains("phone"));
    }

    [Fact]
    public void BuildSearchVector_CombinesWeightedFields()
    {
        var vector = SearchTextProcessor.BuildSearchVector(
            nameAr: "هاتف ابل ايفون 15",
            nameEn: "Apple iPhone 15 Phone",
            brandNameAr: "ابل",
            brandNameEn: "Apple",
            categoryNameAr: "إلكترونيات",
            categoryNameEn: "Electronics",
            keywords: "موبايل ذكي smart mobile",
            description: "جهاز ذكي ممتاز مع شاشة 6.1 بوصة");

        Assert.NotEmpty(vector);
        Assert.Contains("هاتف", vector);
        Assert.Contains("ايفون", vector);
        Assert.Contains("apple", vector);
    }
}
