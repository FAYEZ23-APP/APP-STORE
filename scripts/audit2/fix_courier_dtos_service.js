const fs = require('fs');

// 1. Fix ShipmentDtos.cs
let shipmentDtos = fs.readFileSync('backend/Marketplace.Application/DTOs/Shipments/ShipmentDtos.cs', 'utf8');

// Add courier fields to SellerShipmentResponse if not present
const sellerTarget = '    public bool AllowInspection { get; set; } = true;';
const sellerReplace = `    public bool AllowInspection { get; set; } = true;
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
    public string? PickupPointCode { get; set; }`;

// Ensure it's in SellerShipmentResponse
const sellerPos = shipmentDtos.indexOf('public class SellerShipmentResponse');
const carrierPos = shipmentDtos.indexOf('public class CarrierShippingLabelResponse');
if (sellerPos !== -1 && carrierPos !== -1) {
    let sellerSection = shipmentDtos.slice(sellerPos, carrierPos);
    if (!sellerSection.includes('CourierName')) {
        sellerSection = sellerSection.replace(sellerTarget, sellerReplace);
        shipmentDtos = shipmentDtos.slice(0, sellerPos) + sellerSection + shipmentDtos.slice(carrierPos);
        console.log('Added courier fields to SellerShipmentResponse');
    }
}

// Add courier fields to AdminShipmentDetailResponse if not present
const adminPos = shipmentDtos.indexOf('public class AdminShipmentDetailResponse');
const adminPagedPos = shipmentDtos.indexOf('public class AdminShipmentPagedResponse');
if (adminPos !== -1 && adminPagedPos !== -1) {
    let adminSection = shipmentDtos.slice(adminPos, adminPagedPos);
    if (!adminSection.includes('CourierName')) {
        adminSection = adminSection.replace(
            '    public DateTime? DeliveredAt { get; set; }',
            `    public DateTime? DeliveredAt { get; set; }
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
    public string? PickupPointCode { get; set; }`
        );
        shipmentDtos = shipmentDtos.slice(0, adminPos) + adminSection + shipmentDtos.slice(adminPagedPos);
        console.log('Added courier fields to AdminShipmentDetailResponse');
    }
}

fs.writeFileSync('backend/Marketplace.Application/DTOs/Shipments/ShipmentDtos.cs', shipmentDtos, 'utf8');

// 2. Fix ShipmentService.cs
let shipmentService = fs.readFileSync('backend/Marketplace.Application/Services/ShipmentService.cs', 'utf8');

// Remove wrongly inserted courier fields in MapCarrierShippingLabel
const wrongInCarrier = `            AllowInspection = shipment.AllowInspection,
            CourierName = shipment.CourierName,
            CourierPhone = shipment.CourierPhone,
            EstimatedDeliveryAt = shipment.EstimatedDeliveryAt,
            PickupPointCode = shipment.PickupPointCode,
            ItemsCount = itemResponses.Sum(i => i.Quantity),`;

const fixedInCarrier = `            AllowInspection = shipment.AllowInspection,
            ItemsCount = itemResponses.Sum(i => i.Quantity),`;

if (shipmentService.includes(wrongInCarrier)) {
    shipmentService = shipmentService.replace(wrongInCarrier, fixedInCarrier);
    console.log('Removed courier fields from MapCarrierShippingLabel in ShipmentService.cs');
}

// Fix OrderItem SellerId in UpdateCourierDetailsAsync
const wrongQuery = 'var items = _uow.OrderItems.Query().Where(i => i.OrderId == shipment.OrderId && i.SellerId == shipment.SellerId).ToList();';
const fixedQuery = 'var items = _uow.OrderItems.Query().Where(i => i.OrderId == shipment.OrderId).ToList();';

if (shipmentService.includes(wrongQuery)) {
    shipmentService = shipmentService.replace(wrongQuery, fixedQuery);
    console.log('Fixed OrderItems query in UpdateCourierDetailsAsync in ShipmentService.cs');
}

fs.writeFileSync('backend/Marketplace.Application/Services/ShipmentService.cs', shipmentService, 'utf8');
