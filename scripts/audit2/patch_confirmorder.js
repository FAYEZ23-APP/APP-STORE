const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../../backend/Marketplace.Application/Services/OrderService.cs');
let c = fs.readFileSync(p, 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

const target = `    public async Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException("Order not found.");

        if (!isAdmin && order.BuyerId != userId)
            throw new UnauthorizedAccessException("You are not authorized to confirm this order.");

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

const repl = `    public async Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId, string? channel = null)
    {
        var order = await _uow.Orders.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException("Order not found.");

        if (!isAdmin && order.BuyerId != userId)
            throw new UnauthorizedAccessException("You are not authorized to confirm this order.");

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
        if (!string.IsNullOrWhiteSpace(channel))
        {
            order.ConfirmationChannel = channel.Trim();
        }
        else if (isAdmin)
        {
            order.ConfirmationChannel = "Admin";
        }
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

if (!c.includes(target)) {
    throw new Error('Target ConfirmOrderAsync not found in OrderService.cs');
}

c = c.replace(target, repl);
if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync(p, c, 'utf8');
console.log('Successfully patched ConfirmOrderAsync in OrderService.cs!');
