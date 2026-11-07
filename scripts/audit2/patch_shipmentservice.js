const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/ShipmentService.cs');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Add RecordCodRefusalAsync helper method at the bottom of ShipmentService class
const helperMethod = `
    private async Task RecordCodRefusalAsync(int orderId, int shipmentId, ReturnReason returnReason)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null) return;

        var buyer = await _uow.Users.GetByIdAsync(order.BuyerId);
        if (buyer != null)
        {
            buyer.CodRefusalCount += 1;
            _uow.Users.Update(buyer);
        }

        var normalizedPhone = Marketplace.Application.Common.EgyptianPhoneNormalizer.Normalize(order.RecipientPhone)
            ?? (buyer != null ? Marketplace.Application.Common.EgyptianPhoneNormalizer.Normalize(buyer.PhoneNumber) : null)
            ?? order.RecipientPhone;

        var existing = await _uow.CodBlacklistEntries.FindAsync(e =>
            e.PhoneNormalized == normalizedPhone || (e.UserId.HasValue && e.UserId == order.BuyerId));

        var entry = existing.FirstOrDefault();
        int maxCodRefusals = _configuration.GetValue<int>("Orders:MaxCodRefusals", 3);

        if (entry == null)
        {
            entry = new Marketplace.Domain.Entities.CodBlacklistEntry
            {
                PhoneNormalized = normalizedPhone,
                UserId = order.BuyerId,
                Reason = $"Refusal on shipment #{shipmentId} (Reason: {returnReason})",
                RefusalCount = buyer?.CodRefusalCount ?? 1,
                CreatedAt = DateTime.UtcNow
            };
            entry.RiskScore = entry.RefusalCount * 35;
            if (entry.RefusalCount >= maxCodRefusals)
            {
                entry.IsBlocked = true;
            }
            await _uow.CodBlacklistEntries.AddAsync(entry);
        }
        else
        {
            entry.RefusalCount = Math.Max(entry.RefusalCount + 1, buyer?.CodRefusalCount ?? 1);
            entry.RiskScore = entry.RefusalCount * 35;
            entry.Reason = $"Refusal on shipment #{shipmentId} (Reason: {returnReason}); Previous: {entry.Reason}";
            if (entry.RefusalCount >= maxCodRefusals)
            {
                entry.IsBlocked = true;
            }
            _uow.CodBlacklistEntries.Update(entry);
        }
    }
`;

if (!content.includes('RecordCodRefusalAsync')) {
    const lastClosingBrace = content.lastIndexOf('}');
    content = content.slice(0, lastClosingBrace) + helperMethod + '\n}\n';
}

// 2. Call RecordCodRefusalAsync in UpdateCarrierShipmentStatusAsync
const carrierRefusalAnchor = `                    await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.Returned);
                    await _uow.SaveChangesAsync();`;

const carrierRefusalCall = `                    if (returnReason == ReturnReason.RefusedByBuyer || string.Equals(request.ReturnReason?.Trim(), "CustomerUnreachable", StringComparison.OrdinalIgnoreCase))
                    {
                        await RecordCodRefusalAsync(shipment.OrderId, shipment.Id, returnReason);
                    }
                    await UpdateParentOrderStatusAsync(shipment.OrderId, shipment.Id, ShipmentStatus.Returned);
                    await _uow.SaveChangesAsync();`;

if (content.includes(carrierRefusalAnchor) && !content.includes('RecordCodRefusalAsync(shipment.OrderId')) {
    content = content.replace(carrierRefusalAnchor, carrierRefusalCall);
}

// 3. Call RecordCodRefusalAsync in AdminUpdateShipmentStatusAsync
const adminRefusalAnchor = `            if (shipment.ReturnReason == ReturnReason.RefusedByBuyer)
            {
                var buyer = await _uow.Users.GetByIdAsync(order.BuyerId);
                if (buyer != null)
                {
                    buyer.CodRefusalCount += 1;
                    _uow.Users.Update(buyer);
                }
            }`;

const adminRefusalCall = `            if (shipment.ReturnReason == ReturnReason.RefusedByBuyer || string.Equals(request.ReturnReason?.Trim(), "CustomerUnreachable", StringComparison.OrdinalIgnoreCase))
            {
                await RecordCodRefusalAsync(order.Id, shipment.Id, shipment.ReturnReason.Value);
            }`;

if (content.includes(adminRefusalAnchor)) {
    content = content.replace(adminRefusalAnchor, adminRefusalCall);
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('ShipmentService.cs successfully patched with RecordCodRefusalAsync.');
