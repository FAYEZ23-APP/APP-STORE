const fs = require('fs');
const path = require('path');

const shipServicePath = path.join(__dirname, '../../backend/Marketplace.Application/Services/ShipmentService.cs');
let content = fs.readFileSync(shipServicePath, 'utf8');

content = content.replace(/_unitOfWork\./g, '_uow.');
content = content.replace(/MapToSellerShipmentResponse\(/g, 'MapSellerShipment(');

fs.writeFileSync(shipServicePath, content, 'utf8');
console.log('Fixed _uow and MapSellerShipment in ShipmentService.cs');
