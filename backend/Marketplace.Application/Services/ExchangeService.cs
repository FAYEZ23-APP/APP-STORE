using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public class ExchangeService : IExchangeService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ExchangeService> _logger;

    public ExchangeService(IUnitOfWork unitOfWork, ILogger<ExchangeService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ExchangeRequestDto> CreateExchangeAsync(int buyerId, CreateExchangeRequest request)
    {
        var order = await _unitOfWork.Orders.GetByIdAsync(request.OrderId);
        if (order == null)
            throw new NotFoundException($"Order {request.OrderId} not found");

        if (order.BuyerId != buyerId)
            throw new ForbiddenException("You are not authorized to create an exchange for this order");

        var orderItem = await _unitOfWork.OrderItems.GetByIdAsync(request.OrderItemId);
        if (orderItem == null || orderItem.OrderId != request.OrderId)
            throw new NotFoundException($"OrderItem {request.OrderItemId} not found in this order");

        var shipment = await _unitOfWork.Shipments.GetByIdAsync(orderItem.ShipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment for order item {request.OrderItemId} not found");

        var existingPending = await _unitOfWork.ExchangeRequests.FindAsync(e =>
            e.OrderItemId == request.OrderItemId && e.Status == ExchangeStatus.Pending);

        if (existingPending.Any())
            throw new BadRequestException("An active exchange request is already pending for this item");

        var exchange = new ExchangeRequest
        {
            OrderId = request.OrderId,
            OrderItemId = request.OrderItemId,
            BuyerId = buyerId,
            SellerId = shipment.SellerId,
            OriginalVariantId = orderItem.VariantId,
            RequestedVariantId = request.RequestedVariantId,
            RequestedSize = request.RequestedSize,
            RequestedColor = request.RequestedColor,
            Reason = request.Reason,
            Status = ExchangeStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.ExchangeRequests.AddAsync(exchange);

        // Notify seller
        await _unitOfWork.UserNotifications.AddAsync(new UserNotification
        {
            UserId = shipment.SellerId,
            TitleAr = "طلب استبدال منتج جديد",
            TitleEn = "New Exchange Request",
            BodyAr = $"طلب العميل استبدال المنتج في الطلب رقم #{order.Id}. السبب: {request.Reason}",
            BodyEn = $"Buyer requested a product exchange for order #{order.Id}.",
            Type = "ExchangeRequest",
            ReferenceId = exchange.Id.ToString()
        });

        await _unitOfWork.SaveChangesAsync();

        var product = await _unitOfWork.Products.GetByIdAsync(orderItem.ProductId);
        return MapToDto(exchange, product?.NameAr ?? product?.NameEn);
    }

    public async Task<IEnumerable<ExchangeRequestDto>> GetBuyerExchangesAsync(int buyerId)
    {
        var exchanges = await _unitOfWork.ExchangeRequests.FindAsync(e => e.BuyerId == buyerId);
        var list = new List<ExchangeRequestDto>();
        foreach (var ex in exchanges)
        {
            var item = await _unitOfWork.OrderItems.GetByIdAsync(ex.OrderItemId);
            Product? product = null;
            if (item != null)
                product = await _unitOfWork.Products.GetByIdAsync(item.ProductId);

            list.Add(MapToDto(ex, product?.NameAr ?? product?.NameEn));
        }
        return list;
    }

    public async Task<IEnumerable<ExchangeRequestDto>> GetSellerExchangesAsync(int sellerId)
    {
        var exchanges = await _unitOfWork.ExchangeRequests.FindAsync(e => e.SellerId == sellerId);
        var list = new List<ExchangeRequestDto>();
        foreach (var ex in exchanges)
        {
            var item = await _unitOfWork.OrderItems.GetByIdAsync(ex.OrderItemId);
            Product? product = null;
            if (item != null)
                product = await _unitOfWork.Products.GetByIdAsync(item.ProductId);

            list.Add(MapToDto(ex, product?.NameAr ?? product?.NameEn));
        }
        return list;
    }

    public async Task<ExchangeRequestDto> ResolveExchangeAsync(int sellerId, int exchangeId, ResolveExchangeRequest request)
    {
        var exchange = await _unitOfWork.ExchangeRequests.GetByIdAsync(exchangeId);
        if (exchange == null)
            throw new NotFoundException($"Exchange request {exchangeId} not found");

        if (exchange.SellerId != sellerId)
            throw new ForbiddenException("You are not authorized to resolve this exchange request");

        if (exchange.Status != ExchangeStatus.Pending)
            throw new BadRequestException("This exchange request has already been resolved");

        exchange.ResolvedAt = DateTime.UtcNow;

        if (request.Approved)
        {
            exchange.Status = ExchangeStatus.Approved;
            _unitOfWork.ExchangeRequests.Update(exchange);

            await _unitOfWork.UserNotifications.AddAsync(new UserNotification
            {
                UserId = exchange.BuyerId,
                TitleAr = "تمت الموافقة على طلب الاستبدال",
                TitleEn = "Exchange Request Approved",
                BodyAr = $"وافق التاجر على استبدال المنتج في طلبك #{exchange.OrderId}.",
                BodyEn = $"Seller approved your exchange request for order #{exchange.OrderId}.",
                Type = "ExchangeApproved",
                ReferenceId = exchange.Id.ToString()
            });
        }
        else
        {
            exchange.Status = ExchangeStatus.Rejected;
            exchange.RejectionReason = request.RejectionReason;
            _unitOfWork.ExchangeRequests.Update(exchange);

            await _unitOfWork.UserNotifications.AddAsync(new UserNotification
            {
                UserId = exchange.BuyerId,
                TitleAr = "تم رفض طلب الاستبدال",
                TitleEn = "Exchange Request Rejected",
                BodyAr = $"تم رفض طلب الاستبدال: {request.RejectionReason}",
                BodyEn = $"Exchange request rejected: {request.RejectionReason}",
                Type = "ExchangeRejected",
                ReferenceId = exchange.Id.ToString()
            });
        }

        await _unitOfWork.SaveChangesAsync();

        var item = await _unitOfWork.OrderItems.GetByIdAsync(exchange.OrderItemId);
        Product? product = null;
        if (item != null)
            product = await _unitOfWork.Products.GetByIdAsync(item.ProductId);

        return MapToDto(exchange, product?.NameAr ?? product?.NameEn);
    }

    private static ExchangeRequestDto MapToDto(ExchangeRequest ex, string? productName) => new()
    {
        Id = ex.Id,
        OrderId = ex.OrderId,
        OrderItemId = ex.OrderItemId,
        BuyerId = ex.BuyerId,
        SellerId = ex.SellerId,
        OriginalVariantId = ex.OriginalVariantId,
        RequestedVariantId = ex.RequestedVariantId,
        RequestedSize = ex.RequestedSize,
        RequestedColor = ex.RequestedColor,
        Reason = ex.Reason,
        Status = ex.Status.ToString(),
        ReplacementShipmentId = ex.ReplacementShipmentId,
        RejectionReason = ex.RejectionReason,
        CreatedAt = ex.CreatedAt,
        ResolvedAt = ex.ResolvedAt,
        ProductName = productName
    };
}
