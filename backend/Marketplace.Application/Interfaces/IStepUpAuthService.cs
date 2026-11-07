using Marketplace.Application.DTOs.Auth;

namespace Marketplace.Application.Interfaces;

public interface IStepUpAuthService
{
    Task<StepUpChallengeResponse> ChallengeAsync(int adminId, StepUpChallengeRequest request, string? clientIp, CancellationToken cancellationToken = default);
    Task<bool> ValidateAndConsumeGrantAsync(int adminId, string? stepUpToken, string requiredScope, string? targetEntity = null, CancellationToken cancellationToken = default);
}
