using Marketplace.Application.DTOs.Auth;

namespace Marketplace.Application.Interfaces;

public interface IGoogleTokenValidator
{
    Task<GoogleUserInfo> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default);
}
