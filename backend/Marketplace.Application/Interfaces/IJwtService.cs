using Marketplace.Domain.Entities;

namespace Marketplace.Application.Interfaces;

public record JwtToken(string Token, DateTime ExpiresAt);

public interface IJwtService
{
    JwtToken GenerateToken(User user);
    string GenerateTwoFactorToken(User user, int expiryMinutes = 5);
    (int UserId, string Role)? ValidateTwoFactorToken(string token);
}
