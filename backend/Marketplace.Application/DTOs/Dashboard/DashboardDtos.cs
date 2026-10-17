using System;
using System.Collections.Generic;

namespace Marketplace.Application.DTOs.Dashboard;

public class SellerDashboardResponse
{
    public int SellerId { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public string DispatchCity { get; set; } = string.Empty;

    // Financial KPIs
    public decimal TodayRevenue { get; set; }
    public decimal MonthRevenue { get; set; }
    public decimal PendingClearanceAmount { get; set; }
    public int DeliveredOrdersCount { get; set; }
    public int ReturnedShipmentsCount { get; set; }
    public decimal DeliverySuccessRate { get; set; }

    // Action-Required Counters (To-Do Hub)
    public int PendingHandoverCount { get; set; }
    public int LowStockProductsCount { get; set; }
    public int OutOfStockProductsCount { get; set; }

    // Inventory & Top Products Insights
    public List<TopProductInsightDto> TopSellingProducts { get; set; } = new();
    public List<LowStockAlertDto> LowStockAlerts { get; set; } = new();

    // Recent Shipments Feed
    public List<RecentShipmentFeedDto> RecentShipments { get; set; } = new();
}

public class TopProductInsightDto
{
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int UnitsSold { get; set; }
    public decimal Revenue { get; set; }
    public int CurrentStock { get; set; }
    public decimal Price { get; set; }
}

public class LowStockAlertDto
{
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int CurrentStock { get; set; }
    public decimal Price { get; set; }
}

public class RecentShipmentFeedDto
{
    public int ShipmentId { get; set; }
    public int OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public decimal CodAmount { get; set; }
    public string RecipientCity { get; set; } = string.Empty;
    public int ItemsCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class QuickStockUpdateRequest
{
    public int? Stock { get; set; }
    public decimal? Price { get; set; }
}

public class BuyerDashboardResponse
{
    public int BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // Order Status Counters (Shein/Noon Style)
    public int ProcessingCount { get; set; }      // Pending / HandedToCarrier
    public int InTransitCount { get; set; }       // InTransit
    public int ReadyForPickupCount { get; set; }   // ReadyForPickup
    public int DeliveredCount { get; set; }       // Delivered
    public int ReturnedCount { get; set; }        // Returned

    // Active Shipment Live Tracker (Most recent active shipment if any)
    public ActiveShipmentTrackerDto? ActiveShipment { get; set; }

    // Spending & Account Summary
    public decimal TotalSpent { get; set; }
    public int TotalOrdersPlaced { get; set; }
    public int SavedAddressesCount { get; set; }
    public BuyerCodEligibilityDto CodEligibilityStatus { get; set; } = new();
}

public class ActiveShipmentTrackerDto
{
    public int ShipmentId { get; set; }
    public int OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int CurrentStep { get; set; } // 1: Processing, 2: HandedToCarrier, 3: InTransit, 4: ReadyForPickup, 5: Delivered
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public string CarrierName { get; set; } = "Bosta Express";
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal CodAmount { get; set; }
    public string DeliveryMethod { get; set; } = string.Empty;
    public string RecipientCity { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<ActiveShipmentItemDto> Items { get; set; } = new();
}

public class ActiveShipmentItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}

public class BuyerCodEligibilityDto
{
    public bool IsCodBlocked { get; set; }
    public int RefusedDeliveriesCount { get; set; }
    public int MaxRefusalTolerance { get; set; }
    public int RemainingTolerance { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
}
