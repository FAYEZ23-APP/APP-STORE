const fs = require('fs');

// 1. Add PudoPointDto to DeliveryDtos.cs
let deliveryDtos = fs.readFileSync('backend/Marketplace.Application/DTOs/Delivery/DeliveryDtos.cs', 'utf8');
if (!deliveryDtos.includes('public class PudoPointDto')) {
    const pudoDto = `
public class PudoPointDto
{
    public string Id { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string WorkHours { get; set; } = string.Empty;
    public string Type { get; set; } = "SmartLocker";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? DistanceKm { get; set; }
    public decimal DiscountAmount { get; set; } = 15.00m;
}
`;
    deliveryDtos = deliveryDtos.replace('public class PickupPointDto', pudoDto + '\r\npublic class PickupPointDto');
    fs.writeFileSync('backend/Marketplace.Application/DTOs/Delivery/DeliveryDtos.cs', deliveryDtos, 'utf8');
    console.log('1. PudoPointDto added to DeliveryDtos.cs');
}

// 2. Add GetPudoPointsAsync to IDeliveryProvider.cs
let idelivery = fs.readFileSync('backend/Marketplace.Application/Interfaces/IDeliveryProvider.cs', 'utf8');
if (!idelivery.includes('GetPudoPointsAsync')) {
    idelivery = idelivery.replace(
        'Task<IReadOnlyList<PickupPointDto>> GetPickupPointsAsync(string? city = null);',
        'Task<IReadOnlyList<PickupPointDto>> GetPickupPointsAsync(string? city = null);\r\n    Task<IReadOnlyList<PudoPointDto>> GetPudoPointsAsync(string? city = null, double? lat = null, double? lng = null);'
    );
    fs.writeFileSync('backend/Marketplace.Application/Interfaces/IDeliveryProvider.cs', idelivery, 'utf8');
    console.log('2. GetPudoPointsAsync added to IDeliveryProvider.cs');
}

// 3. Add UpdateCourierDetailsAsync to IShipmentService.cs
let ishipment = fs.readFileSync('backend/Marketplace.Application/Interfaces/IShipmentService.cs', 'utf8');
if (!ishipment.includes('UpdateCourierDetailsAsync')) {
    ishipment = ishipment.replace(
        'Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole);',
        'Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole);\r\n    Task<AdminShipmentDetailResponse> UpdateCourierDetailsAsync(int shipmentId, UpdateCourierDetailsRequest request);'
    );
    fs.writeFileSync('backend/Marketplace.Application/Interfaces/IShipmentService.cs', ishipment, 'utf8');
    console.log('3. UpdateCourierDetailsAsync added to IShipmentService.cs');
}

// 4. Update AdminShipmentDetailResponse in ShipmentDtos.cs
let shipmentDtos = fs.readFileSync('backend/Marketplace.Application/DTOs/Shipments/ShipmentDtos.cs', 'utf8');
if (!shipmentDtos.includes('public string? CourierName { get; set; }') || !shipmentDtos.includes('AdminShipmentDetailResponse')) {
    // Check if AdminShipmentDetailResponse has courier fields
    const adminTarget = '    public string? Landmark { get; set; };';
    if (!shipmentDtos.includes('    public string? CourierName { get; set; }') || shipmentDtos.indexOf('CourierName') < shipmentDtos.indexOf('AdminShipmentDetailResponse')) {
        const adminSearch = '    public DateTime? DeliveredAt { get; set; };';
        const adminSearchReal = '    public DateTime? DeliveredAt { get; set; }';
        if (shipmentDtos.includes(adminSearchReal) && !shipmentDtos.slice(shipmentDtos.indexOf('AdminShipmentDetailResponse')).includes('CourierName')) {
            shipmentDtos = shipmentDtos.replace(
                adminSearchReal,
                `${adminSearchReal}\r\n    public string? CourierName { get; set; }\r\n    public string? CourierPhone { get; set; }\r\n    public DateTime? EstimatedDeliveryAt { get; set; }\r\n    public string? PickupPointCode { get; set; }`
            );
            fs.writeFileSync('backend/Marketplace.Application/DTOs/Shipments/ShipmentDtos.cs', shipmentDtos, 'utf8');
            console.log('4. Courier fields added to AdminShipmentDetailResponse');
        }
    }
}
