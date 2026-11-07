using Marketplace.Application.DTOs.Privacy;

namespace Marketplace.Application.Interfaces;

public interface IThirdPartyProcessorDeletionService
{
    Task<List<ProcessorDeletionResult>> PropagateDeletionAsync(
        int userId,
        string? email,
        string? phone,
        int privacyRequestId);

    Task<ProcessorDeletionResult> RetryProcessorDeletionAsync(int processorLogId);
}
