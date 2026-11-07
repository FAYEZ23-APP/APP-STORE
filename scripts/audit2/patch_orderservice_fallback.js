const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/OrderService.cs');
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Before "string destinationGovernorate;" in CreateOrderAsync
const targetAddressLookup = `        string destinationGovernorate;
        string destinationCity;
        string destinationArea;
        string destinationStreetBuilding;
        string? addressLine;
        string? pickupPointId = null;`;

const replacementAddressLookup = `        UserAddress? selectedAddress = null;
        if (request.AddressId.HasValue && request.AddressId.Value > 0)
        {
            var addr = await _uow.UserAddresses.GetByIdAsync(request.AddressId.Value);
            if (addr != null && addr.UserId == buyerId)
            {
                selectedAddress = addr;
            }
        }
        else
        {
            var defaultAddrs = await _uow.UserAddresses.FindAsync(a => a.UserId == buyerId && a.IsDefault);
            selectedAddress = defaultAddrs.FirstOrDefault();
        }

        string? buildingNumber = !string.IsNullOrWhiteSpace(request.BuildingNumber)
            ? request.BuildingNumber.Trim()
            : selectedAddress?.BuildingNumber?.Trim();

        string? floor = !string.IsNullOrWhiteSpace(request.Floor)
            ? request.Floor.Trim()
            : selectedAddress?.Floor?.Trim();

        string? apartment = !string.IsNullOrWhiteSpace(request.Apartment)
            ? request.Apartment.Trim()
            : selectedAddress?.Apartment?.Trim();

        string? landmark = !string.IsNullOrWhiteSpace(request.Landmark)
            ? request.Landmark.Trim()
            : selectedAddress?.Landmark?.Trim();

        string destinationGovernorate;
        string destinationCity;
        string destinationArea;
        string destinationStreetBuilding;
        string? addressLine;
        string? pickupPointId = null;`;

if (!content.includes(targetAddressLookup)) {
    throw new Error('targetAddressLookup not found');
}
content = content.replace(targetAddressLookup, replacementAddressLookup);

// 2. Adjust destLat / destLng fallback to check selectedAddress
const targetDestCoords = `        double? destLat = request.DeliveryLatitude ?? request.Latitude;
        double? destLng = request.DeliveryLongitude ?? request.Longitude;`;

const replacementDestCoords = `        double? destLat = request.DeliveryLatitude ?? request.Latitude;
        if ((!destLat.HasValue || destLat.Value == 0) && selectedAddress != null && selectedAddress.Latitude != 0)
        {
            destLat = selectedAddress.Latitude;
        }

        double? destLng = request.DeliveryLongitude ?? request.Longitude;
        if ((!destLng.HasValue || destLng.Value == 0) && selectedAddress != null && selectedAddress.Longitude != 0)
        {
            destLng = selectedAddress.Longitude;
        }`;

if (!content.includes(targetDestCoords)) {
    throw new Error('targetDestCoords not found');
}
content = content.replace(targetDestCoords, replacementDestCoords);

// 3. In Order initialization:
const targetOrderInit = `                BuildingNumber = request.BuildingNumber?.Trim(),
                Floor = request.Floor?.Trim(),
                Apartment = request.Apartment?.Trim(),
                Landmark = request.Landmark?.Trim(),`;

const replacementOrderInit = `                BuildingNumber = buildingNumber,
                Floor = floor,
                Apartment = apartment,
                Landmark = landmark,`;

if (!content.includes(targetOrderInit)) {
    throw new Error('targetOrderInit not found');
}
content = content.replace(targetOrderInit, replacementOrderInit);

// 4. In Shipment initialization:
const targetShipmentInit = `                    BuildingNumber = request.BuildingNumber?.Trim(),
                    Floor = request.Floor?.Trim(),
                    Apartment = request.Apartment?.Trim(),
                    Landmark = request.Landmark?.Trim(),`;

const replacementShipmentInit = `                    BuildingNumber = buildingNumber,
                    Floor = floor,
                    Apartment = apartment,
                    Landmark = landmark,`;

if (!content.includes(targetShipmentInit)) {
    throw new Error('targetShipmentInit not found');
}
content = content.replace(targetShipmentInit, replacementShipmentInit);

if (isCrlf) {
    content = content.replace(/\n/g, '\r\n');
}
fs.writeFileSync(filePath, content, 'utf8');
console.log('OrderService.cs successfully patched with selectedAddress fallback!');
