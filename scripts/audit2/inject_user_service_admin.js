const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers/AdminController.cs');
let content = fs.readFileSync(p, 'utf8');

const target1 = '    private readonly IShipmentService _shipmentService;\n    private readonly IStepUpAuthService _stepUpAuth;';
const target1r = '    private readonly IShipmentService _shipmentService;\r\n    private readonly IStepUpAuthService _stepUpAuth;';

if (content.includes(target1r)) {
  content = content.replace(target1r, '    private readonly IShipmentService _shipmentService;\r\n    private readonly IUserService _userService;\r\n    private readonly IStepUpAuthService _stepUpAuth;');
} else if (content.includes(target1)) {
  content = content.replace(target1, '    private readonly IShipmentService _shipmentService;\n    private readonly IUserService _userService;\n    private readonly IStepUpAuthService _stepUpAuth;');
}

const target2 = '        IShipmentService shipmentService,\n        IStepUpAuthService stepUpAuth)';
const target2r = '        IShipmentService shipmentService,\r\n        IStepUpAuthService stepUpAuth)';

if (content.includes(target2r)) {
  content = content.replace(target2r, '        IShipmentService shipmentService,\r\n        IUserService userService,\r\n        IStepUpAuthService stepUpAuth)');
} else if (content.includes(target2)) {
  content = content.replace(target2, '        IShipmentService shipmentService,\n        IUserService userService,\n        IStepUpAuthService stepUpAuth)');
}

const target3 = '        _shipmentService = shipmentService;\n        _stepUpAuth = stepUpAuth;';
const target3r = '        _shipmentService = shipmentService;\r\n        _stepUpAuth = stepUpAuth;';

if (content.includes(target3r)) {
  content = content.replace(target3r, '        _shipmentService = shipmentService;\r\n        _userService = userService;\r\n        _stepUpAuth = stepUpAuth;');
} else if (content.includes(target3)) {
  content = content.replace(target3, '        _shipmentService = shipmentService;\n        _userService = userService;\n        _stepUpAuth = stepUpAuth;');
}

fs.writeFileSync(p, content, 'utf8');
console.log('✓ Injected IUserService in AdminController.cs');
