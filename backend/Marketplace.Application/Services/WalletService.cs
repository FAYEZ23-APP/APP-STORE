using Marketplace.Application.Common;
using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Validators.Users;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class WalletService : IWalletService
{
    private readonly IUnitOfWork _uow;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly IPasswordHasher _hasher;
    private readonly ITotpService _totp;

    public WalletService(
        IUnitOfWork uow,
        IConfiguration configuration,
        INotificationService notificationService,
        IPasswordHasher hasher,
        ITotpService totp)
    {
        _uow = uow;
        _configuration = configuration;
        _notificationService = notificationService;
        _hasher = hasher;
        _totp = totp;
    }

    private bool IsWalletEnabled =>
        _configuration.GetValue<bool?>("Features:EnableWallet")
        ?? _configuration.GetValue<bool?>("Features:WalletEnabled")
        ?? _configuration.GetValue<bool?>("Wallet:Enabled")
        ?? false;

    private bool IsPayoutsEnabled =>
        _configuration.GetValue<bool?>("Features:EnableVendorPayouts")
        ?? false;

    private void EnsureWalletEnabled()
    {
        if (!IsWalletEnabled) throw new NotFoundException("Wallet feature is currently disabled.");
    }

    private void EnsurePayoutsEnabled()
    {
        if (!IsPayoutsEnabled) throw new NotFoundException("Vendor payouts feature is currently disabled.");
    }


    public async Task<VendorWalletResponse> GetSellerWalletAsync(int sellerId)
    {
        EnsureWalletEnabled();
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller == null || seller.Role != UserRole.Seller)
        {
            throw new NotFoundException("Seller not found.");
        }

        var wallet = await GetOrCreateWalletAsync(sellerId);
        var transactions = (await _uow.WalletTransactions.FindAsync(t => t.WalletId == wallet.Id))
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToList();

        return new VendorWalletResponse
        {
            SellerId = wallet.SellerId,
            Balance = wallet.Balance,
            PendingBalance = wallet.PendingBalance,
            TotalEarned = wallet.TotalEarned,
            UpdatedAt = wallet.UpdatedAt,
            RecentTransactions = transactions.Select(t => new WalletTransactionResponse
            {
                Id = t.Id,
                OrderId = t.OrderId,
                ShipmentId = t.ShipmentId,
                Amount = t.Amount,
                Type = t.Type.ToString(),
                Description = t.Description,
                CreatedAt = t.CreatedAt
            }).ToList()
        };
    }

    public async Task<BuyerWalletResponse> GetBuyerWalletAsync(int buyerId)
    {
        EnsureWalletEnabled();
        var buyer = await _uow.Users.GetByIdAsync(buyerId);
        if (buyer == null)
            throw new NotFoundException("Buyer not found.");

        var wallet = (await _uow.BuyerWallets.FindAsync(w => w.BuyerId == buyerId)).FirstOrDefault();
        if (wallet == null)
        {
            wallet = new BuyerWallet
            {
                BuyerId = buyerId,
                Balance = 0m,
                UpdatedAt = DateTime.UtcNow
            };
            await _uow.BuyerWallets.AddAsync(wallet);
            await _uow.SaveChangesAsync();
        }

        var transactions = (await _uow.BuyerWalletTransactions.FindAsync(t => t.BuyerId == buyerId))
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToList();

        return new BuyerWalletResponse
        {
            BuyerId = wallet.BuyerId,
            Balance = wallet.Balance,
            UpdatedAt = wallet.UpdatedAt,
            Transactions = transactions.Select(t => new BuyerWalletTransactionResponse
            {
                Id = t.Id,
                OrderId = t.OrderId,
                ReturnRequestId = t.ReturnRequestId,
                Amount = t.Amount,
                Type = t.Type.ToString(),
                Description = t.Description,
                CreatedAt = t.CreatedAt
            }).ToList()
        };
    }

    public async Task<PayoutRequestResponse> RequestPayoutAsync(int sellerId, CreatePayoutRequest request)
    {
        EnsurePayoutsEnabled();
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller == null || seller.Role != UserRole.Seller)
        {
            throw new NotFoundException("Seller not found.");
        }

        if (!Enum.TryParse<PayoutMethod>(request.Method.Trim(), true, out var method))
        {
            throw new BadRequestException("طريقة السحب غير صحيحة.");
        }

        var destinationAccount = request.DestinationAccount.Trim();
        if (method == PayoutMethod.VodafoneCash && EgyptianPhoneValidation.IsValid(destinationAccount))
        {
            destinationAccount = EgyptianPhoneNormalizer.Normalize(destinationAccount);
        }

        // Ensure wallet exists before acquiring lock
        await GetOrCreateWalletAsync(sellerId);

        await _uow.BeginTransactionAsync();
        try
        {
            // Acquire row lock FOR UPDATE on VendorWallets
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""VendorWallets"" WHERE ""SellerId"" = {0} FOR UPDATE", sellerId);
            _uow.ClearChangeTracker();

            var wallet = await GetOrCreateWalletAsync(sellerId);

            if (wallet.Balance < request.Amount)
            {
                throw new BadRequestException($"الرصيد المتاح ({wallet.Balance} ج.م) غير كافٍ لإتمام طلب السحب بقيمة {request.Amount} ج.م.");
            }

            // Deduct from Balance and move to PendingBalance
            wallet.Balance -= request.Amount;
            wallet.PendingBalance += request.Amount;
            wallet.UpdatedAt = DateTime.UtcNow;
            _uow.VendorWallets.Update(wallet);

            var payout = new PayoutRequest
            {
                SellerId = sellerId,
                Amount = request.Amount,
                Method = method,
                DestinationAccount = destinationAccount,
                Status = PayoutStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };
            await _uow.PayoutRequests.AddAsync(payout);

            var transaction = new WalletTransaction
            {
                WalletId = wallet.Id,
                Amount = -request.Amount,
                Type = WalletTransactionType.Payout,
                Description = $"طلب سحب أرباح بقيمة {request.Amount} ج.م عبر {method} إلى {destinationAccount}",
                CreatedAt = DateTime.UtcNow
            };
            await _uow.WalletTransactions.AddAsync(transaction);

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();

            return new PayoutRequestResponse
            {
                Id = payout.Id,
                SellerId = seller.Id,
                SellerName = seller.Name,
                Amount = payout.Amount,
                Method = payout.Method.ToString(),
                DestinationAccount = payout.DestinationAccount,
                Status = payout.Status.ToString(),
                CreatedAt = payout.CreatedAt
            };
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();
            throw;
        }
    }

    public async Task<IEnumerable<PayoutRequestResponse>> GetSellerPayoutRequestsAsync(int sellerId)
    {
        EnsurePayoutsEnabled();
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller == null)
            throw new NotFoundException("Seller not found.");

        var payouts = (await _uow.PayoutRequests.FindAsync(p => p.SellerId == sellerId))
            .OrderByDescending(p => p.CreatedAt)
            .ToList();

        return payouts.Select(p => new PayoutRequestResponse
        {
            Id = p.Id,
            SellerId = p.SellerId,
            SellerName = seller.Name,
            Amount = p.Amount,
            Method = p.Method.ToString(),
            DestinationAccount = p.DestinationAccount,
            Status = p.Status.ToString(),
            AdminNotes = p.AdminNotes,
            CreatedAt = p.CreatedAt,
            ProcessedAt = p.ProcessedAt
        });
    }

    public async Task<IEnumerable<PayoutRequestResponse>> GetAllPayoutRequestsAsync(string? status = null)
    {
        EnsurePayoutsEnabled();
        var payouts = (await _uow.PayoutRequests.GetAllAsync()).ToList();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PayoutStatus>(status.Trim(), true, out var parsedStatus))
        {
            payouts = payouts.Where(p => p.Status == parsedStatus).ToList();
        }

        var sellerIds = payouts.Select(p => p.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);

        return payouts.Select(p => new PayoutRequestResponse
        {
            Id = p.Id,
            SellerId = p.SellerId,
            SellerName = sellers.GetValueOrDefault(p.SellerId, "Unknown Seller"),
            Amount = p.Amount,
            Method = p.Method.ToString(),
            DestinationAccount = p.DestinationAccount,
            Status = p.Status.ToString(),
            AdminNotes = p.AdminNotes,
            CreatedAt = p.CreatedAt,
            ProcessedAt = p.ProcessedAt
        }).OrderByDescending(p => p.CreatedAt);
    }

    public async Task<PayoutRequestResponse> ProcessPayoutAsync(int payoutRequestId, ProcessPayoutRequest request)
    {
        if (!Enum.TryParse<PayoutStatus>(request.Status.Trim(), true, out var targetStatus) ||
            targetStatus == PayoutStatus.Pending)
        {
            throw new BadRequestException("حالة المعالجة يجب أن تكون 'Completed' أو 'Rejected'.");
        }

        await _uow.BeginTransactionAsync();
        try
        {
            // Acquire row lock FOR UPDATE on PayoutRequests
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""PayoutRequests"" WHERE ""Id"" = {0} FOR UPDATE", payoutRequestId);
            _uow.ClearChangeTracker();

            var payout = await _uow.PayoutRequests.GetByIdAsync(payoutRequestId);
            if (payout == null)
            {
                throw new NotFoundException($"Payout request with ID {payoutRequestId} not found.");
            }

            if (payout.Status != PayoutStatus.Pending)
            {
                throw new BadRequestException("تمت معالجة طلب السحب هذا مسبقاً ولا يمكن تعديل حالته.");
            }

            // Ensure seller's VendorWallet exists before locking
            await GetOrCreateWalletAsync(payout.SellerId);

            // Acquire row lock FOR UPDATE on VendorWallets
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""VendorWallets"" WHERE ""SellerId"" = {0} FOR UPDATE", payout.SellerId);

            var wallet = await GetOrCreateWalletAsync(payout.SellerId);

            if (targetStatus == PayoutStatus.Completed)
            {
                wallet.PendingBalance = Math.Max(0m, wallet.PendingBalance - payout.Amount);
                wallet.UpdatedAt = DateTime.UtcNow;
                _uow.VendorWallets.Update(wallet);

                payout.Status = PayoutStatus.Completed;
                payout.AdminNotes = request.AdminNotes;
                payout.ProcessedAt = DateTime.UtcNow;
                _uow.PayoutRequests.Update(payout);
            }
            else if (targetStatus == PayoutStatus.Rejected)
            {
                // Refund back to available balance
                wallet.Balance += payout.Amount;
                wallet.PendingBalance = Math.Max(0m, wallet.PendingBalance - payout.Amount);
                wallet.UpdatedAt = DateTime.UtcNow;
                _uow.VendorWallets.Update(wallet);

                payout.Status = PayoutStatus.Rejected;
                payout.AdminNotes = request.AdminNotes;
                payout.ProcessedAt = DateTime.UtcNow;
                _uow.PayoutRequests.Update(payout);

                var refundTx = new WalletTransaction
                {
                    WalletId = wallet.Id,
                    Amount = payout.Amount,
                    Type = WalletTransactionType.Refund,
                    Description = $"استرجاع رصيد لطلب السحب المرفوض #{payout.Id}: {request.AdminNotes ?? "تم الرفض من قبل الإدارة"}",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.WalletTransactions.AddAsync(refundTx);
            }

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();

            await _notificationService.NotifyPayoutProcessedAsync(payout.Id, targetStatus);

            var seller = await _uow.Users.GetByIdAsync(payout.SellerId);

            return new PayoutRequestResponse
            {
                Id = payout.Id,
                SellerId = payout.SellerId,
                SellerName = seller?.Name ?? "Unknown Seller",
                Amount = payout.Amount,
                Method = payout.Method.ToString(),
                DestinationAccount = payout.DestinationAccount,
                Status = payout.Status.ToString(),
                AdminNotes = payout.AdminNotes,
                CreatedAt = payout.CreatedAt,
                ProcessedAt = payout.ProcessedAt
            };
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();
            throw;
        }
    }

    public async Task ProcessShipmentDeliveredAsync(int shipmentId)
    {
        await _uow.BeginTransactionAsync();
        try
        {
            // Acquire row lock FOR UPDATE on Shipments
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""Shipments"" WHERE ""Id"" = {0} FOR UPDATE", shipmentId);
            _uow.ClearChangeTracker();

            var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
            if (shipment == null)
            {
                await _uow.RollbackTransactionAsync();
                return;
            }

            // Idempotency: verify this shipment has not already been credited or held in escrow
            var existingTx = await _uow.WalletTransactions.FindAsync(t =>
                t.ShipmentId == shipmentId && (
                    t.Type == WalletTransactionType.COD_Collection ||
                    t.Type == WalletTransactionType.OrderSettlement ||
                    t.Type == WalletTransactionType.COD_EscrowHold));

            if (existingTx.Any())
            {
                await _uow.RollbackTransactionAsync();
                return; // Already processed
            }

            // Ensure seller's VendorWallet exists before locking
            await GetOrCreateWalletAsync(shipment.SellerId);

            // Acquire row lock FOR UPDATE on VendorWallets
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""VendorWallets"" WHERE ""SellerId"" = {0} FOR UPDATE", shipment.SellerId);

            var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();
            decimal itemsSubtotal = items.Sum(i => i.UnitPrice * i.Quantity);

            decimal commissionRate = _configuration.GetValue<decimal>("Marketplace:CommissionRate", 0.10m); // 10%
            decimal commissionAmount = Math.Round(itemsSubtotal * commissionRate, 2);
            decimal netEarnings = itemsSubtotal - commissionAmount;

            var wallet = await GetOrCreateWalletAsync(shipment.SellerId);

            // COD Escrow Hold Protection:
            // When a COD shipment is delivered, physical cash is with the courier/carrier, NOT yet in the platform's bank account.
            // Holding net earnings in PendingBalance prevents platform cash deficits (عجز سيولة) until courier remittance is confirmed.
            var isCod = shipment.CodAmount > 0;
            var requireCodEscrow = _configuration.GetValue<bool>("Marketplace:RequireCodEscrowHold", true);

            if (isCod && requireCodEscrow && !shipment.IsCodSettled)
            {
                wallet.PendingBalance += netEarnings;
                wallet.TotalEarned += netEarnings;
                wallet.UpdatedAt = DateTime.UtcNow;
                _uow.VendorWallets.Update(wallet);

                var escrowTx = new WalletTransaction
                {
                    WalletId = wallet.Id,
                    OrderId = shipment.OrderId,
                    ShipmentId = shipment.Id,
                    Amount = netEarnings,
                    Type = WalletTransactionType.COD_EscrowHold,
                    Description = $"أرباح معلقة في الضمان بانتظار توريد كاش الشحنة من شركة الشحن (COD Escrow Hold) - بوليصة {shipment.TrackingNumber} - طلب #{shipment.OrderId}",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.WalletTransactions.AddAsync(escrowTx);

                if (commissionAmount > 0)
                {
                    var commissionTx = new WalletTransaction
                    {
                        WalletId = wallet.Id,
                        OrderId = shipment.OrderId,
                        ShipmentId = shipment.Id,
                        Amount = -commissionAmount,
                        Type = WalletTransactionType.Commission,
                        Description = $"عمولة المنصة ({commissionRate * 100:0.#}%) للشحنة #{shipment.Id}",
                        CreatedAt = DateTime.UtcNow
                    };
                    await _uow.WalletTransactions.AddAsync(commissionTx);
                }

                await _uow.SaveChangesAsync();
                await _uow.CommitTransactionAsync();
                return;
            }

            // Prepaid / non-COD or already settled
            wallet.Balance += netEarnings;
            wallet.TotalEarned += netEarnings;
            wallet.UpdatedAt = DateTime.UtcNow;
            _uow.VendorWallets.Update(wallet);

            // Transaction 1: Order Settlement
            var settlementTx = new WalletTransaction
            {
                WalletId = wallet.Id,
                OrderId = shipment.OrderId,
                ShipmentId = shipment.Id,
                Amount = itemsSubtotal,
                Type = WalletTransactionType.OrderSettlement,
                Description = $"تسوية أرباح شحنة تم تسليمها بنجاح (بوليصة {shipment.TrackingNumber}) - طلب #{shipment.OrderId}",
                CreatedAt = DateTime.UtcNow
            };
            await _uow.WalletTransactions.AddAsync(settlementTx);

            // Transaction 2: Platform Commission
            if (commissionAmount > 0)
            {
                var commissionTx = new WalletTransaction
                {
                    WalletId = wallet.Id,
                    OrderId = shipment.OrderId,
                    ShipmentId = shipment.Id,
                    Amount = -commissionAmount,
                    Type = WalletTransactionType.Commission,
                    Description = $"عمولة المنصة ({commissionRate * 100:0.#}%) للشحنة #{shipment.Id}",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.WalletTransactions.AddAsync(commissionTx);
            }

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();
            throw;
        }
    }

    public async Task SettleCodShipmentAsync(int shipmentId, string? notes = null)
    {
        await _uow.BeginTransactionAsync();
        try
        {
            // Concurrency: acquire row lock on Shipments
            await _uow.ExecuteSqlRawAsync(@"SELECT 1 FROM ""Shipments"" WHERE ""Id"" = {0} FOR UPDATE", shipmentId);
            _uow.ClearChangeTracker();

            var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
            if (shipment == null)
                throw new NotFoundException($"Shipment #{shipmentId} not found.");

            if (shipment.Status != ShipmentStatus.Delivered)
                throw new BadRequestException("لا يمكن تسوية نقدية شحنة لم يتم تسليمها بعد (Status must be Delivered).");

            if (shipment.CodAmount <= 0)
                throw new BadRequestException("هذه الشحنة ليست شحنة دفع عند الاستلام (Non-COD shipment).");

            if (shipment.IsCodSettled)
                throw new BadRequestException("تمت تسوية نقدية هذه الشحنة مسبقاً وتوريدها للمنصة.");

            // Return policy: release only if shipment has no open return requests
            var openReturns = (await _uow.ReturnRequests.FindAsync(r =>
                r.ShipmentId == shipmentId && (r.Status == ReturnStatus.Pending || r.Status == ReturnStatus.Approved))).ToList();
            if (openReturns.Any())
                throw new BadRequestException("لا يمكن تسوية الشحنة والإفراج عن الأرباح لوجود طلب إرجاع مفتوح قيد المعالجة (Open return request exists).");

            // Verify escrow hold ledger entry exists
            var escrowHoldTx = (await _uow.WalletTransactions.FindAsync(t =>
                t.ShipmentId == shipmentId && t.Type == WalletTransactionType.COD_EscrowHold)).FirstOrDefault();
            if (escrowHoldTx == null)
                throw new BadRequestException("لا يوجد سجل حجز ضمان (COD_EscrowHold) لهذه الشحنة (شحنة قديمة قبل تفعيل نظام الضمان أو غير مؤهلة).");

            var netEarnings = escrowHoldTx.Amount;
            await GetOrCreateWalletAsync(shipment.SellerId);
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""VendorWallets"" WHERE ""SellerId"" = {0} FOR UPDATE", shipment.SellerId);
            var wallet = await GetOrCreateWalletAsync(shipment.SellerId);

            if (wallet.PendingBalance < netEarnings)
                throw new BadRequestException($"رصيد الضمان المعلق ({wallet.PendingBalance} ج.م) غير كافٍ لإتمام التسوية بقيمة {netEarnings} ج.م.");

            // Move PendingBalance -> Balance atomically with standard decimal rounding
            wallet.PendingBalance = Math.Round(wallet.PendingBalance - netEarnings, 2, MidpointRounding.AwayFromZero);
            wallet.Balance = Math.Round(wallet.Balance + netEarnings, 2, MidpointRounding.AwayFromZero);
            wallet.UpdatedAt = DateTime.UtcNow;
            _uow.VendorWallets.Update(wallet);

            shipment.IsCodSettled = true;
            shipment.CodSettledAt = DateTime.UtcNow;
            shipment.ReceivedAmount = shipment.CodAmount;
            shipment.SettlementReference = $"CARRIER-DEV-{shipment.Id}";
            shipment.FlaggedForReview = false;
            _uow.Shipments.Update(shipment);

            var releaseTx = new WalletTransaction
            {
                WalletId = wallet.Id,
                OrderId = shipment.OrderId,
                ShipmentId = shipment.Id,
                Amount = netEarnings,
                Type = WalletTransactionType.COD_EscrowRelease,
                Description = $"تحرير أرباح الشحنة #{shipment.Id} (بوليصة {shipment.TrackingNumber}) إلى الرصيد المتاح بعد استلام وتوريد النقدية من شركة الشحن. {notes}".Trim(),
                CreatedAt = DateTime.UtcNow
            };
            await _uow.WalletTransactions.AddAsync(releaseTx);

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();
            throw;
        }
    }

    public async Task<SettleCodResultResponse> SettleCodByAdminAsync(int shipmentId, int adminId, AdminSettleCodRequest request)
    {
        // 1. Step-up Authentication (Password + TOTP)
        if (string.IsNullOrWhiteSpace(request.Password))
            throw new UnauthorizedException("كلمة مرور المشرف مطلوبة لتأكيد تسوية النقدية (Admin step-up password is required).");

        if (string.IsNullOrWhiteSpace(request.TotpCode))
            throw new UnauthorizedException("رمز المصادقة الثنائية (TOTP) مطلوب لتأكيد تسوية النقدية (Admin step-up TOTP code is required).");

        if (string.IsNullOrWhiteSpace(request.SettlementReference) || request.SettlementReference.Trim().Length < 5)
            throw new BadRequestException("الرقم المرجعي لتسوية شركة الشحن إلزامي ويجب ألا يقل عن 5 أحرف (Carrier reference min 5 chars).");

        if (request.ReceivedAmount <= 0)
            throw new BadRequestException("المبلغ المحصل المستلم الفعلي يجب أن يكون أكبر من الصفر.");

        var admin = await _uow.Users.GetByIdAsync(adminId);
        if (admin == null || admin.Role != UserRole.Admin)
            throw new ForbiddenException("صلاحية المشرف مطلوبة لإجراء هذه العملية.");

        if (!_hasher.Verify(request.Password, admin.PasswordHash ?? string.Empty))
            throw new UnauthorizedException("كلمة مرور المشرف غير صحيحة.");

        if (string.IsNullOrWhiteSpace(admin.TwoFactorSecret) || !_totp.VerifyCode(admin.TwoFactorSecret, request.TotpCode.Trim()))
            throw new UnauthorizedException("رمز المصادقة الثنائية (TOTP) غير صحيح أو منتهي الصلاحية.");

        await _uow.BeginTransactionAsync();
        try
        {
            // Concurrency: acquire row lock on Shipments
            await _uow.ExecuteSqlRawAsync(@"SELECT 1 FROM ""Shipments"" WHERE ""Id"" = {0} FOR UPDATE", shipmentId);
            _uow.ClearChangeTracker();

            var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
            if (shipment == null)
                throw new NotFoundException($"Shipment #{shipmentId} not found.");

            if (shipment.Status != ShipmentStatus.Delivered)
                throw new BadRequestException("لا يمكن تسوية نقدية شحنة لم يتم تسليمها بعد (Status must be Delivered).");

            if (shipment.CodAmount <= 0)
                throw new BadRequestException("هذه الشحنة ليست شحنة دفع عند الاستلام (Non-COD shipment).");

            if (shipment.IsCodSettled)
                throw new BadRequestException("تمت تسوية نقدية هذه الشحنة مسبقاً وتوريدها للمنصة.");

            // Return policy check: release only if shipment has no open return requests
            var openReturns = (await _uow.ReturnRequests.FindAsync(r =>
                r.ShipmentId == shipmentId && (r.Status == ReturnStatus.Pending || r.Status == ReturnStatus.Approved))).ToList();
            if (openReturns.Any())
                throw new BadRequestException("لا يمكن تسوية الشحنة والإفراج عن الأرباح لوجود طلب إرجاع مفتوح قيد المعالجة (Open return request exists).");

            // Amount discrepancy check:
            if (request.ReceivedAmount != shipment.CodAmount)
            {
                // Discrepancy: flag for review, store metadata, write exactly one AdminAuditLog, do NOT release escrow
                shipment.ReceivedAmount = request.ReceivedAmount;
                shipment.SettlementReference = request.SettlementReference.Trim();
                shipment.SettledByAdminId = adminId;
                shipment.FlaggedForReview = true;
                _uow.Shipments.Update(shipment);

                var discrepancyAudit = new AdminAuditLog
                {
                    AdminId = adminId,
                    Action = "FLAGGED_FOR_REVIEW",
                    EntityType = "Shipment",
                    EntityId = shipment.Id.ToString(),
                    Details = $"مبلغ التحصيل المستلم ({request.ReceivedAmount} ج.م) يختلف عن المتوقع ({shipment.CodAmount} ج.م). مرجع التوريد: {request.SettlementReference.Trim()}. تم تعليق الشحنة للمراجعة وعدم تحرير الأرباح تلقائياً.",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.AdminAuditLogs.AddAsync(discrepancyAudit);

                await _uow.SaveChangesAsync();
                await _uow.CommitTransactionAsync();

                return new SettleCodResultResponse
                {
                    Success = true,
                    FlaggedForReview = true,
                    Released = false,
                    ExpectedAmount = shipment.CodAmount,
                    ReceivedAmount = request.ReceivedAmount,
                    SettlementReference = request.SettlementReference.Trim(),
                    Message = "مبلغ التحصيل المستلم يختلف عن المتوقع. تم تعليق الشحنة للمراجعة ولم يتم تحرير الأرباح تلقائياً."
                };
            }

            // Normal matching release:
            var escrowHoldTx = (await _uow.WalletTransactions.FindAsync(t =>
                t.ShipmentId == shipmentId && t.Type == WalletTransactionType.COD_EscrowHold)).FirstOrDefault();
            if (escrowHoldTx == null)
                throw new BadRequestException("لا يوجد سجل حجز ضمان (COD_EscrowHold) لهذه الشحنة (شحنة قديمة قبل تفعيل نظام الضمان أو غير مؤهلة).");

            var netEarnings = escrowHoldTx.Amount;
            await GetOrCreateWalletAsync(shipment.SellerId);
            await _uow.ExecuteSqlRawAsync(
                @"SELECT 1 FROM ""VendorWallets"" WHERE ""SellerId"" = {0} FOR UPDATE", shipment.SellerId);
            var wallet = await GetOrCreateWalletAsync(shipment.SellerId);

            if (wallet.PendingBalance < netEarnings)
                throw new BadRequestException($"رصيد الضمان المعلق ({wallet.PendingBalance} ج.م) غير كافٍ لإتمام التسوية بقيمة {netEarnings} ج.م.");

            wallet.PendingBalance = Math.Round(wallet.PendingBalance - netEarnings, 2, MidpointRounding.AwayFromZero);
            wallet.Balance = Math.Round(wallet.Balance + netEarnings, 2, MidpointRounding.AwayFromZero);
            wallet.UpdatedAt = DateTime.UtcNow;
            _uow.VendorWallets.Update(wallet);

            shipment.IsCodSettled = true;
            shipment.CodSettledAt = DateTime.UtcNow;
            shipment.ReceivedAmount = request.ReceivedAmount;
            shipment.SettlementReference = request.SettlementReference.Trim();
            shipment.SettledByAdminId = adminId;
            shipment.FlaggedForReview = false;
            _uow.Shipments.Update(shipment);

            var releaseTx = new WalletTransaction
            {
                WalletId = wallet.Id,
                OrderId = shipment.OrderId,
                ShipmentId = shipment.Id,
                Amount = netEarnings,
                Type = WalletTransactionType.COD_EscrowRelease,
                Description = $"تحرير أرباح الشحنة #{shipment.Id} (بوليصة {shipment.TrackingNumber}) إلى الرصيد المتاح بعد استلام وتوريد النقدية بالمرجع {request.SettlementReference.Trim()}. {request.Notes}".Trim(),
                CreatedAt = DateTime.UtcNow
            };
            await _uow.WalletTransactions.AddAsync(releaseTx);

            var auditLog = new AdminAuditLog
            {
                AdminId = adminId,
                Action = "SETTLE_COD",
                EntityType = "Shipment",
                EntityId = shipment.Id.ToString(),
                Details = $"تم تأكيد توريد نقدية الشحنة #{shipment.Id} بمبلغ {request.ReceivedAmount} ج.م بالمرجع {request.SettlementReference.Trim()} والإفراج عن أرباح التاجر ({netEarnings} ج.م) في المحفظة.",
                CreatedAt = DateTime.UtcNow
            };
            await _uow.AdminAuditLogs.AddAsync(auditLog);

            await _uow.SaveChangesAsync();
            await _uow.CommitTransactionAsync();

            return new SettleCodResultResponse
            {
                Success = true,
                FlaggedForReview = false,
                Released = true,
                ExpectedAmount = shipment.CodAmount,
                ReceivedAmount = request.ReceivedAmount,
                SettlementReference = request.SettlementReference.Trim(),
                Message = "تم تأكيد توريد النقدية والإفراج عن أرباح التاجر بنجاح."
            };
        }
        catch
        {
            await _uow.RollbackTransactionAsync();
            _uow.ClearChangeTracker();
            throw;
        }
    }

    private async Task<VendorWallet> GetOrCreateWalletAsync(int sellerId)
    {
        var wallet = (await _uow.VendorWallets.FindAsync(w => w.SellerId == sellerId)).FirstOrDefault();
        if (wallet == null)
        {
            wallet = new VendorWallet
            {
                SellerId = sellerId,
                Balance = 0m,
                PendingBalance = 0m,
                TotalEarned = 0m,
                UpdatedAt = DateTime.UtcNow
            };
            await _uow.VendorWallets.AddAsync(wallet);
            await _uow.SaveChangesAsync();
        }
        return wallet;
    }
}
