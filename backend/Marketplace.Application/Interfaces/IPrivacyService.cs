using Marketplace.Application.DTOs.Privacy;
using Marketplace.Application.DTOs.Users;

namespace Marketplace.Application.Interfaces;

public interface IPrivacyService
{
    Task<PrivacyExportResponse> RequestDataExportAsync(int userId, string format = "json");
    Task<(byte[] Bytes, string ContentType, string FileName)> DownloadExportAsync(int userId, string exportToken);
    Task<PrivacySubjectRequestResponse> InitiateAccountDeletionAsync(int userId, DeleteAccountRequest request);
    Task<IEnumerable<PrivacySubjectRequestResponse>> GetMyPrivacyRequestsAsync(int userId);
    Task<IEnumerable<AdminPrivacyRequestResponse>> GetAdminPrivacyRequestsAsync(string? status = null, bool? overdueOnly = null);
    Task<AdminPrivacyRequestResponse> ReviewPrivacyRequestAsync(int requestId, int adminId, ReviewPrivacyRequestInput input);
}
