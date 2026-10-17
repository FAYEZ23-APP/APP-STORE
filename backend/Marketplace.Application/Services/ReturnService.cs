using Marketplace.Application.DTOs.Returns;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Services;

public class ReturnService : IReturnService
{
    private readonly IUnitOfWork _uow;

    public ReturnService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<ReturnResponse> CreateReturnAsync(int buyerId, CreateReturnRequest request)
    {
        var item = await _uow.OrderItems.GetByIdAsync(request.OrderItemId);
        if (item == null)
            throw new NotFoundException("عنصر الطلب المطلوب إرجاعه غير موجود.");

        var order = await _uow.Orders.GetByIdAsync(item.OrderId);
        if (order == null || order.BuyerId != buyerId)
            throw new ForbiddenException("لا تملك صلاحية تقديم طلب إرجاع لهذا المنتج.");

        var shipment = await _uow.Shipments.GetByIdAsync(item.ShipmentId);
        if (shipment == null)
            throw new NotFoundException("شحنة الطلب غير موجودة.");

        if (shipment.Status != ShipmentStatus.Delivered)
            throw new BadRequestException("لا يمكن تقديم طلب إرجاع إلا بعد استلام الشحنة وتوصيلها بالفعل.");

        // 14-Day Post-Delivery Check (Egyptian Consumer Protection Law 181/2018)
        var deliveryDate = shipment.DeliveredAt ?? shipment.CreatedAt;
        if (DateTime.UtcNow > deliveryDate.AddDays(14))
        {
            throw new BadRequestException("انتهت الفترة القانونية المسموح بها لطلب الإرجاع (14 يوماً من تاريخ استلام الشحنة وفقاً لقانون حماية المستهلك 181/2018).");
        }

        var existingReturns = (await _uow.ReturnRequests.FindAsync(r => r.OrderItemId == item.Id && r.Status != ReturnStatus.Rejected)).ToList();
        int alreadyReturnedQty = existingReturns.Sum(r => r.Quantity);
        int availableToReturn = item.Quantity - alreadyReturnedQty;

        if (request.Quantity <= 0 || request.Quantity > availableToReturn)
        {
            throw new BadRequestException($"الكمية المطلوبة للإرجاع ({request.Quantity}) غير صالحة. الكمية المتبقية المتاحة للإرجاع هي {availableToReturn}.");
        }

        decimal refundAmount = item.UnitPrice * request.Quantity;

        var returnReq = new ReturnRequest
        {
            OrderId = order.Id,
            ShipmentId = shipment.Id,
            OrderItemId = item.Id,
            BuyerId = buyerId,
            SellerId = shipment.SellerId,
            Quantity = request.Quantity,
            Reason = request.Reason.Trim(),
            DefectImageUrl = request.DefectImageUrl?.Trim(),
            Status = ReturnStatus.Pending,
            RefundAmount = refundAmount,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.ReturnRequests.AddAsync(returnReq);
        await _uow.SaveChangesAsync();

        var product = await _uow.Products.GetByIdAsync(item.ProductId);
        var buyer = await _uow.Users.GetByIdAsync(buyerId);

        return MapToResponse(returnReq, item, product, buyer);
    }

    public async Task<ReturnResponse> ResolveReturnAsync(int sellerId, int returnId, ResolveReturnRequest request)
    {
        var returnReq = await _uow.ReturnRequests.GetByIdAsync(returnId);
        if (returnReq == null)
            throw new NotFoundException("طلب الإرجاع غير موجود.");

        if (returnReq.SellerId != sellerId)
            throw new ForbiddenException("ليس لديك صلاحية البت في طلب الإرجاع هذا.");

        if (returnReq.Status != ReturnStatus.Pending)
            throw new BadRequestException("تم البت في طلب الإرجاع مسبقاً ولا يمكن تعديل حالته.");

        if (!Enum.TryParse<ReturnStatus>(request.Status.Trim(), true, out var newStatus))
            throw new BadRequestException("حالة القرار غير صحيحة. يجب أن تكون 'Approved' أو 'Completed' أو 'Rejected'.");

        var item = await _uow.OrderItems.GetByIdAsync(returnReq.OrderItemId);

        if (newStatus == ReturnStatus.Approved || newStatus == ReturnStatus.Completed)
        {
            await _uow.BeginTransactionAsync();
            try
            {
                // 1. Restore stock to ProductVariant or Product
                if (item != null)
                {
                    if (item.VariantId.HasValue)
                    {
                        await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""ProductVariants"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                            returnReq.Quantity,
                            item.VariantId.Value);
                    }
                    else
                    {
                        await _uow.ExecuteSqlRawAsync(
                            @"UPDATE ""Products"" SET ""Stock"" = ""Stock"" + {0} WHERE ""Id"" = {1}",
                            returnReq.Quantity,
                            item.ProductId);
                    }
                }

                // 2. Ensure buyer wallet exists
                var buyerWallets = (await _uow.BuyerWallets.FindAsync(w => w.BuyerId == returnReq.BuyerId)).ToList();
                if (!buyerWallets.Any())
                {
                    var newWallet = new BuyerWallet
                    {
                        BuyerId = returnReq.BuyerId,
                        Balance = 0m,
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _uow.BuyerWallets.AddAsync(newWallet);
                    await _uow.SaveChangesAsync();
                }

                // 3. Atomically credit buyer wallet
                await _uow.ExecuteSqlRawAsync(
                    @"UPDATE ""BuyerWallets"" SET ""Balance"" = ""Balance"" + {0}, ""UpdatedAt"" = {1} WHERE ""BuyerId"" = {2}",
                    returnReq.RefundAmount,
                    DateTime.UtcNow,
                    returnReq.BuyerId);

                // 4. Record wallet transaction
                var tx = new BuyerWalletTransaction
                {
                    BuyerId = returnReq.BuyerId,
                    OrderId = returnReq.OrderId,
                    ReturnRequestId = returnReq.Id,
                    Amount = returnReq.RefundAmount,
                    Type = BuyerWalletTransactionType.RefundCredit,
                    Description = $"استرداد رصيد بقيمة {returnReq.RefundAmount} ج.م لمرتجع الطلب #{returnReq.OrderId}",
                    CreatedAt = DateTime.UtcNow
                };
                await _uow.BuyerWalletTransactions.AddAsync(tx);

                // 5. Update return status
                returnReq.Status = newStatus;
                returnReq.ResolvedAt = DateTime.UtcNow;
                _uow.ReturnRequests.Update(returnReq);
                await _uow.SaveChangesAsync();

                await _uow.CommitTransactionAsync();
            }
            catch
            {
                await _uow.RollbackTransactionAsync();
                throw;
            }
        }
        else if (newStatus == ReturnStatus.Rejected)
        {
            returnReq.Status = ReturnStatus.Rejected;
            returnReq.ResolvedAt = DateTime.UtcNow;
            _uow.ReturnRequests.Update(returnReq);
            await _uow.SaveChangesAsync();
        }

        var product = item != null ? await _uow.Products.GetByIdAsync(item.ProductId) : null;
        var buyer = await _uow.Users.GetByIdAsync(returnReq.BuyerId);

        return MapToResponse(returnReq, item, product, buyer);
    }

    public async Task<IEnumerable<ReturnResponse>> GetBuyerReturnsAsync(int buyerId)
    {
        var returns = (await _uow.ReturnRequests.FindAsync(r => r.BuyerId == buyerId))
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        if (!returns.Any())
            return Enumerable.Empty<ReturnResponse>();

        var itemIds = returns.Select(r => r.OrderItemId).Distinct().ToList();
        var items = (await _uow.OrderItems.FindAsync(i => itemIds.Contains(i.Id))).ToDictionary(i => i.Id);

        var productIds = items.Values.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var buyer = await _uow.Users.GetByIdAsync(buyerId);

        return returns.Select(r =>
        {
            items.TryGetValue(r.OrderItemId, out var item);
            Product? product = null;
            if (item != null) products.TryGetValue(item.ProductId, out product);
            return MapToResponse(r, item, product, buyer);
        });
    }

    public async Task<IEnumerable<ReturnResponse>> GetSellerReturnsAsync(int sellerId)
    {
        var returns = (await _uow.ReturnRequests.FindAsync(r => r.SellerId == sellerId))
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        if (!returns.Any())
            return Enumerable.Empty<ReturnResponse>();

        var itemIds = returns.Select(r => r.OrderItemId).Distinct().ToList();
        var items = (await _uow.OrderItems.FindAsync(i => itemIds.Contains(i.Id))).ToDictionary(i => i.Id);

        var productIds = items.Values.Select(i => i.ProductId).Distinct().ToList();
        var products = (await _uow.Products.FindAsync(p => productIds.Contains(p.Id))).ToDictionary(p => p.Id);

        var buyerIds = returns.Select(r => r.BuyerId).Distinct().ToList();
        var buyers = (await _uow.Users.FindAsync(u => buyerIds.Contains(u.Id))).ToDictionary(u => u.Id);

        return returns.Select(r =>
        {
            items.TryGetValue(r.OrderItemId, out var item);
            Product? product = null;
            if (item != null) products.TryGetValue(item.ProductId, out product);
            buyers.TryGetValue(r.BuyerId, out var buyer);
            return MapToResponse(r, item, product, buyer);
        });
    }

    private static ReturnResponse MapToResponse(ReturnRequest ret, OrderItem? item, Product? product, User? buyer)
    {
        return new ReturnResponse
        {
            Id = ret.Id,
            OrderId = ret.OrderId,
            ShipmentId = ret.ShipmentId,
            OrderItemId = ret.OrderItemId,
            ProductId = item?.ProductId ?? 0,
            ProductName = product?.Name ?? "Unknown Product",
            VariantId = item?.VariantId,
            VariantSummary = item?.VariantSummary,
            BuyerId = ret.BuyerId,
            BuyerName = buyer?.Name ?? "Buyer",
            SellerId = ret.SellerId,
            Quantity = ret.Quantity,
            UnitPrice = item?.UnitPrice ?? 0m,
            RefundAmount = ret.RefundAmount,
            Reason = ret.Reason,
            DefectImageUrl = ret.DefectImageUrl,
            Status = ret.Status.ToString(),
            CreatedAt = ret.CreatedAt,
            ResolvedAt = ret.ResolvedAt
        };
    }
}
