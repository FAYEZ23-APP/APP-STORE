using Marketplace.Domain.Entities;

namespace Marketplace.Application.Interfaces;

public record JwtToken(string Token, DateTime ExpiresAt);

public interface IJwtService
{
    JwtToken GenerateToken(User user);
}
