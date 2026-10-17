using Marketplace.Application.DTOs.Users;

namespace Marketplace.Application.Interfaces;

public interface IUserService
{
    Task<UserProfileResponse> GetProfileAsync(int userId);
    Task<UserProfileResponse> UpdateProfileAsync(int userId, UpdateProfileRequest request);
    Task<SellerProfileDto> GetSellerProfileAsync(int userId);
    Task<SellerProfileDto> UpdateSellerProfileAsync(int userId, SellerProfileDto request);
    Task ChangePasswordAsync(int userId, ChangePasswordRequest request);

    Task<IEnumerable<UserAddressResponse>> GetAddressesAsync(int userId);
    Task<UserAddressResponse> GetAddressByIdAsync(int userId, int addressId);
    Task<UserAddressResponse> CreateAddressAsync(int userId, CreateUserAddressRequest request);
    Task<UserAddressResponse> UpdateAddressAsync(int userId, int addressId, UpdateUserAddressRequest request);
    Task DeleteAddressAsync(int userId, int addressId);

    // PDPL 151/2020 Compliance
    Task<UserDataExportDto> ExportUserDataAsync(int userId);
    Task DeleteAccountAsync(int userId, string? currentPassword = null, string? googleIdToken = null);
    Task<BuyerStatsResponse> GetBuyerStatsAsync(int userId);

    // Dashboard Hub Aggregations
    Task<Marketplace.Application.DTOs.Dashboard.SellerDashboardResponse> GetSellerDashboardAsync(int sellerId);
    Task<Marketplace.Application.DTOs.Dashboard.BuyerDashboardResponse> GetBuyerDashboardAsync(int buyerId);
}
