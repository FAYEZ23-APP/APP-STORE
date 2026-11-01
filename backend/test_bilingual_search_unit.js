/**
 * Bilingual Search Phase 1 Unit Verification Runner
 * Tests SearchTextProcessor, FuzzyMatcher, and SearchVector builder in pure C# .NET 10.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(process.env.TEMP || __dirname, 'BilingualSearchUnitRunner');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <ProjectReference Include="D:\\Backend\\marketplace\\backend\\Marketplace.Domain\\Marketplace.Domain.csproj" />
    <ProjectReference Include="D:\\Backend\\marketplace\\backend\\Marketplace.Application\\Marketplace.Application.csproj" />
    <ProjectReference Include="D:\\Backend\\marketplace\\backend\\Marketplace.Infrastructure\\Marketplace.Infrastructure.csproj" />
  </ItemGroup>
</Project>`;

const programCs = `using System;
using System.Linq;
using System.Collections.Generic;
using Marketplace.Application.Services.Search;

public class Program
{
    private static int _passed = 0;
    private static int _failed = 0;

    private static void Assert(bool condition, string testName, string? details = null)
    {
        if (condition)
        {
            _passed++;
            Console.WriteLine($"[PASS] {testName}");
        }
        else
        {
            _failed++;
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[FAIL] {testName} - {details}");
            Console.ResetColor();
        }
    }

    public static int Main()
    {
        Console.WriteLine("==========================================================");
        Console.WriteLine(" BILINGUAL SMART & FUZZY SEARCH - UNIT VERIFICATION RUNNER");
        Console.WriteLine("==========================================================\\n");

        // 1. ARABIC NORMALIZATION TESTS
        Console.WriteLine("--- 1. Arabic Text Normalization ---");
        var ar1 = SearchTextProcessor.NormalizeArabic("أحمد وإبراهيم في القاهرة وآسيا ٱلأهرام");
        Assert(ar1 == "احمد وابراهيم في القاهره واسيا الاهرام", "Alef variants (أ, إ, آ, ٱ -> ا) and Taa Marbuta (ة -> ه) unified", $"Got: '{ar1}'");

        var ar2 = SearchTextProcessor.NormalizeArabic("سَمَّاعَاتٌ ذَكِيَّةٌ، شَاحِنٌ سَرِيعٌـ!");
        Assert(ar2 == "سماعات ذكيه شاحن سريع", "Tashkeel diacritics and Tatweel stripped", $"Got: '{ar2}'");

        var ar3 = SearchTextProcessor.NormalizeArabic("مستشفى على شاطئ لؤلؤ");
        Assert(ar3 == "مستشفي علي شاطي لولو", "Alef Maksura (ى -> ي) and Hamzas (ؤ -> و, ئ -> ي) unified", $"Got: '{ar3}'");

        var ar4 = SearchTextProcessor.NormalizeArabic("تلفون ٠١٠١٢٣٤٥٦٧٨");
        Assert(ar4 == "تلفون 01012345678", "Arabic-Indic digits normalized to ASCII", $"Got: '{ar4}'");

        // 2. ENGLISH & PHONETIC NORMALIZATION TESTS
        Console.WriteLine("\\n--- 2. English & Phonetic Normalization ---");
        var en1 = SearchTextProcessor.NormalizeEnglish("  APPLE iPhone 16 Pro-Max / 256GB!  ");
        Assert(en1 == "apple iphone 16 pro max 256gb", "English lowercase, punctuation trimmed to whitespace", $"Got: '{en1}'");

        var enPhonetic1 = SearchTextProcessor.NormalizeEnglishPhonetic("iPhone");
        Assert(enPhonetic1 == "ifone", "Phonetic ph -> f normalization", $"Got: '{enPhonetic1}'");

        var enPhonetic2 = SearchTextProcessor.NormalizeEnglishPhonetic("Apple Samsung");
        Assert(enPhonetic2 == "aple samsung", "Double consonants collapsed (pp -> p)", $"Got: '{enPhonetic2}'");

        // 3. UNIFIED NORMALIZATION (MIXED ARABIC + ENGLISH)
        Console.WriteLine("\\n--- 3. Unified Mixed Arabic + English Normalization ---");
        var mixed = SearchTextProcessor.Normalize("شاحن أنكر   Type-C بقوة 65W مع كابل؛");
        Assert(mixed == "شاحن انكر type c بقوه 65w مع كابل", "Mixed Arabic + English normalized properly", $"Got: '{mixed}'");

        // 4. CROSS-LANGUAGE & SYNONYM EXPANSION TESTS
        Console.WriteLine("\\n--- 4. Cross-Language & Synonym Expansion ---");
        var iphoneSyns = SearchTextProcessor.GetSynonyms("ايفون");
        Assert(iphoneSyns.Contains("iphone", StringComparer.OrdinalIgnoreCase), "Arabic 'ايفون' expands to English 'iphone'", $"Synonyms: {string.Join(", ", iphoneSyns)}");

        var samsungSyns = SearchTextProcessor.GetSynonyms("samsung");
        Assert(samsungSyns.Contains("سامسونج", StringComparer.OrdinalIgnoreCase), "English 'samsung' expands to Arabic 'سامسونج'", $"Synonyms: {string.Join(", ", samsungSyns)}");

        var laptopSyns = SearchTextProcessor.GetSynonyms("لابتوب");
        Assert(laptopSyns.Contains("laptop", StringComparer.OrdinalIgnoreCase), "Arabic 'لابتوب' expands to English 'laptop'", $"Synonyms: {string.Join(", ", laptopSyns)}");

        var tshirtSyns = SearchTextProcessor.GetSynonyms("tshirt");
        Assert(tshirtSyns.Contains("تيشيرت", StringComparer.OrdinalIgnoreCase), "English 'tshirt' expands to Arabic 'تيشيرت'", $"Synonyms: {string.Join(", ", tshirtSyns)}");

        var expandedQuery = SearchTextProcessor.ExpandQueryTokens("شاحن انكر type c");
        Assert(expandedQuery.Count == 4, "Query tokenized into 4 groups", $"Count: {expandedQuery.Count}");
        Assert(expandedQuery[0].Contains("charger", StringComparer.OrdinalIgnoreCase), "'شاحن' expanded to 'charger'", $"Group 0: {string.Join(", ", expandedQuery[0])}");
        Assert(expandedQuery[1].Contains("anker", StringComparer.OrdinalIgnoreCase), "'انكر' expanded to 'anker'", $"Group 1: {string.Join(", ", expandedQuery[1])}");

        // 5. PRE-COMPUTED SEARCHVECTOR BUILDER TESTS
        Console.WriteLine("\\n--- 5. Pre-computed SearchVector Builder ---");
        var searchVector = SearchTextProcessor.BuildSearchVector(
            nameAr: "شاحن سريع أنكر 65 واط",
            nameEn: "Anker 65W Fast Charger Type-C",
            brandNameAr: "أنكر",
            brandNameEn: "Anker",
            categoryNameAr: "إلكترونيات",
            categoryNameEn: "Electronics",
            keywords: "شواحن, تايب سي, adapter, power",
            description: "شاحن جداري فائق السرعة بتقنية GaN متوافق مع جميع الهواتف");

        Assert(!string.IsNullOrWhiteSpace(searchVector), "SearchVector is not empty");
        Assert(searchVector.Contains("شاحن"), "SearchVector contains normalized Arabic name token 'شاحن'");
        Assert(searchVector.Contains("charger"), "SearchVector contains synonym-expanded 'charger'");
        Assert(searchVector.Contains("انكر"), "SearchVector contains normalized brand 'انكر'");
        Assert(searchVector.Contains("anker"), "SearchVector contains English brand 'anker'");
        Assert(searchVector.Contains("electronics"), "SearchVector contains category 'electronics'");

        // 6. FUZZY MATCHING & TYPO TOLERANCE TESTS
        Console.WriteLine("\\n--- 6. Fuzzy Matching & Typo Tolerance ---");
        // Arabic typo test: "سامسنج" vs "سامسونج"
        var arTypoMatch = FuzzyMatcher.IsFuzzyMatch("سامسنج", "سامسونج", maxDistance: 2, minSimilarity: 0.75);
        var arDist = FuzzyMatcher.ComputeDamerauLevenshteinDistance("سامسنج", "سامسونج");
        var arSim = FuzzyMatcher.ComputeSimilarity("سامسنج", "سامسونج");
        Assert(arTypoMatch, $"Arabic typo 'سامسنج' matches 'سامسونج' (distance: {arDist}, similarity: {arSim:P0})");

        // English typo test: "ipone" vs "iphone"
        var enTypoMatch = FuzzyMatcher.IsFuzzyMatch("ipone", "iphone", maxDistance: 2, minSimilarity: 0.75);
        var enDist = FuzzyMatcher.ComputeDamerauLevenshteinDistance("ipone", "iphone");
        var enSim = FuzzyMatcher.ComputeSimilarity("ipone", "iphone");
        Assert(enTypoMatch, $"English typo 'ipone' matches 'iphone' (distance: {enDist}, similarity: {enSim:P0})");

        // Phonetic typo test: "ifone" vs "iphone"
        var phoneticMatch = FuzzyMatcher.IsFuzzyMatch("ifone", "iphone");
        Assert(phoneticMatch, "Phonetic typo 'ifone' matches 'iphone'");

        // Damerau adjacent transposition test: "teh" vs "the" / "ايفنو" vs "ايفون"
        var transposeDist = FuzzyMatcher.ComputeDamerauLevenshteinDistance("ايفنو", "ايفون");
        Assert(transposeDist == 1, $"Damerau transposition cost is 1 for 'ايفنو' <-> 'ايفون' (got {transposeDist})");

        // DidYouMean Candidate Finder
        var dictionary = new[] { "سامسونج", "ايفون", "شاومي", "انكر", "لابتوب", "سماعات" };
        var closest = FuzzyMatcher.FindClosestCandidate("سامسنج", dictionary);
        Assert(closest == "سامسونج", $"DidYouMean correctly corrected 'سامسنج' -> '{closest}'");

        var closestEn = FuzzyMatcher.FindClosestCandidate("ipone", new[] { "samsung", "iphone", "xiaomi", "anker", "laptop" });
        Assert(closestEn == "iphone", $"DidYouMean correctly corrected 'ipone' -> '{closestEn}'");

        Console.WriteLine("\\n==========================================================");
        Console.WriteLine($" RESULTS: {_passed} Passed, {_failed} Failed");
        Console.WriteLine("==========================================================");

        return _failed == 0 ? 0 : 1;
    }
}
`;

fs.writeFileSync(path.join(tempDir, 'BilingualSearchUnitRunner.csproj'), csproj, 'utf8');
fs.writeFileSync(path.join(tempDir, 'Program.cs'), programCs, 'utf8');

console.log('Building and running Bilingual Search Unit Tests...');
const run = spawnSync('dotnet', ['run', '--project', tempDir], {
  encoding: 'utf8',
  stdio: 'inherit'
});

process.exit(run.status || 0);
