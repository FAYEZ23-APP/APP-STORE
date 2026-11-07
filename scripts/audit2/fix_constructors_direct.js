const fs = require('fs');

// 1. WebhooksController.cs
let whLines = fs.readFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', 'utf8').split(/\r?\n/);
let startIdx = whLines.findIndex(l => l.includes('public WebhooksController('));
let endIdx = whLines.findIndex((l, idx) => idx > startIdx && l.trim() === '}');

const newWhConstructor = [
    '    public WebhooksController(',
    '        IWebhookSecurityService webhookSecurity,',
    '        IShipmentService shipmentService,',
    '        ISsrfProtectionService ssrfService,',
    '        IUnitOfWork uow,',
    '        IPaymentGatewayProvider paymentGateway,',
    '        IConfiguration configuration,',
    '        ILogger<WebhooksController> logger)',
    '    {',
    '        _webhookSecurity = webhookSecurity;',
    '        _shipmentService = shipmentService;',
    '        _ssrfService = ssrfService;',
    '        _uow = uow;',
    '        _paymentGateway = paymentGateway;',
    '        _configuration = configuration;',
    '        _logger = logger;',
    '    }'
];

whLines.splice(startIdx, endIdx - startIdx + 1, ...newWhConstructor);
fs.writeFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', whLines.join('\r\n'), 'utf8');
console.log('Replaced WebhooksController constructor');

// 2. AdminController.cs
let admLines = fs.readFileSync('backend/Marketplace.API/Controllers/AdminController.cs', 'utf8').split(/\r?\n/);
let admStartIdx = admLines.findIndex(l => l.includes('public AdminController('));
let admEndIdx = admLines.findIndex((l, idx) => idx > admStartIdx && l.trim() === '}');

const newAdmConstructor = [
    '    public AdminController(',
    '        IAdminService adminService,',
    '        IWalletService walletService,',
    '        IShipmentService shipmentService,',
    '        IUserService userService,',
    '        IStepUpAuthService stepUpAuth,',
    '        IFulfillmentSlaService slaService,',
    '        IEtaInvoiceService etaInvoiceService)',
    '    {',
    '        _adminService = adminService;',
    '        _walletService = walletService;',
    '        _shipmentService = shipmentService;',
    '        _userService = userService;',
    '        _stepUpAuth = stepUpAuth;',
    '        _slaService = slaService;',
    '        _etaInvoiceService = etaInvoiceService;',
    '    }'
];

admLines.splice(admStartIdx, admEndIdx - admStartIdx + 1, ...newAdmConstructor);
fs.writeFileSync('backend/Marketplace.API/Controllers/AdminController.cs', admLines.join('\r\n'), 'utf8');
console.log('Replaced AdminController constructor');
