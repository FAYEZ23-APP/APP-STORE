using Marketplace.Application.DTOs.Privacy;

namespace Marketplace.Application.Interfaces;

public interface IPrivacyProcessingRegisterService
{
    Task<PrivacyProcessingRegisterResponse> GetRegisterAsync();
}
