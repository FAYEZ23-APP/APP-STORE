using System.Security.Claims;
using Marketplace.Infrastructure.Auth;

namespace Marketplace.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>Reads the authenticated user's Id from the "sub" claim.</summary>
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(JwtService.ClaimNames.UserId)
            ?? throw new Marketplace.Application.Exceptions.UnauthorizedException("User id claim is missing.");
        return int.Parse(value);
    }

    /// <summary>Reads the authenticated user's role from the "role" claim.</summary>
    public static string? GetUserRole(this ClaimsPrincipal user)
    {
        return user.FindFirstValue(JwtService.ClaimNames.Role)
            ?? user.FindFirstValue(ClaimTypes.Role);
    }
}
