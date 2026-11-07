const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.Infrastructure/DependencyInjection.cs', 'utf8');

const oldDelivery = [
  '        // Delivery Provider (selected by configuration, defaults to "Fake")',
  '        var deliveryProviderName = configuration["Delivery:Provider"] ?? "Fake";',
  '        switch (deliveryProviderName.ToLowerInvariant())',
  '        {',
  '            case "fake":',
  '            default:',
  '                services.AddSingleton<IDeliveryProvider, FakeDeliveryProvider>();',
  '                break;',
  '        }'
].join('\r\n');

const newDelivery = [
  '        // Delivery Provider',
  '        services.AddSingleton<FakeDeliveryProvider>();',
  '        var deliveryProviderName = configuration["Delivery:Provider"] ?? "Fake";',
  '        if (string.Equals(deliveryProviderName, "Bosta", StringComparison.OrdinalIgnoreCase))',
  '        {',
  '            services.AddHttpClient<IDeliveryProvider, BostaDeliveryProvider>();',
  '        }',
  '        else',
  '        {',
  '            services.AddSingleton<IDeliveryProvider>(sp => sp.GetRequiredService<FakeDeliveryProvider>());',
  '        }',
  '',
  '        // WhatsApp Cloud API',
  '        services.Configure<Marketplace.Application.Common.WhatsAppSettings>(',
  '            configuration.GetSection(Marketplace.Application.Common.WhatsAppSettings.SectionName));',
  '        services.AddHttpClient<IWhatsAppNotificationSender, Marketplace.Infrastructure.Notifications.CloudApiWhatsAppNotificationSender>();'
].join('\r\n');

if (content.includes(oldDelivery)) {
    content = content.replace(oldDelivery, newDelivery);
    fs.writeFileSync('backend/Marketplace.Infrastructure/DependencyInjection.cs', content, 'utf8');
    console.log('DependencyInjection.cs updated successfully.');
} else {
    console.error('oldDelivery not found in DependencyInjection.cs');
    process.exit(1);
}
