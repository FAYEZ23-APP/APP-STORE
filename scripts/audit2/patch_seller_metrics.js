const fs = require('fs');
const path = require('path');

// 1. IUserService.cs
const iUserPath = path.join(__dirname, '../../backend/Marketplace.Application/Interfaces/IUserService.cs');
let iUser = fs.readFileSync(iUserPath, 'utf8');
if (!iUser.includes('GetSellerPerformanceMetricsAsync')) {
    iUser = iUser.replace('Task<BuyerStatsResponse> GetBuyerStatsAsync(int userId);', 'Task<BuyerStatsResponse> GetBuyerStatsAsync(int userId);\n    Task<SellerPerformanceMetricsDto> GetSellerPerformanceMetricsAsync(int sellerId);');
    fs.writeFileSync(iUserPath, iUser, 'utf8');
    console.log('Patched IUserService.cs');
}

// 2. UserService.cs
const userPath = path.join(__dirname, '../../backend/Marketplace.Application/Services/UserService.cs');
let user = fs.readFileSync(userPath, 'utf8');
if (!user.includes('GetSellerPerformanceMetricsAsync')) {
    const methodImpl = `
    public async Task<SellerPerformanceMetricsDto> GetSellerPerformanceMetricsAsync(int sellerId)
    {
        var shipments = await _unitOfWork.Shipments.FindAsync(s => s.SellerId == sellerId);
        var shipmentList = shipments.ToList();

        var totalOrders = shipmentList.Count;
        var fulfilledOrders = shipmentList.Count(s => s.Status == Marketplace.Domain.Enums.ShipmentStatus.Delivered);
        var cancelledOrders = shipmentList.Count(s => s.Status == Marketplace.Domain.Enums.ShipmentStatus.Cancelled);

        var fulfillmentRate = totalOrders > 0
            ? Math.Round((decimal)fulfilledOrders / totalOrders * 100m, 2)
            : 100m;

        // Average handover hours (from CreatedAt to DeliveredAt or now)
        decimal avgHours = 24.0m;
        var deliveredShipments = shipmentList.Where(s => s.DeliveredAt.HasValue).ToList();
        if (deliveredShipments.Any())
        {
            var totalHours = deliveredShipments.Sum(s => (s.DeliveredAt!.Value - s.CreatedAt).TotalHours);
            avgHours = Math.Round((decimal)(totalHours / deliveredShipments.Count), 1);
        }

        var returns = await _unitOfWork.ReturnRequests.FindAsync(r => r.SellerId == sellerId && r.Status != Marketplace.Domain.Enums.ReturnStatus.Rejected);
        var returnsCount = returns.Count();

        var returnRate = totalOrders > 0
            ? Math.Round((decimal)returnsCount / totalOrders * 100m, 2)
            : 0m;

        // FulfillmentScore: weighted calculation (70% fulfillment - 30% returns)
        var score = Math.Clamp(Math.Round(fulfillmentRate * 0.7m + (100m - returnRate) * 0.3m, 2), 0m, 100m);

        string warningStatus = "Good";
        if (score < 50m) warningStatus = "Critical";
        else if (score < 75m) warningStatus = "Warning";

        return new SellerPerformanceMetricsDto
        {
            SellerId = sellerId,
            TotalOrders = totalOrders,
            FulfilledOrders = fulfilledOrders,
            CancelledOrders = cancelledOrders,
            FulfillmentRate = fulfillmentRate,
            AverageHandoverHours = avgHours,
            ReturnRate = returnRate,
            FulfillmentScore = score,
            WarningStatus = warningStatus
        };
    }
`;
    const lastClosing = user.lastIndexOf('}');
    user = user.slice(0, lastClosing) + methodImpl + '\n' + user.slice(lastClosing);
    fs.writeFileSync(userPath, user, 'utf8');
    console.log('Patched UserService.cs');
}
