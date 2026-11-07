const fs = require('fs');
const path = require('path');

// 1. Marketplace.Application/DependencyInjection.cs
const appDiPath = path.join(__dirname, '../../backend/Marketplace.Application/DependencyInjection.cs');
let appDi = fs.readFileSync(appDiPath, 'utf8');
if (!appDi.includes('IFulfillmentSlaService')) {
    appDi = appDi.replace(
        'services.AddSingleton<ITotpService, TotpService>();',
        `services.AddSingleton<ITotpService, TotpService>();
        services.AddScoped<IFulfillmentSlaService, FulfillmentSlaService>();
        services.AddScoped<IExchangeService, ExchangeService>();
        services.AddScoped<ISupportTicketService, SupportTicketService>();`
    );
    fs.writeFileSync(appDiPath, appDi, 'utf8');
    console.log('Patched Marketplace.Application/DependencyInjection.cs');
}

// 2. Marketplace.Infrastructure/DependencyInjection.cs
const infraDiPath = path.join(__dirname, '../../backend/Marketplace.Infrastructure/DependencyInjection.cs');
let infraDi = fs.readFileSync(infraDiPath, 'utf8');
if (!infraDi.includes('FulfillmentSlaBackgroundService')) {
    infraDi = infraDi.replace(
        'services.AddHostedService(sp => sp.GetRequiredService<Marketplace.Infrastructure.BackgroundServices.RefreshTokenCleanupService>());',
        `services.AddHostedService(sp => sp.GetRequiredService<Marketplace.Infrastructure.BackgroundServices.RefreshTokenCleanupService>());
        services.AddHostedService<Marketplace.Infrastructure.BackgroundServices.FulfillmentSlaBackgroundService>();`
    );
    fs.writeFileSync(infraDiPath, infraDi, 'utf8');
    console.log('Patched Marketplace.Infrastructure/DependencyInjection.cs');
}

// 3. AdminController.cs
const adminCtrlPath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/AdminController.cs');
let adminCtrl = fs.readFileSync(adminCtrlPath, 'utf8');
if (!adminCtrl.includes('EnforceSla')) {
    // Inject IFulfillmentSlaService
    adminCtrl = adminCtrl.replace(
        'private readonly IStepUpAuthService _stepUpAuth;',
        `private readonly IStepUpAuthService _stepUpAuth;
    private readonly IFulfillmentSlaService _slaService;`
    );
    adminCtrl = adminCtrl.replace(
        'IStepUpAuthService stepUpAuth)',
        `IStepUpAuthService stepUpAuth,
        IFulfillmentSlaService slaService)`
    );
    adminCtrl = adminCtrl.replace(
        '_stepUpAuth = stepUpAuth;\r\n    }',
        `_stepUpAuth = stepUpAuth;
        _slaService = slaService;
    }`
    );
    if (!adminCtrl.includes('_slaService = slaService;')) {
        adminCtrl = adminCtrl.replace(
            '_stepUpAuth = stepUpAuth;\n    }',
            `_stepUpAuth = stepUpAuth;
        _slaService = slaService;
    }`
        );
    }

    const newEndpoints = `
    /// <summary>Enforce SLA deadlines across pending shipments.</summary>
    [HttpPost("shipments/enforce-sla")]
    [ProducesResponseType(typeof(FulfillmentSlaCheckResult), StatusCodes.Status200OK)]
    public async Task<ActionResult<FulfillmentSlaCheckResult>> EnforceSla()
    {
        var result = await _slaService.CheckAndEnforceSlaAsync();
        return Ok(result);
    }

    /// <summary>Get seller fulfillment and return performance metrics.</summary>
    [HttpGet("sellers/{id:int}/performance")]
    [ProducesResponseType(typeof(SellerPerformanceMetricsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerPerformanceMetricsDto>> GetSellerPerformance(int id)
    {
        var metrics = await _userService.GetSellerPerformanceMetricsAsync(id);
        return Ok(metrics);
    }
`;
    const lastClosing = adminCtrl.lastIndexOf('}');
    adminCtrl = adminCtrl.slice(0, lastClosing) + newEndpoints + '\n' + adminCtrl.slice(lastClosing);
    fs.writeFileSync(adminCtrlPath, adminCtrl, 'utf8');
    console.log('Patched AdminController.cs');
}

// 4. UsersController.cs
const usersCtrlPath = path.join(__dirname, '../../backend/Marketplace.API/Controllers/UsersController.cs');
let usersCtrl = fs.readFileSync(usersCtrlPath, 'utf8');
if (!usersCtrl.includes('GetMyPerformance')) {
    const sellerPerfEndpoint = `
    /// <summary>Get seller performance metrics for current authenticated seller.</summary>
    [HttpGet("/api/sellers/performance")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerPerformanceMetricsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SellerPerformanceMetricsDto>> GetMyPerformance()
    {
        var sellerId = User.GetUserId();
        var metrics = await _userService.GetSellerPerformanceMetricsAsync(sellerId);
        return Ok(metrics);
    }
`;
    const lastClosing = usersCtrl.lastIndexOf('}');
    usersCtrl = usersCtrl.slice(0, lastClosing) + sellerPerfEndpoint + '\n' + usersCtrl.slice(lastClosing);
    fs.writeFileSync(usersCtrlPath, usersCtrl, 'utf8');
    console.log('Patched UsersController.cs');
}
