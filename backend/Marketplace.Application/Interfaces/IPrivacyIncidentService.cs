using Marketplace.Application.DTOs.Privacy;

namespace Marketplace.Application.Interfaces;

public interface IPrivacyIncidentService
{
    Task<PrivacyIncidentResponse> CreateIncidentAsync(int adminId, CreatePrivacyIncidentRequest request);
    Task<IEnumerable<PrivacyIncidentResponse>> GetIncidentsAsync(string? status = null);
    Task<PrivacyIncidentResponse> GetIncidentByIdAsync(int incidentId);
    Task<PrivacyIncidentCenterReport> GenerateCenterReportAsync(int incidentId);
    Task<PrivacyIncidentResponse> UpdateIncidentAsync(int incidentId, int adminId, UpdatePrivacyIncidentRequest request);
}
