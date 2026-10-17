using System.Security.Claims;
using Marketplace.Infrastructure.Auth;

namespace Marketplace.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>Reads the authenticated user's Id from the "sub" claim.</summary>
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(JwtService.ClaimNames.UserId)
            ?? throw new UnauthorizedAccessException("User id claim is missing.");
        return int.Parse(value);
    }
}
