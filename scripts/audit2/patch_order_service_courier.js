const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.Application/Services/OrderService.cs', 'utf8');

const target = '                AllowInspection = s.AllowInspection,';
const replace = `                AllowInspection = s.AllowInspection,
                CourierName = s.CourierName,
                CourierPhone = s.CourierPhone,
                EstimatedDeliveryAt = s.EstimatedDeliveryAt,
                PickupPointCode = s.PickupPointCode,`;

if (content.includes(target)) {
    content = content.replace(target, replace);
    fs.writeFileSync('backend/Marketplace.Application/Services/OrderService.cs', content, 'utf8');
    console.log('OrderService.cs updated with courier fields mapping.');
} else {
    console.error('target not found in OrderService.cs');
    process.exit(1);
}
