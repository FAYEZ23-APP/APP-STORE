const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/OrderService.cs');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Add CodBlacklist check in CreateOrderAsync if not already present
if (!content.includes('CodBlacklistEntries.FindAsync')) {
    const refusalBlockAnchor = `            int refusedCount = buyerShipments.Count();
            if (refusedCount >= maxCodRefusals)
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }`;

    const refusalBlockWithBlacklist = `            int refusedCount = buyerShipments.Count();
            if (refusedCount >= maxCodRefusals)
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }

            var blacklistEntries = await _uow.CodBlacklistEntries.FindAsync(e =>
                e.PhoneNormalized == normalizedPhone || (e.UserId.HasValue && e.UserId == buyerId));

            if (blacklistEntries.Any(e => e.IsBlocked || e.RefusalCount >= maxCodRefusals))
            {
                throw new BadRequestException("تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.");
            }`;

    if (content.includes(refusalBlockAnchor)) {
        content = content.replace(refusalBlockAnchor, refusalBlockWithBlacklist);
    }
}

// 2. Add UserAddress lookup fallback in CreateOrderAsync if not already present
if (!content.includes('UserAddress? selectedAddress = null;')) {
    const addressAnchor = `        string destinationGovernorate;
        string destinationCity;
        string destinationArea;
        string destinationStreetBuilding;
        string? addressLine;
        string? pickupPointId = null;`;

    const addressWithFallback = `        UserAddress? selectedAddress = null;
        if (request.AddressId.HasValue)
        {
            var matching = await _uow.UserAddresses.FindAsync(a => a.Id == request.AddressId.Value && a.UserId == buyerId);
            selectedAddress = matching.FirstOrDefault();
        }
        if (selectedAddress == null && string.IsNullOrWhiteSpace(request.BuildingNumber) && string.IsNullOrWhiteSpace(request.StreetBuilding))
        {
            var defaults = await _uow.UserAddresses.FindAsync(a => a.UserId == buyerId && a.IsDefault);
            selectedAddress = defaults.FirstOrDefault();
        }

        string? buildingNumber = !string.IsNullOrWhiteSpace(request.BuildingNumber) ? request.BuildingNumber.Trim() : selectedAddress?.BuildingNumber;
        string? floor = !string.IsNullOrWhiteSpace(request.Floor) ? request.Floor.Trim() : selectedAddress?.Floor;
        string? apartment = !string.IsNullOrWhiteSpace(request.Apartment) ? request.Apartment.Trim() : selectedAddress?.Apartment;
        string? landmark = !string.IsNullOrWhiteSpace(request.Landmark) ? request.Landmark.Trim() : selectedAddress?.Landmark;

        string destinationGovernorate;
        string destinationCity;
        string destinationArea;
        string destinationStreetBuilding;
        string? addressLine;
        string? pickupPointId = null;`;

    if (content.includes(addressAnchor)) {
        content = content.replace(addressAnchor, addressWithFallback);
    }

    content = content.replaceAll(`BuildingNumber = request.BuildingNumber?.Trim(),`, `BuildingNumber = buildingNumber,`);
    content = content.replaceAll(`Floor = request.Floor?.Trim(),`, `Floor = floor,`);
    content = content.replaceAll(`Apartment = request.Apartment?.Trim(),`, `Apartment = apartment,`);
    content = content.replaceAll(`Landmark = request.Landmark?.Trim(),`, `Landmark = landmark,`);

    const coordAnchor = `        double? destLat = request.DeliveryLatitude ?? request.Latitude;
        double? destLng = request.DeliveryLongitude ?? request.Longitude;`;
    const coordWithFallback = `        double? destLat = request.DeliveryLatitude ?? request.Latitude ?? (selectedAddress != null && selectedAddress.Latitude != 0 ? selectedAddress.Latitude : null);
        double? destLng = request.DeliveryLongitude ?? request.Longitude ?? (selectedAddress != null && selectedAddress.Longitude != 0 ? selectedAddress.Longitude : null);`;

    if (content.includes(coordAnchor)) {
        content = content.replace(coordAnchor, coordWithFallback);
    }

    const streetBuildingAnchor = `            destinationStreetBuilding = string.IsNullOrWhiteSpace(request.StreetBuilding)
                ? (request.AddressLine?.Trim() ?? string.Empty)
                : request.StreetBuilding.Trim();`;
    const streetBuildingWithFallback = `            destinationStreetBuilding = string.IsNullOrWhiteSpace(request.StreetBuilding)
                ? (request.AddressLine?.Trim() ?? selectedAddress?.StreetBuilding ?? string.Empty)
                : request.StreetBuilding.Trim();`;

    if (content.includes(streetBuildingAnchor)) {
        content = content.replace(streetBuildingAnchor, streetBuildingWithFallback);
    }
}

// 3. Update ConfirmOrderAsync
const confirmAnchor = `    public async Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId, string? channel = null)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException("Order not found.");

        if (!isAdmin && order.BuyerId != userId)
            throw new ForbiddenException("You are not authorized to confirm this order.");

        if (order.IsBuyerConfirmed)
        {
            return new ConfirmOrderResponse
            {
                OrderId = order.Id,
                IsBuyerConfirmed = true,
                ConfirmedAt = order.ConfirmedAt,
                Message = "Order is already confirmed."
            };
        }

        order.IsBuyerConfirmed = true;
        order.ConfirmedAt = DateTime.UtcNow;
        _uow.Orders.Update(order);
        await _uow.SaveChangesAsync();

        return new ConfirmOrderResponse
        {
            OrderId = order.Id,
            IsBuyerConfirmed = true,
            ConfirmedAt = order.ConfirmedAt,
            Message = "Order confirmed successfully."
        };
    }`;

const confirmUpdated = `    public async Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId, string? channel = null)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new NotFoundException("Order not found.");

        if (!isAdmin && order.BuyerId != userId)
            throw new ForbiddenException("You are not authorized to confirm this order.");

        if (order.IsBuyerConfirmed)
        {
            return new ConfirmOrderResponse
            {
                OrderId = order.Id,
                IsBuyerConfirmed = true,
                ConfirmedAt = order.ConfirmedAt,
                ConfirmationChannel = order.ConfirmationChannel,
                Message = "Order is already confirmed."
            };
        }

        order.IsBuyerConfirmed = true;
        order.ConfirmedAt = DateTime.UtcNow;
        order.ConfirmationChannel = !string.IsNullOrWhiteSpace(channel)
            ? channel.Trim()
            : (isAdmin ? "Admin" : "App");

        _uow.Orders.Update(order);
        await _uow.SaveChangesAsync();

        return new ConfirmOrderResponse
        {
            OrderId = order.Id,
            IsBuyerConfirmed = true,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,
            Message = "Order confirmed successfully."
        };
    }`;

if (content.includes(confirmAnchor)) {
    content = content.replace(confirmAnchor, confirmUpdated);
}

// 4. Update MapOrderToResponse to populate ConfirmationChannel
const mapOrderAnchor = `            IsBuyerConfirmed = order.IsBuyerConfirmed,
            ConfirmedAt = order.ConfirmedAt,`;
const mapOrderUpdated = `            IsBuyerConfirmed = order.IsBuyerConfirmed,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,`;
if (content.includes(mapOrderAnchor)) {
    content = content.replace(mapOrderAnchor, mapOrderUpdated);
}

// 5. Update SellerOrderResponse in GetSellerOrdersAsync
const sellerOrderAnchor = `                Landmark = order.Landmark,
                IsBuyerConfirmed = order.IsBuyerConfirmed`;
const sellerOrderUpdated = `                Landmark = order.Landmark,
                IsBuyerConfirmed = order.IsBuyerConfirmed,
                ConfirmationChannel = order.ConfirmationChannel`;
if (content.includes(sellerOrderAnchor)) {
    content = content.replace(sellerOrderAnchor, sellerOrderUpdated);
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('OrderService.cs successfully patched with all features.');
