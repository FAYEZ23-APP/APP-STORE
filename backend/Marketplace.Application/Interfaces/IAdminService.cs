using Marketplace.Application.DTOs.Admin;

namespace Marketplace.Application.Interfaces;

public interface IAdminService
{
    Task<IEnumerable<AdminUserResponse>> GetUsersAsync(string? role = null, bool? isActive = null);
    Task<AdminUserResponse> UpdateUserStatusAsync(int adminId, int targetUserId, UpdateUserStatusRequest request);
    Task<AdminStatsResponse> GetPlatformStatsAsync();
    Task<AdminAuditLogListResponse> GetAuditLogsAsync(int page = 1, int pageSize = 50, string? entityType = null, string? action = null);
    
    // COD Blacklist management (GAP-ADM-02 & GAP-ORD-05)
    Task<IEnumerable<CodBlacklistDto>> GetCodBlacklistAsync();
    Task<CodBlacklistDto> AddCodBlacklistEntryAsync(int adminId, AddCodBlacklistRequest request);
    Task DeleteCodBlacklistEntryAsync(int adminId, int id);
}
