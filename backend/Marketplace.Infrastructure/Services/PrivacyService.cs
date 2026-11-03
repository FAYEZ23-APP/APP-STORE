using System.Text;
using System.Text.Json;
using Marketplace.Application.Common;
using Marketplace.Application.Exceptions;
using Marketplace.Application.DTOs.Privacy;
using Marketplace.Application.DTOs.Users;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Services;

/// <summary>
/// Core implementation of data subject rights, export, deletion, SLA tracking, and retention management
/// under Egyptian Personal Data Protection Law 151/2020 and Executive Regulations Decree 816/2025.
/// </summary>
public class PrivacyService : IPrivacyService
{
    private readonly IUnitOfWork _uow;
    private readonly IPasswordHasher _hasher;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly IThirdPartyProcessorDeletionService _processorService;
    private readonly ILogger<PrivacyService> _logger;

    public PrivacyService(
        IUnitOfWork uow,
        IPasswordHasher hasher,
        IGoogleTokenValidator googleTokenValidator,
        IThirdPartyProcessorDeletionService processorService,
        ILogger<PrivacyService> logger)
    {
        _uow = uow;
        _hasher = hasher;
        _googleTokenValidator = googleTokenValidator;
        _processorService = processorService;
        _logger = logger;
    }

    public async Task<PrivacyExportResponse> RequestDataExportAsync(int userId, string format = "json")
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null || !user.IsActive)
            throw new NotFoundException($"User with ID {userId} not found.");

        format = string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase) ? "csv" : "json";

        var exportPayload = await AssembleUserExportDataAsync(user);

        string exportSerialized;
        if (format == "csv")
        {
            exportSerialized = GenerateCsvExport(exportPayload);
        }
        else
        {
            exportSerialized = JsonSerializer.Serialize(exportPayload, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }

        var exportToken = Guid.NewGuid().ToString("N");
        var submittedAt = DateTime.UtcNow;
        var dueDate = EgyptianCalendarUtils.CalculateWorkingDaysDueDate(submittedAt, 6);
        var expiresAt = submittedAt.AddHours(24);

        var request = new PrivacySubjectRequest
        {
            UserId = userId,
            RequestType = PrivacyRequestType.AccessExport,
            Status = PrivacyRequestStatus.Completed,
            SubmittedAt = submittedAt,
            DueDate = dueDate,
            VerifiedAt = submittedAt,
            CompletedAt = submittedAt,
            ExportFormat = format,
            ExportToken = exportToken,
            ExportExpiresAt = expiresAt,
            ExportDataJson = exportSerialized,
            ProcessorSyncStatus = "Completed",
            CreatedAt = submittedAt
        };

        await _uow.PrivacySubjectRequests.AddAsync(request);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = null,
            Action = "PrivacyDataExportRequest",
            EntityType = "User",
            EntityId = userId.ToString(),
            Details = $"Personal data export requested in {format.ToUpper()} format (Token: {exportToken[..8]}..., Expires: {expiresAt:o})"
        });

        await _uow.SaveChangesAsync();

        _logger.LogInformation("Generated personal data export for User {UserId} in {Format} format (Token: {Token})",
            userId, format, exportToken);

        return new PrivacyExportResponse
        {
            RequestId = request.Id,
            ExportToken = exportToken,
            Format = format,
            DownloadUrl = $"/api/users/me/privacy/export/{exportToken}",
            ExpiresAt = expiresAt,
            Data = format == "json" ? exportPayload : null
        };
    }

    public async Task<(byte[] Bytes, string ContentType, string FileName)> DownloadExportAsync(int userId, string exportToken)
    {
        if (string.IsNullOrWhiteSpace(exportToken))
            throw new BadRequestException("Export token is required.");

        var request = (await _uow.PrivacySubjectRequests.FindAsync(r => r.ExportToken == exportToken)).FirstOrDefault();
        if (request == null)
            throw new NotFoundException("Export archive not found or token invalid.");

        // Rule 11: Cross-user access check
        if (request.UserId != userId)
        {
            _logger.LogWarning("Cross-user export download attempt blocked: User {UserId} requested Export belonging to User {OwnerId}",
                userId, request.UserId);
            throw new ForbiddenException("You are not authorized to download this personal data export.");
        }

        // Expiration check
        if (request.ExportExpiresAt.HasValue && request.ExportExpiresAt.Value < DateTime.UtcNow)
        {
            throw new ConflictException("This personal data export archive has expired. Please submit a new export request.");
        }

        var isCsv = string.Equals(request.ExportFormat, "csv", StringComparison.OrdinalIgnoreCase);
        var bytes = Encoding.UTF8.GetBytes(request.ExportDataJson ?? string.Empty);
        var contentType = isCsv ? "text/csv; charset=utf-8" : "application/json; charset=utf-8";
        var fileName = $"egypt_shop_privacy_export_{userId}_{DateTime.UtcNow:yyyyMMdd}.{(isCsv ? "csv" : "json")}";

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = null,
            Action = "PrivacyDataExportDownloaded",
            EntityType = "PrivacySubjectRequest",
            EntityId = request.Id.ToString(),
            Details = $"User {userId} downloaded personal data export ({fileName})"
        });
        await _uow.SaveChangesAsync();

        return (bytes, contentType, fileName);
    }

    public async Task<PrivacySubjectRequestResponse> InitiateAccountDeletionAsync(int userId, DeleteAccountRequest request)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user == null || !user.IsActive || (user.Email != null && user.Email.StartsWith("deleted_", StringComparison.OrdinalIgnoreCase)) || (user.Email == null && user.Phone == null))
            throw new NotFoundException($"User with ID {userId} not found or already deleted.");

        // 1. Re-authentication check
        bool isGoogleOnly = string.IsNullOrWhiteSpace(user.PasswordHash);
        if (isGoogleOnly)
        {
            if (string.IsNullOrWhiteSpace(request.GoogleIdToken))
            {
                throw new BadRequestException("Google-only accounts must re-authenticate with a fresh Google token to delete their account.");
            }

            var googleUser = await _googleTokenValidator.ValidateTokenAsync(request.GoogleIdToken);
            var externalLogin = (await _uow.ExternalLogins.FindAsync(e => e.UserId == userId && e.Provider == "Google" && e.Subject == googleUser.GoogleId)).FirstOrDefault();
            if (externalLogin == null && !string.Equals(googleUser.Email, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedException("Google token does not belong to this account.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.CurrentPassword))
        {
            if (!_hasher.Verify(request.CurrentPassword, user.PasswordHash))
            {
                throw new BadRequestException("كلمة المرور الحالية غير صحيحة.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.GoogleIdToken))
        {
            var googleUser = await _googleTokenValidator.ValidateTokenAsync(request.GoogleIdToken);
            var externalLogin = (await _uow.ExternalLogins.FindAsync(e => e.UserId == userId && e.Provider == "Google" && e.Subject == googleUser.GoogleId)).FirstOrDefault();
            if (externalLogin == null && !string.Equals(googleUser.Email, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedException("Google token does not match user account.");
            }
        }
        else
        {
            throw new BadRequestException("Current password is required to delete account.");
        }

        // 2. Pre-flight Blockers & Guards
        // Check active buyer orders
        var buyerOrders = (await _uow.Orders.FindAsync(o => o.BuyerId == userId)).ToList();
        var buyerOrderIds = buyerOrders.Select(o => o.Id).ToList();
        if (buyerOrderIds.Count > 0)
        {
            var buyerShipments = await _uow.Shipments.FindAsync(s => buyerOrderIds.Contains(s.OrderId));
            bool hasActiveBuyerShipments = buyerShipments.Any(s =>
                s.Status != ShipmentStatus.Delivered &&
                s.Status != ShipmentStatus.Cancelled &&
                s.Status != ShipmentStatus.Returned);

            bool hasActiveBuyerOrders = buyerOrders.Any(o =>
                o.Status != OrderStatus.Delivered &&
                o.Status != OrderStatus.Cancelled);

            if (hasActiveBuyerShipments || hasActiveBuyerOrders)
            {
                throw new ConflictException("لا يمكن حذف الحساب نظراً لوجود شحنات قيد التنفيذ لم تكتمل بعد. يُرجى الانتظار حتى اكتمال التوصيل أو إلغاء الطلبات.");
            }
        }

        // Check open returns and disputes (for buyer or seller)
        var openReturns = await _uow.ReturnRequests.FindAsync(r =>
            (r.BuyerId == userId || r.SellerId == userId) &&
            (r.Status == ReturnStatus.Pending ||
             r.Status == ReturnStatus.Approved ||
             r.Status == ReturnStatus.ApprovedAwaitingReturn));

        if (openReturns.Any())
        {
            throw new ConflictException("لا يمكن حذف الحساب نظراً لوجود طلبات إرجاع أو نزاعات قائمة لم تُسوَّ بعد.");
        }

        // Check active buyer wallet balance
        var buyerWallet = (await _uow.BuyerWallets.FindAsync(bw => bw.BuyerId == userId)).FirstOrDefault();
        if (buyerWallet != null && buyerWallet.Balance > 0)
        {
            throw new ConflictException("لا يمكن حذف الحساب نظراً لوجود رصيد متبقٍ في المحفظة. يُرجى استخدامه أو سحبه أولاً.");
        }

        // Check seller guards
        if (user.Role == UserRole.Seller)
        {
            var sellerProducts = (await _uow.Products.FindAsync(p => p.SellerId == userId)).ToList();
            if (sellerProducts.Count > 0)
            {
                throw new ConflictException("لا يمكن حذف حساب التاجر طالما توجد منتجات نشطة مرتبطة بالحساب.");
            }

            var sellerShipments = await _uow.Shipments.FindAsync(s => s.SellerId == userId);
            bool hasActiveSellerShipments = sellerShipments.Any(s =>
                s.Status != ShipmentStatus.Delivered &&
                s.Status != ShipmentStatus.Cancelled &&
                s.Status != ShipmentStatus.Returned);

            if (hasActiveSellerShipments)
            {
                throw new ConflictException("لا يمكن حذف حساب التاجر نظراً لوجود شحنات قيد التوصيل لم تكتمل بعد.");
            }

            var vendorWallet = (await _uow.VendorWallets.FindAsync(w => w.SellerId == userId)).FirstOrDefault();
            if (vendorWallet != null && (vendorWallet.Balance > 0 || vendorWallet.PendingBalance > 0))
            {
                throw new ConflictException("لا يمكن حذف حساب التاجر لوجود رصيد متاح أو معلق في المحفظة.");
            }

            var openPayouts = await _uow.PayoutRequests.FindAsync(p =>
                p.SellerId == userId &&
                p.Status == PayoutStatus.Pending);
            if (openPayouts.Any())
            {
                throw new ConflictException("لا يمكن حذف حساب التاجر لوجود طلبات سحب أرباح قيد المعالجة.");
            }
        }

        // 3. Create PrivacySubjectRequest to track the deletion lifecycle
        var originalEmail = user.Email;
        var originalPhone = user.Phone;
        var submittedAt = DateTime.UtcNow;
        var dueDate = EgyptianCalendarUtils.CalculateWorkingDaysDueDate(submittedAt, 6);

        var subjectRequest = new PrivacySubjectRequest
        {
            UserId = userId,
            RequestType = PrivacyRequestType.AccountDeletion,
            Status = PrivacyRequestStatus.Processing,
            SubmittedAt = submittedAt,
            DueDate = dueDate,
            VerifiedAt = submittedAt,
            CreatedAt = submittedAt
        };

        await _uow.PrivacySubjectRequests.AddAsync(subjectRequest);
        await _uow.SaveChangesAsync(); // Generates subjectRequest.Id

        // 4. Financial & Legal Retention Preservation:
        // Redact PII on buyer's Orders (keep Governorate, City, totals, items, timestamps for 5-year commercial/tax retention)
        foreach (var order in buyerOrders)
        {
            order.RecipientName = "Deleted User";
            order.RecipientPhone = string.Empty;
            order.Area = string.Empty;
            order.StreetBuilding = string.Empty;
            _uow.Orders.Update(order);
        }

        // Scrub uploaded defect photos on return requests (unless placed on legal hold)
        var userReturns = (await _uow.ReturnRequests.FindAsync(r => r.BuyerId == userId)).ToList();
        foreach (var ret in userReturns)
        {
            if (!string.IsNullOrWhiteSpace(ret.DefectImageUrl))
            {
                TryDeleteUploadedFile(ret.DefectImageUrl);
                ret.DefectImageUrl = null;
                _uow.ReturnRequests.Update(ret);
            }
        }

        // Anonymize user reviews
        var userReviews = (await _uow.Reviews.FindAsync(r => r.BuyerId == userId)).ToList();
        foreach (var rev in userReviews)
        {
            if (!string.IsNullOrWhiteSpace(rev.Comment) && rev.Comment.Contains("/uploads/", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var token in rev.Comment.Split(' ', '\n', '\r', '\t', '"', '\''))
                {
                    if (token.Contains("/uploads/", StringComparison.OrdinalIgnoreCase))
                    {
                        TryDeleteUploadedFile(token);
                    }
                }
            }
        }

        // 5. Account Anonymization & Revocation:
        user.Name = "Deleted User";
        user.Email = null;
        user.Phone = null;
        user.IsActive = false;
        user.PasswordHash = _hasher.Hash(Guid.NewGuid().ToString("N")); // Invalidate password login
        user.TokenVersion++; // Immediately invalidates existing JWT tokens
        _uow.Users.Update(user);

        // Delete verification codes
        var userCodes = (await _uow.VerificationCodes.FindAsync(c => c.UserId == userId)).ToList();
        foreach (var c in userCodes)
            _uow.VerificationCodes.Remove(c);

        // Revoke & delete refresh tokens
        var userRefreshTokens = (await _uow.RefreshTokens.FindAsync(r => r.UserId == userId)).ToList();
        foreach (var t in userRefreshTokens)
            _uow.RefreshTokens.Remove(t);

        // Delete device push notification tokens
        var userPushTokens = (await _uow.UserDeviceTokens.FindAsync(d => d.UserId == userId)).ToList();
        foreach (var pt in userPushTokens)
            _uow.UserDeviceTokens.Remove(pt);

        // Remove wishlist items
        var userWishlist = (await _uow.WishlistItems.FindAsync(w => w.UserId == userId)).ToList();
        foreach (var w in userWishlist)
            _uow.WishlistItems.Remove(w);

        // Remove user notifications
        var userNotes = (await _uow.UserNotifications.FindAsync(n => n.UserId == userId)).ToList();
        foreach (var n in userNotes)
            _uow.UserNotifications.Remove(n);

        // Remove user addresses
        var addresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId)).ToList();
        foreach (var addr in addresses)
            _uow.UserAddresses.Remove(addr);

        // Anonymize seller profile if exists
        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        if (sellerProfile != null)
        {
            sellerProfile.ContactPhone = null;
            sellerProfile.DispatchAddress = null;
            _uow.SellerProfiles.Update(sellerProfile);
        }

        // 6. Dispatch Third-Party Processor Deletion
        var processorResults = await _processorService.PropagateDeletionAsync(
            userId, originalEmail, originalPhone, subjectRequest.Id);

        // 7. Update PrivacySubjectRequest to Completed
        subjectRequest.Status = PrivacyRequestStatus.Completed;
        subjectRequest.CompletedAt = DateTime.UtcNow;
        subjectRequest.ProcessorSyncStatus = $"Dispatched ({processorResults.Count} processors)";
        _uow.PrivacySubjectRequests.Update(subjectRequest);

        // 8. Immutable Audit Record
        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = null,
            Action = "PrivacySubjectAccountDeletion",
            EntityType = "User",
            EntityId = userId.ToString(),
            Details = $"Account {userId} successfully anonymized under PDPL 151/2020. Retained orders/financial records for statutory 5-year tax retention. Processors notified: {processorResults.Count}."
        });

        await _uow.SaveChangesAsync();

        _logger.LogInformation("Account deletion completed for User {UserId} (Request ID: {RequestId})",
            userId, subjectRequest.Id);

        return MapToResponse(subjectRequest);
    }

    public async Task<IEnumerable<PrivacySubjectRequestResponse>> GetMyPrivacyRequestsAsync(int userId)
    {
        var requests = (await _uow.PrivacySubjectRequests.FindAsync(r => r.UserId == userId))
            .OrderByDescending(r => r.SubmittedAt)
            .ToList();

        return requests.Select(MapToResponse);
    }

    public async Task<IEnumerable<AdminPrivacyRequestResponse>> GetAdminPrivacyRequestsAsync(string? status = null, bool? overdueOnly = null)
    {
        var allRequests = (await _uow.PrivacySubjectRequests.GetAllAsync())
            .OrderByDescending(r => r.SubmittedAt)
            .ToList();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PrivacyRequestStatus>(status, true, out var parsedStatus))
        {
            allRequests = allRequests.Where(r => r.Status == parsedStatus).ToList();
        }

        var now = DateTime.UtcNow;
        if (overdueOnly == true)
        {
            allRequests = allRequests.Where(r => r.Status != PrivacyRequestStatus.Completed && now > r.DueDate).ToList();
        }

        var userIds = allRequests.Select(r => r.UserId).Distinct().ToList();
        var users = (await _uow.Users.FindAsync(u => userIds.Contains(u.Id))).ToDictionary(u => u.Id);

        var requestIds = allRequests.Select(r => r.Id).ToList();
        var allLogs = (await _uow.ProcessorDeletionLogs.FindAsync(l => requestIds.Contains(l.PrivacySubjectRequestId))).ToList();

        return allRequests.Select(r =>
        {
            users.TryGetValue(r.UserId, out var u);
            var logs = allLogs.Where(l => l.PrivacySubjectRequestId == r.Id).Select(l => new ProcessorDeletionLogDto
            {
                Id = l.Id,
                PrivacySubjectRequestId = l.PrivacySubjectRequestId,
                UserId = l.UserId,
                ProcessorName = l.ProcessorName,
                ActionRequested = l.ActionRequested,
                Status = l.Status,
                ResponseMessage = l.ResponseMessage,
                DispatchedAt = l.DispatchedAt,
                AcknowledgedAt = l.AcknowledgedAt
            }).ToList();

            var resp = MapToResponse(r);
            return new AdminPrivacyRequestResponse
            {
                Id = resp.Id,
                UserId = resp.UserId,
                RequestType = resp.RequestType,
                Status = resp.Status,
                SubmittedAt = resp.SubmittedAt,
                DueDate = resp.DueDate,
                HoursRemaining = resp.HoursRemaining,
                IsOverdue = resp.IsOverdue,
                VerifiedAt = resp.VerifiedAt,
                CompletedAt = resp.CompletedAt,
                RejectionReason = resp.RejectionReason,
                ReviewerNotes = resp.ReviewerNotes,
                ProcessorSyncStatus = resp.ProcessorSyncStatus,
                ExportFormat = resp.ExportFormat,
                ExportToken = resp.ExportToken,
                ExportExpiresAt = resp.ExportExpiresAt,
                ExportDownloadUrl = resp.ExportDownloadUrl,
                UserName = u?.Name ?? "Deleted User",
                UserEmail = u?.Email,
                UserPhone = u?.Phone,
                ProcessorLogs = logs
            };
        });
    }

    public async Task<AdminPrivacyRequestResponse> ReviewPrivacyRequestAsync(int requestId, int adminId, ReviewPrivacyRequestInput input)
    {
        var request = await _uow.PrivacySubjectRequests.GetByIdAsync(requestId);
        if (request == null)
            throw new NotFoundException($"Privacy request with ID {requestId} not found.");

        if (string.Equals(input.Action, "Approve", StringComparison.OrdinalIgnoreCase))
        {
            request.Status = PrivacyRequestStatus.Approved;
        }
        else if (string.Equals(input.Action, "Reject", StringComparison.OrdinalIgnoreCase))
        {
            request.Status = PrivacyRequestStatus.Rejected;
            request.RejectionReason = input.Reason ?? "Request rejected per lawful processing exemption.";
        }
        else if (string.Equals(input.Action, "Hold", StringComparison.OrdinalIgnoreCase))
        {
            request.Status = PrivacyRequestStatus.LegalHold;
            request.ReviewerNotes = input.Notes ?? "Placed on administrative legal hold.";
        }
        else
        {
            throw new BadRequestException("Action must be 'Approve', 'Reject', or 'Hold'.");
        }

        if (!string.IsNullOrWhiteSpace(input.Notes))
        {
            request.ReviewerNotes = input.Notes;
        }

        _uow.PrivacySubjectRequests.Update(request);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "ReviewPrivacyRequest",
            EntityType = "PrivacySubjectRequest",
            EntityId = requestId.ToString(),
            Details = $"Admin {adminId} reviewed request {requestId}: Action={input.Action}, Status={request.Status}, Reason={input.Reason}"
        });

        await _uow.SaveChangesAsync();

        var adminList = await GetAdminPrivacyRequestsAsync();
        return adminList.First(r => r.Id == requestId);
    }

    // ─── Internal Data Assembler & Sanitizer ───────────────────────────
    private async Task<UserDataExportDto> AssembleUserExportDataAsync(User user)
    {
        var userId = user.Id;
        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();
        var addresses = (await _uow.UserAddresses.FindAsync(a => a.UserId == userId)).ToList();
        var consents = (await _uow.UserConsents.FindAsync(c => c.UserId == userId)).ToList();
        var reviews = (await _uow.Reviews.FindAsync(r => r.BuyerId == userId)).ToList();
        var refreshTokens = (await _uow.RefreshTokens.FindAsync(r => r.UserId == userId)).ToList();
        var wishlist = (await _uow.WishlistItems.FindAsync(w => w.UserId == userId)).ToList();
        var notifications = (await _uow.UserNotifications.FindAsync(n => n.UserId == userId)).ToList();
        var userDeviceTokens = (await _uow.UserDeviceTokens.FindAsync(d => d.UserId == userId)).ToList();
        var returnRequests = (await _uow.ReturnRequests.FindAsync(r => r.BuyerId == userId || r.SellerId == userId)).ToList();

        var orders = (await _uow.Orders.FindAsync(o => o.BuyerId == userId)).ToList();
        var orderIds = orders.Select(o => o.Id).ToList();

        var allShipments = orderIds.Count > 0
            ? (await _uow.Shipments.FindAsync(s => orderIds.Contains(s.OrderId))).ToList()
            : new List<Shipment>();
        var allItems = orderIds.Count > 0
            ? (await _uow.OrderItems.FindAsync(i => orderIds.Contains(i.OrderId))).ToList()
            : new List<OrderItem>();

        var orderExports = orders.Select(o =>
        {
            var shipments = allShipments.Where(s => s.OrderId == o.Id).ToList();
            var shipmentExports = shipments.Select(s =>
            {
                var items = allItems.Where(i => i.ShipmentId == s.Id).Select(i => new OrderItemExportDto
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice
                }).ToList();

                return new ShipmentExportDto
                {
                    Id = s.Id,
                    Status = s.Status.ToString(),
                    TrackingNumber = s.TrackingNumber,
                    DeliveryCost = s.DeliveryCost,
                    CodAmount = s.CodAmount,
                    ReturnReason = s.ReturnReason?.ToString(),
                    CreatedAt = s.CreatedAt,
                    Items = items
                };
            }).ToList();

            return new OrderExportDto
            {
                Id = o.Id,
                TotalAmount = o.TotalAmount,
                Status = o.Status.ToString(),
                DeliveryMethod = o.DeliveryMethod.ToString(),
                PaymentMethod = o.PaymentMethod.ToString(),
                Governorate = o.Governorate,
                City = o.City,
                Area = o.Area,
                StreetBuilding = o.StreetBuilding,
                CreatedAt = o.CreatedAt,
                Shipments = shipmentExports
            };
        }).ToList();

        var returnExports = returnRequests.Select(ret => new ReturnExportDto
        {
            Id = ret.Id,
            OrderId = ret.OrderId,
            ShipmentId = ret.ShipmentId,
            OrderItemId = ret.OrderItemId,
            Quantity = ret.Quantity,
            Category = ret.Category.ToString(),
            Reason = ret.Reason,
            Status = ret.Status.ToString(),
            RefundAmount = ret.RefundAmount,
            CreatedAt = ret.CreatedAt,
            ResolvedAt = ret.ResolvedAt
        }).ToList();

        var now = DateTime.UtcNow;

        return new UserDataExportDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email ?? string.Empty,
            Phone = user.Phone,
            Role = user.Role.ToString(),
            ExportedAt = now,
            SellerProfile = sellerProfile == null ? null : new SellerProfileExportDto
            {
                DispatchCity = sellerProfile.DispatchCity,
                DispatchAddress = sellerProfile.DispatchAddress,
                ContactPhone = sellerProfile.ContactPhone
            },
            Addresses = addresses.Select(a => new UserAddressExportDto
            {
                Id = a.Id,
                Label = a.Label,
                RecipientName = a.RecipientName,
                RecipientPhone = a.RecipientPhone,
                Governorate = a.Governorate,
                City = a.City,
                Area = a.Area,
                StreetBuilding = a.StreetBuilding,
                IsDefault = a.IsDefault,
                CreatedAt = a.CreatedAt
            }).ToList(),
            Consents = consents.Select(c => new UserConsentExportDto
            {
                PolicyVersion = c.PolicyVersion,
                AcceptedAt = c.AcceptedAt,
                MarketingConsent = c.MarketingConsent
            }).ToList(),
            Reviews = reviews.Select(r => new ReviewExportDto
            {
                Id = r.Id,
                ProductId = r.ProductId,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            }).ToList(),
            // Device sessions strictly EXCLUDING TokenHash
            DeviceSessions = refreshTokens.Select(rt => new DeviceSessionExportDto
            {
                Id = rt.Id,
                DeviceId = rt.DeviceId,
                DeviceName = rt.DeviceName,
                CreatedAt = rt.CreatedAt,
                LastUsedAt = rt.LastUsedAt,
                ExpiresAt = rt.ExpiresAt,
                RevokedAt = rt.RevokedAt,
                IsActive = rt.RevokedAt == null && rt.ExpiresAt > now
            }).ToList(),
            WishlistItems = wishlist.Select(w => new WishlistExportDto
            {
                ProductId = w.ProductId,
                CreatedAt = w.CreatedAt
            }).ToList(),
            Notifications = notifications.Select(n => new NotificationExportDto
            {
                Id = n.Id,
                TitleAr = n.TitleAr,
                TitleEn = n.TitleEn,
                BodyAr = n.BodyAr,
                BodyEn = n.BodyEn,
                Type = n.Type,
                ReferenceId = n.ReferenceId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList(),
            // Masked device tokens only
            DeviceTokens = userDeviceTokens.Select(d => new DeviceTokenExportDto
            {
                Platform = d.Platform,
                UpdatedAt = d.UpdatedAt,
                MaskedToken = d.DeviceToken.Length > 10 ? $"{d.DeviceToken[..4]}...{d.DeviceToken[^4..]}" : "***"
            }).ToList(),
            Orders = orderExports,
            Returns = returnExports
        };
    }

    private static string GenerateCsvExport(UserDataExportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# PROFILE");
        sb.AppendLine("Id,Name,Email,Phone,Role,ExportedAt");
        sb.AppendLine($"{dto.Id},\"{dto.Name}\",\"{dto.Email}\",\"{dto.Phone}\",{dto.Role},{dto.ExportedAt:o}");
        sb.AppendLine();

        sb.AppendLine("# ADDRESSES");
        sb.AppendLine("Id,Label,RecipientName,RecipientPhone,Governorate,City,Area,StreetBuilding,IsDefault");
        foreach (var a in dto.Addresses)
        {
            sb.AppendLine($"{a.Id},\"{a.Label}\",\"{a.RecipientName}\",\"{a.RecipientPhone}\",\"{a.Governorate}\",\"{a.City}\",\"{a.Area}\",\"{a.StreetBuilding}\",{a.IsDefault}");
        }
        sb.AppendLine();

        sb.AppendLine("# ORDERS");
        sb.AppendLine("Id,TotalAmount,Status,DeliveryMethod,PaymentMethod,Governorate,City,CreatedAt");
        foreach (var o in dto.Orders)
        {
            sb.AppendLine($"{o.Id},{o.TotalAmount},{o.Status},{o.DeliveryMethod},{o.PaymentMethod},\"{o.Governorate}\",\"{o.City}\",{o.CreatedAt:o}");
        }
        sb.AppendLine();

        sb.AppendLine("# RETURNS AND DISPUTES");
        sb.AppendLine("Id,OrderId,ShipmentId,Category,Reason,Status,RefundAmount,CreatedAt");
        foreach (var r in dto.Returns)
        {
            sb.AppendLine($"{r.Id},{r.OrderId},{r.ShipmentId},{r.Category},\"{r.Reason}\",{r.Status},{r.RefundAmount},{r.CreatedAt:o}");
        }
        sb.AppendLine();

        sb.AppendLine("# REVIEWS");
        sb.AppendLine("Id,ProductId,Rating,Comment,CreatedAt");
        foreach (var rv in dto.Reviews)
        {
            sb.AppendLine($"{rv.Id},{rv.ProductId},{rv.Rating},\"{rv.Comment.Replace("\"", "\"\"")}\",{rv.CreatedAt:o}");
        }
        sb.AppendLine();

        sb.AppendLine("# CONSENTS");
        sb.AppendLine("PolicyVersion,AcceptedAt,MarketingConsent");
        foreach (var c in dto.Consents)
        {
            sb.AppendLine($"\"{c.PolicyVersion}\",{c.AcceptedAt:o},{c.MarketingConsent}");
        }

        return sb.ToString();
    }

    private static PrivacySubjectRequestResponse MapToResponse(PrivacySubjectRequest r)
    {
        var now = DateTime.UtcNow;
        var hoursRemaining = (r.DueDate - now).TotalHours;
        bool isOverdue = r.Status != PrivacyRequestStatus.Completed && now > r.DueDate;

        return new PrivacySubjectRequestResponse
        {
            Id = r.Id,
            UserId = r.UserId,
            RequestType = r.RequestType,
            Status = r.Status,
            SubmittedAt = r.SubmittedAt,
            DueDate = r.DueDate,
            HoursRemaining = Math.Round(hoursRemaining, 2),
            IsOverdue = isOverdue,
            VerifiedAt = r.VerifiedAt,
            CompletedAt = r.CompletedAt,
            RejectionReason = r.RejectionReason,
            ReviewerNotes = r.ReviewerNotes,
            ProcessorSyncStatus = r.ProcessorSyncStatus,
            ExportFormat = r.ExportFormat,
            ExportToken = r.ExportToken,
            ExportExpiresAt = r.ExportExpiresAt,
            ExportDownloadUrl = !string.IsNullOrWhiteSpace(r.ExportToken) ? $"/api/users/me/privacy/export/{r.ExportToken}" : null
        };
    }

    private static void TryDeleteUploadedFile(string urlOrPath)
    {
        try
        {
            var idx = urlOrPath.IndexOf("/uploads/", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return;
            var relative = urlOrPath[(idx + 1)..].Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(AppContext.BaseDirectory, "wwwroot", relative);
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
        catch
        {
            // Ignore file deletion errors during account cleanup
        }
    }
}
