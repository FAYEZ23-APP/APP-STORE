using System.Security.Claims;
using System.Text;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Marketplace.Infrastructure.Auth;

public class JwtService : IJwtService
{
    /// <summary>Short claim names used in the token — easy for the mobile app to read after decoding.</summary>
    public static class ClaimNames
    {
        public const string UserId = JwtRegisteredClaimNames.Sub;
        public const string Email = JwtRegisteredClaimNames.Email;
        public const string Name = "name";
        public const string Role = "role";
    }

    private readonly JwtSettings _settings;

    public JwtService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
    }

    public JwtToken GenerateToken(User user)
    {
        var expiresAt = DateTime.UtcNow.AddDays(_settings.ExpiryDays);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _settings.Issuer,
            Audience = _settings.Audience,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimNames.UserId, user.Id.ToString()),
                new Claim(ClaimNames.Email, user.Email),
                new Claim(ClaimNames.Name, user.Name),
                new Claim(ClaimNames.Role, user.Role.ToString())
            })
        };

        var token = new JsonWebTokenHandler().CreateToken(descriptor);
        return new JwtToken(token, expiresAt);
    }
}
