using Marketplace.Application.Common;
using Xunit;

namespace Marketplace.Tests;

public class LogMaskingTests
{
    [Fact]
    public void MaskCode_And_MaskOtp_AlwaysReturnsRedacted()
    {
        Assert.Equal("[REDACTED]", LogMasking.MaskCode("123456"));
        Assert.Equal("[REDACTED]", LogMasking.MaskCode("987654"));
        Assert.Equal("[REDACTED]", LogMasking.MaskCode(null));
        Assert.Equal("[REDACTED]", LogMasking.MaskOtp("654321"));
    }

    [Theory]
    [InlineData("+201012341234", "+2010****1234")]
    [InlineData("01012341234", "010****1234")]
    [InlineData("01198764321", "011****4321")]
    [InlineData("01234567890", "012****7890")]
    [InlineData("01555551234", "015****1234")]
    [InlineData("1234", "[REDACTED]")]
    [InlineData(null, "***")]
    [InlineData("", "***")]
    public void MaskPhone_MasksMiddleDigitsPreservingPrefixAndTail(string? input, string expected)
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
        Assert.Equal("+2010****1234", LogMasking.MaskTarget("+201012341234"));
        Assert.Equal("***", LogMasking.MaskTarget(null));
    }

    [Fact]
    public void MaskSecrets_Tokens_Passwords_And_Address_ReturnRedacted()
    {
        Assert.Equal("[REDACTED]", LogMasking.MaskSecret("MySecret123!"));
        Assert.Equal("[REDACTED]", LogMasking.MaskPassword("SuperSecurePass"));
        Assert.Equal("[REDACTED]", LogMasking.MaskToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."));
        Assert.Equal("[REDACTED]", LogMasking.MaskAddress("Apt 4B, Building 12, Nasr City"));
    }

    [Fact]
    public void MaskAuthorizationHeader_RedactsBearerTokenSafely()
    {
        var header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.K9";
        var masked = LogMasking.MaskAuthorizationHeader(header);
        Assert.Equal("Bearer [REDACTED]", masked);

        Assert.Equal("[REDACTED]", LogMasking.MaskAuthorizationHeader(null));
        Assert.Equal("[REDACTED]", LogMasking.MaskAuthorizationHeader(""));
    }

    [Fact]
    public void MaskCookie_RedactsCookieValuesSafely()
    {
        var cookie = "refreshToken=abc123xyz; sessionId=session456; XSRF-TOKEN=token789";
        var masked = LogMasking.MaskCookie(cookie);

        Assert.Contains("refreshToken=[REDACTED]", masked);
        Assert.Contains("sessionId=[REDACTED]", masked);
        Assert.Contains("XSRF-TOKEN=[REDACTED]", masked);
        Assert.DoesNotContain("abc123xyz", masked);
        Assert.DoesNotContain("session456", masked);
    }

    [Fact]
    public void SanitizeJson_RecursivelyMasksSensitiveKeysWithoutBreakingStructure()
    {
        var json = """
        {
            "orderId": 101,
            "recipientPhone": "01012341234",
            "email": "user@domain.com",
            "password": "SecretPassword123",
            "buildingNumber": "15",
            "apartment": "4B",
            "items": [
                { "productId": 1, "productName": "T-Shirt" }
            ]
        }
        """;

        var sanitized = LogMasking.SanitizeJson(json);

        Assert.Contains("\"recipientPhone\":\"010****1234\"", sanitized);
        Assert.Contains("\"email\":\"us***@domain.com\"", sanitized);
        Assert.Contains("\"password\":\"[REDACTED]\"", sanitized);
        Assert.Contains("\"buildingNumber\":\"[REDACTED]\"", sanitized);
        Assert.Contains("\"apartment\":\"[REDACTED]\"", sanitized);
        Assert.Contains("\"orderId\":101", sanitized);
        Assert.Contains("T-Shirt", sanitized);
        Assert.DoesNotContain("SecretPassword123", sanitized);
    }

    [Fact]
    public void SanitizeExceptionMessage_RedactsConnectionStringPasswordsAndTokens()
    {
        var message = "Database connection failed for User ID=admin;Password=MySecretPassword123;Server=localhost with Bearer eyJhbGciOiJIUzI1NiIn.";
        var sanitized = LogMasking.SanitizeExceptionMessage(message);

        Assert.Contains("Password=[REDACTED]", sanitized);
        Assert.Contains("Bearer [REDACTED]", sanitized);
        Assert.DoesNotContain("MySecretPassword123", sanitized);
        Assert.DoesNotContain("eyJhbGci", sanitized);
    }

    [Fact]
    public void SanitizeStructuredProperties_EnforcesAllowlistAndMasking()
    {
        var properties = new Dictionary<string, object?>
        {
            { "OrderId", 42 },
            { "Status", "Created" },
            { "Phone", "01012341234" },
            { "Password", "CleartextPassword" },
            { "BuildingNumber", "12" },
            { "UnknownSecret", "some-value" }
        };

        var sanitized = LogMasking.SanitizeStructuredProperties(properties);

        Assert.Equal(42, sanitized["OrderId"]);
        Assert.Equal("Created", sanitized["Status"]);
        Assert.Equal("010****1234", sanitized["Phone"]);
        Assert.Equal("[REDACTED]", sanitized["Password"]);
        Assert.Equal("[REDACTED]", sanitized["BuildingNumber"]);
    }
}
