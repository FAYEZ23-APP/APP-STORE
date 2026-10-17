using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Application.Services;

public class WalletService : IWalletService
{
    private readonly IUnitOfWork _uow;
    private readonly IConfiguration _configuration;

    public WalletService(IUnitOfWork uow, IConfiguration configuration)
    {
        _uow = uow;
        _configuration = configuration;
    }

    public async Task<VendorWalletResponse> GetSellerWalletAsync(int sellerId)
    {
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
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller == null || seller.Role != UserRole.Seller)
        {
            throw new NotFoundException("Seller not found.");
        }

        var wallet = await GetOrCreateWalletAsync(sellerId);

        if (wallet.Balance < request.Amount)
        {
            throw new BadRequestException($"الرصيد المتاح ({wallet.Balance} ج.م) غير كافٍ لإتمام طلب السحب بقيمة {request.Amount} ج.م.");
        }

        if (!Enum.TryParse<PayoutMethod>(request.Method.Trim(), true, out var method))
        {
            throw new BadRequestException("طريقة السحب غير صحيحة.");
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
            DestinationAccount = request.DestinationAccount.Trim(),
            Status = PayoutStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        await _uow.PayoutRequests.AddAsync(payout);

        var transaction = new WalletTransaction
        {
            WalletId = wallet.Id,
            Amount = -request.Amount,
            Type = WalletTransactionType.Payout,
            Description = $"طلب سحب أرباح بقيمة {request.Amount} ج.م عبر {method} إلى {request.DestinationAccount.Trim()}",
            CreatedAt = DateTime.UtcNow
        };
        await _uow.WalletTransactions.AddAsync(transaction);

        await _uow.SaveChangesAsync();

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

    public async Task<IEnumerable<PayoutRequestResponse>> GetSellerPayoutRequestsAsync(int sellerId)
    {
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
        var payout = await _uow.PayoutRequests.GetByIdAsync(payoutRequestId);
        if (payout == null)
        {
            throw new NotFoundException($"Payout request with ID {payoutRequestId} not found.");
        }

        if (payout.Status != PayoutStatus.Pending)
        {
            throw new BadRequestException("تمت معالجة طلب السحب هذا مسبقاً ولا يمكن تعديل حالته.");
        }

        if (!Enum.TryParse<PayoutStatus>(request.Status.Trim(), true, out var targetStatus) ||
            targetStatus == PayoutStatus.Pending)
        {
            throw new BadRequestException("حالة المعالجة يجب أن تكون 'Completed' أو 'Rejected'.");
        }

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

    public async Task ProcessShipmentDeliveredAsync(int shipmentId)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null) return;

        // Idempotency: verify this shipment has not already been credited
        var existingTx = await _uow.WalletTransactions.FindAsync(t =>
            t.ShipmentId == shipmentId && t.Type == WalletTransactionType.COD_Collection);

        if (existingTx.Any())
            return; // Already processed

        var items = (await _uow.OrderItems.FindAsync(i => i.ShipmentId == shipmentId)).ToList();
        decimal itemsSubtotal = items.Sum(i => i.UnitPrice * i.Quantity);

        decimal commissionRate = _configuration.GetValue<decimal>("Marketplace:CommissionRate", 0.10m); // 10%
        decimal commissionAmount = Math.Round(itemsSubtotal * commissionRate, 2);
        decimal netEarnings = itemsSubtotal - commissionAmount;

        var wallet = await GetOrCreateWalletAsync(shipment.SellerId);
        wallet.Balance += netEarnings;
        wallet.TotalEarned += netEarnings;
        wallet.UpdatedAt = DateTime.UtcNow;
        _uow.VendorWallets.Update(wallet);

        // Transaction 1: COD Collection
        var collectionTx = new WalletTransaction
        {
            WalletId = wallet.Id,
            OrderId = shipment.OrderId,
            ShipmentId = shipment.Id,
            Amount = itemsSubtotal,
            Type = WalletTransactionType.COD_Collection,
            Description = $"تحصيل شحنة تم تسليمها بنجاح (بوليصة {shipment.TrackingNumber}) - طلب #{shipment.OrderId}",
            CreatedAt = DateTime.UtcNow
        };
        await _uow.WalletTransactions.AddAsync(collectionTx);

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
