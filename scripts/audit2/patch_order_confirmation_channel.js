const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../../backend/Marketplace.Application/Services/OrderService.cs');
let c = fs.readFileSync(p, 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

// 1. In ConfirmOrderAsync
const targetConfirm = `        if (order.IsBuyerConfirmed)
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
        };`;

const replConfirm = `        if (order.IsBuyerConfirmed)
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
        order.ConfirmationChannel = !string.IsNullOrWhiteSpace(channel) ? channel.Trim() : (isAdmin ? "Admin" : "App");
        _uow.Orders.Update(order);
        await _uow.SaveChangesAsync();

        return new ConfirmOrderResponse
        {
            OrderId = order.Id,
            IsBuyerConfirmed = true,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,
            Message = "Order confirmed successfully."
        };`;

if (!c.includes(targetConfirm)) {
    throw new Error('targetConfirm not found in OrderService.cs');
}
c = c.replace(targetConfirm, replConfirm);

// 2. In MapOrderToResponse
const targetMap = `            IsBuyerConfirmed = order.IsBuyerConfirmed,
            ConfirmedAt = order.ConfirmedAt,`;

const replMap = `            IsBuyerConfirmed = order.IsBuyerConfirmed,
            ConfirmedAt = order.ConfirmedAt,
            ConfirmationChannel = order.ConfirmationChannel,`;

if (!c.includes(targetMap)) {
    throw new Error('targetMap not found in OrderService.cs');
}
c = c.replace(targetMap, replMap);

// 3. In GetSellerOrdersAsync
const targetSeller = `                Landmark = null,
                IsBuyerConfirmed = order.IsBuyerConfirmed`;

const replSeller = `                Landmark = null,
                IsBuyerConfirmed = order.IsBuyerConfirmed,
                ConfirmationChannel = order.ConfirmationChannel`;

if (!c.includes(targetSeller)) {
    throw new Error('targetSeller not found in OrderService.cs');
}
c = c.replace(targetSeller, replSeller);

if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync(p, c, 'utf8');
console.log('OrderService.cs successfully patched with ConfirmationChannel mapping!');
