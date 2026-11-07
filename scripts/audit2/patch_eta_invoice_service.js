const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.Infrastructure/Services/EtaInvoiceService.cs', 'utf8');

// 1. Add using Marketplace.Application.Exceptions;
if (!content.includes('using Marketplace.Application.Exceptions;')) {
    content = 'using Marketplace.Application.Exceptions;\r\n' + content;
}

// 2. Fix subtotal calculation
content = content.replace(
    'var subtotal = order.ItemsSubtotal;',
    'var subtotal = (order.Items != null && order.Items.Count > 0) ? order.Items.Sum(i => i.UnitPrice * i.Quantity) : order.TotalAmount;'
);

// 3. Fix CommercialRegistrationNumber -> TaxCardNumber ?? CommercialRegisterNumber
content = content.replace(
    'var taxRegNumber = sellerProfile?.CommercialRegistrationNumber ?? "100-200-300";',
    'var taxRegNumber = sellerProfile?.TaxCardNumber ?? sellerProfile?.CommercialRegisterNumber ?? "100-200-300";'
);

fs.writeFileSync('backend/Marketplace.Infrastructure/Services/EtaInvoiceService.cs', content, 'utf8');
console.log('Successfully patched EtaInvoiceService.cs');
