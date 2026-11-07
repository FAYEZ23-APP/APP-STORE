const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../../backend/Marketplace.API/Controllers/OrdersController.cs');
let c = fs.readFileSync(p, 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

const target = `    public async Task<ActionResult<ConfirmOrderResponse>> ConfirmOrder(int id)
    {
        var userId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");
        var result = await _orderService.ConfirmOrderAsync(userId, isAdmin, id);
        return Ok(result);
    }`;

const repl = `    public async Task<ActionResult<ConfirmOrderResponse>> ConfirmOrder(int id, [FromBody] ConfirmOrderRequest? request = null)
    {
        var userId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");
        var result = await _orderService.ConfirmOrderAsync(userId, isAdmin, id, request?.Channel);
        return Ok(result);
    }`;

if (!c.includes(target)) {
    throw new Error('Target not found in OrdersController.cs');
}

c = c.replace(target, repl);
if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync(p, c, 'utf8');
console.log('OrdersController.cs patched successfully!');
