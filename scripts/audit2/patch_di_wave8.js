const fs = require('fs');
let di = fs.readFileSync('backend/Marketplace.Infrastructure/DependencyInjection.cs', 'utf8');

const target = '        // Payment Gateway (Paymob / Meeza) & ETA e-Invoicing';
if (!di.includes(target)) {
    const insertBefore = '        // Background Services';
    const addition = `        // Payment Gateway (Paymob / Meeza) & ETA e-Invoicing
        services.AddHttpClient<IPaymentGatewayProvider, Marketplace.Infrastructure.Payments.PaymobPaymentGatewayProvider>();
        services.AddScoped<IEtaInvoiceService, Marketplace.Infrastructure.Services.EtaInvoiceService>();\r\n\r\n`;

    di = di.replace(insertBefore, addition + insertBefore);
    fs.writeFileSync('backend/Marketplace.Infrastructure/DependencyInjection.cs', di, 'utf8');
    console.log('DependencyInjection.cs updated with PaymentGateway and EtaInvoiceService.');
}
