using Marketplace.Application.DTOs.Admin;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public class AdminService : IAdminService
{
    private readonly IUnitOfWork _uow;

    public AdminService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IEnumerable<AdminUserResponse>> GetUsersAsync(string? role = null, bool? isActive = null)
    {
        IQueryable<User> query = _uow.Users.Query();

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role.Trim(), true, out var parsedRole))
        {
            query = query.Where(u => u.Role == parsedRole);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        var users = await query.OrderByDescending(u => u.CreatedAt).ToListAsync();

        var sellerIds = users.Where(u => u.Role == UserRole.Seller).Select(u => u.Id).ToList();
        var sellerProfiles = (await _uow.SellerProfiles.FindAsync(sp => sellerIds.Contains(sp.UserId)))
            .ToDictionary(sp => sp.UserId);

        return users.Select(u =>
        {
            sellerProfiles.TryGetValue(u.Id, out var sp);
            return new AdminUserResponse
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email ?? string.Empty,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                DispatchCity = sp?.DispatchCity,
                ContactPhone = sp?.ContactPhone
            };
        });
    }

    public async Task<AdminUserResponse> UpdateUserStatusAsync(int adminId, int targetUserId, UpdateUserStatusRequest request)
    {
        if (adminId == targetUserId && !request.IsActive)
        {
            throw new BadRequestException("Admins cannot deactivate their own account.");
        }

        var user = await _uow.Users.GetByIdAsync(targetUserId);
        if (user == null || (user.Email != null && user.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase)))
        {
            throw new NotFoundException($"User with ID {targetUserId} not found.");
        }

        user.IsActive = request.IsActive;
        _uow.Users.Update(user);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = request.IsActive ? "ActivateUser" : "DeactivateUser",
            EntityType = "User",
            EntityId = targetUserId.ToString(),
            Details = $"User '{user.Name}' ({user.Email}) status changed to IsActive={request.IsActive}.",
            CreatedAt = DateTime.UtcNow
        });

        await _uow.SaveChangesAsync();

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == user.Id)).FirstOrDefault();

        return new AdminUserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email ?? string.Empty,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            DispatchCity = sellerProfile?.DispatchCity,
            ContactPhone = sellerProfile?.ContactPhone
        };
    }

    public async Task<AdminStatsResponse> GetPlatformStatsAsync()
    {
        var totalOrders = await _uow.Orders.Query().CountAsync();

        var totalVolume = await _uow.Orders.Query()
            .Where(o => o.Status != OrderStatus.Cancelled)
            .SumAsync(o => (decimal?)o.TotalAmount) ?? 0m;

        var totalActiveProducts = await _uow.Products.Query()
            .CountAsync(p => p.Stock > 0);

        var totalRefusedCod = await _uow.Shipments.Query()
            .CountAsync(s => s.ReturnReason == ReturnReason.RefusedByBuyer);

        var totalUsers = await _uow.Users.Query().CountAsync();
        var totalBuyers = await _uow.Users.Query().CountAsync(u => u.Role == UserRole.Buyer);
        var totalSellers = await _uow.Users.Query().CountAsync(u => u.Role == UserRole.Seller);

        return new AdminStatsResponse
        {
            TotalOrders = totalOrders,
            TotalVolume = totalVolume,
            TotalActiveProducts = totalActiveProducts,
            TotalRefusedCodOrders = totalRefusedCod,
            TotalUsers = totalUsers,
            TotalBuyers = totalBuyers,
            TotalSellers = totalSellers
        };
    }

    public async Task<AdminAuditLogListResponse> GetAuditLogsAsync(int page = 1, int pageSize = 50, string? entityType = null, string? action = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _uow.AdminAuditLogs.Query();

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            var et = entityType.Trim();
            query = query.Where(a => a.EntityType == et);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            var act = action.Trim();
            query = query.Where(a => a.Action == act);
        }

        var totalCount = await query.CountAsync();

        var logs = await query
            .Include(a => a.Admin)
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = logs.Select(a => new AdminAuditLogResponse
        {
            Id = a.Id,
            AdminId = a.AdminId,
            AdminName = a.Admin?.Name,
            AdminEmail = a.Admin?.Email,
            Action = a.Action,
            EntityType = a.EntityType,
            EntityId = a.EntityId,
            Details = a.Details,
            CreatedAt = a.CreatedAt
        }).ToList();

        return new AdminAuditLogListResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }
}
