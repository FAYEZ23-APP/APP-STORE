using Marketplace.Application.DTOs.Admin;

namespace Marketplace.Application.Interfaces;

public interface IAdminService
{
    Task<IEnumerable<AdminUserResponse>> GetUsersAsync(string? role = null, bool? isActive = null);
    Task<AdminUserResponse> UpdateUserStatusAsync(int adminId, int targetUserId, UpdateUserStatusRequest request);
    Task<AdminStatsResponse> GetPlatformStatsAsync();
}
