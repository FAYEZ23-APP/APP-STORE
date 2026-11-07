const fs = require('fs');

// 1. Update ShipmentService.cs
let shipmentService = fs.readFileSync('backend/Marketplace.Application/Services/ShipmentService.cs', 'utf8');

// In MapBuyerShipment:
const buyerTarget = '            AllowInspection = shipment.AllowInspection,';
const buyerReplace = `            AllowInspection = shipment.AllowInspection,
            CourierName = shipment.CourierName,
            CourierPhone = shipment.CourierPhone,
            EstimatedDeliveryAt = shipment.EstimatedDeliveryAt,
            PickupPointCode = shipment.PickupPointCode,`;

if (shipmentService.includes(buyerTarget)) {
    shipmentService = shipmentService.replace(buyerTarget, buyerReplace);
}

// In MapSellerShipment:
const sellerTarget = '            AllowInspection = shipment.AllowInspection,';
// MapSellerShipment also has AllowInspection
if (shipmentService.includes(buyerReplace)) {
    // Find second occurrence of AllowInspection
    const idx = shipmentService.indexOf(buyerReplace);
    const secondPart = shipmentService.slice(idx + buyerReplace.length);
    if (secondPart.includes(buyerTarget)) {
        shipmentService = shipmentService.slice(0, idx + buyerReplace.length) + secondPart.replace(buyerTarget, buyerReplace);
    }
}

// In AdminShipmentDetailResponse mapping:
const adminTarget = '            DeliveredAt = s.DeliveredAt,';
const adminReplace = `            DeliveredAt = s.DeliveredAt,
            CourierName = s.CourierName,
            CourierPhone = s.CourierPhone,
            EstimatedDeliveryAt = s.EstimatedDeliveryAt,
            PickupPointCode = s.PickupPointCode,`;

if (shipmentService.includes(adminTarget)) {
    shipmentService = shipmentService.replace(adminTarget, adminReplace);
}

// Add UpdateCourierDetailsAsync implementation
const updateCourierMethod = `
    public async Task<AdminShipmentDetailResponse> UpdateCourierDetailsAsync(int shipmentId, UpdateCourierDetailsRequest request)
    {
        var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
        if (shipment == null)
            throw new NotFoundException($"Shipment with ID {shipmentId} not found.");

        shipment.CourierName = request.CourierName?.Trim();
        shipment.CourierPhone = request.CourierPhone?.Trim();
        shipment.EstimatedDeliveryAt = request.EstimatedDeliveryAt;

        await _uow.SaveChangesAsync();

        var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
        var seller = await _uow.Users.GetByIdAsync(shipment.SellerId);
        var buyer = order != null ? await _uow.Users.GetByIdAsync(order.BuyerId) : null;
        var items = _uow.OrderItems.Query().Where(i => i.OrderId == shipment.OrderId && i.SellerId == shipment.SellerId).ToList();
        var pIds = items.Select(i => i.ProductId).Distinct().ToList();
        var products = _uow.Products.Query().Where(p => pIds.Contains(p.Id)).ToDictionary(p => p.Id);

        return MapAdminShipmentDetail(shipment, order, seller, buyer, items, products);
    }
`;

if (!shipmentService.includes('UpdateCourierDetailsAsync')) {
    shipmentService = shipmentService.trimEnd();
    if (shipmentService.endsWith('}')) {
        shipmentService = shipmentService.slice(0, -1) + updateCourierMethod + '\r\n}\r\n';
    }
}

fs.writeFileSync('backend/Marketplace.Application/Services/ShipmentService.cs', shipmentService, 'utf8');
console.log('ShipmentService.cs updated with courier fields and UpdateCourierDetailsAsync.');

// 2. Update AdminController.cs
let adminController = fs.readFileSync('backend/Marketplace.API/Controllers/AdminController.cs', 'utf8');
const adminCourierEndpoint = `
    /// <summary>Assign or update courier contact and estimated delivery time for a shipment.</summary>
    [HttpPut("shipments/{id:int}/courier")]
    [ProducesResponseType(typeof(AdminShipmentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminShipmentDetailResponse>> UpdateCourierDetails(int id, [FromBody] UpdateCourierDetailsRequest request)
    {
        var result = await _shipmentService.UpdateCourierDetailsAsync(id, request);
        return Ok(result);
    }
`;

if (!adminController.includes('shipments/{id:int}/courier')) {
    adminController = adminController.trimEnd();
    if (adminController.endsWith('}')) {
        adminController = adminController.slice(0, -1) + adminCourierEndpoint + '\r\n}\r\n';
        fs.writeFileSync('backend/Marketplace.API/Controllers/AdminController.cs', adminController, 'utf8');
        console.log('AdminController.cs updated with UpdateCourierDetails endpoint.');
    }
}
