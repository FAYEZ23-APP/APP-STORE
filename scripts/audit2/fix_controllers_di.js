const fs = require('fs');

// 1. Fix WebhooksController.cs
let whContent = fs.readFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', 'utf8');
const isCrlfWh = whContent.includes('\r\n');
const nlWh = isCrlfWh ? '\r\n' : '\n';

whContent = whContent.replace(
    `        IConfiguration configuration,${nlWh}        ILogger<WebhooksController> logger)`,
    `        IPaymentGatewayProvider paymentGateway,${nlWh}        IConfiguration configuration,${nlWh}        ILogger<WebhooksController> logger)`
);
whContent = whContent.replace(
    `        _configuration = configuration;${nlWh}        _logger = logger;${nlWh}    }`,
    `        _paymentGateway = paymentGateway;${nlWh}        _configuration = configuration;${nlWh}        _logger = logger;${nlWh}    }`
);
fs.writeFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', whContent, 'utf8');
console.log('Fixed WebhooksController.cs constructor');

// 2. Fix AdminController.cs
let admContent = fs.readFileSync('backend/Marketplace.API/Controllers/AdminController.cs', 'utf8');
const isCrlfAdm = admContent.includes('\r\n');
const nlAdm = isCrlfAdm ? '\r\n' : '\n';

admContent = admContent.replace(
    `        IStepUpAuthService stepUpAuth,${nlAdm}        IFulfillmentSlaService slaService)`,
    `        IStepUpAuthService stepUpAuth,${nlAdm}        IFulfillmentSlaService slaService,${nlAdm}        IEtaInvoiceService etaInvoiceService)`
);
admContent = admContent.replace(
    `        _slaService = slaService;${nlAdm}    }`,
    `        _slaService = slaService;${nlAdm}        _etaInvoiceService = etaInvoiceService;${nlAdm}    }`
);
fs.writeFileSync('backend/Marketplace.API/Controllers/AdminController.cs', admContent, 'utf8');
console.log('Fixed AdminController.cs constructor');
