const fs = require('fs');
const path = require('path');

const dbContextPath = path.resolve(__dirname, '../../backend/Marketplace.Infrastructure/Data/AppDbContext.cs');
let content = fs.readFileSync(dbContextPath, 'utf8');

let modified = false;

// 1. SellerProfile
if (!content.includes('CommercialRegisterNumber')) {
  const sellerTarget = 'entity.Property(sp => sp.ContactPhone)';
  const idx1 = content.indexOf(sellerTarget);
  if (idx1 !== -1) {
    const semi1 = content.indexOf(';', idx1);
    const sellerCode = '\r\n\r\n            entity.Property(sp => sp.CommercialRegisterNumber)\r\n                .HasMaxLength(50);\r\n\r\n' +
      '            entity.Property(sp => sp.TaxCardNumber)\r\n                .HasMaxLength(50);\r\n\r\n' +
      '            entity.Property(sp => sp.NationalIdNumber)\r\n                .HasMaxLength(30);\r\n\r\n' +
      '            entity.Property(sp => sp.KybDocumentUrl)\r\n                .HasMaxLength(500);\r\n\r\n' +
      '            entity.Property(sp => sp.KybStatus)\r\n                .IsRequired()\r\n                .HasMaxLength(30)\r\n                .HasDefaultValue("Unverified");\r\n\r\n' +
      '            entity.Property(sp => sp.KybRejectionReason)\r\n                .HasMaxLength(500);\r\n\r\n' +
      '            entity.Property(sp => sp.KybVerifiedAt);';
    content = content.slice(0, semi1 + 1) + sellerCode + content.slice(semi1 + 1);
    modified = true;
    console.log('✓ Added SellerProfile KYB configuration to AppDbContext.cs');
  } else {
    console.warn('✗ Could not find ContactPhone in AppDbContext.cs');
  }
} else {
  console.log('• SellerProfile KYB already configured in AppDbContext.cs');
}

// 2. Shipment
if (!content.includes('RemittanceBatchReference')) {
  const shipmentTarget = 'entity.Property(s => s.EscrowReleaseAt);';
  const idx2 = content.indexOf(shipmentTarget);
  if (idx2 !== -1) {
    const semi2 = content.indexOf(';', idx2);
    const shipmentCode = '\r\n\r\n            entity.Property(s => s.RemittanceBatchReference)\r\n                .HasMaxLength(100);';
    content = content.slice(0, semi2 + 1) + shipmentCode + content.slice(semi2 + 1);
    modified = true;
    console.log('✓ Added Shipment RemittanceBatchReference configuration to AppDbContext.cs');
  } else {
    console.warn('✗ Could not find EscrowReleaseAt in AppDbContext.cs');
  }
} else {
  console.log('• Shipment RemittanceBatchReference already configured in AppDbContext.cs');
}

if (modified) {
  fs.writeFileSync(dbContextPath, content, 'utf8');
  console.log('AppDbContext.cs saved successfully.');
}
