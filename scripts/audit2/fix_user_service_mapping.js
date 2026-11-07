const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../backend/Marketplace.Application/Services/UserService.cs');
let content = fs.readFileSync(p, 'utf8');

const target = '        return new SellerProfileDto\r\n' +
  '        {\r\n' +
  '            DispatchCity = sellerProfile?.DispatchCity ?? string.Empty,\r\n' +
  '            DispatchAddress = sellerProfile?.DispatchAddress,\r\n' +
  '            ContactPhone = sellerProfile?.ContactPhone\r\n' +
  '        };';

const targetLF = '        return new SellerProfileDto\n' +
  '        {\n' +
  '            DispatchCity = sellerProfile?.DispatchCity ?? string.Empty,\n' +
  '            DispatchAddress = sellerProfile?.DispatchAddress,\n' +
  '            ContactPhone = sellerProfile?.ContactPhone\n' +
  '        };';

const replacement = '        return new SellerProfileDto\r\n' +
  '        {\r\n' +
  '            DispatchCity = sellerProfile?.DispatchCity ?? string.Empty,\r\n' +
  '            DispatchAddress = sellerProfile?.DispatchAddress,\r\n' +
  '            ContactPhone = sellerProfile?.ContactPhone,\r\n' +
  '            CommercialRegisterNumber = sellerProfile?.CommercialRegisterNumber,\r\n' +
  '            TaxCardNumber = sellerProfile?.TaxCardNumber,\r\n' +
  '            NationalIdNumber = sellerProfile?.NationalIdNumber,\r\n' +
  '            KybDocumentUrl = sellerProfile?.KybDocumentUrl,\r\n' +
  '            KybStatus = sellerProfile?.KybStatus ?? "Unverified",\r\n' +
  '            KybRejectionReason = sellerProfile?.KybRejectionReason,\r\n' +
  '            KybVerifiedAt = sellerProfile?.KybVerifiedAt\r\n' +
  '        };';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  console.log('✓ Replaced CRLF version');
} else if (content.includes(targetLF)) {
  content = content.replace(targetLF, replacement);
  console.log('✓ Replaced LF version');
} else {
  console.error('Target not found!');
  // find index
  const idx = content.indexOf('public async Task<SellerProfileDto> GetSellerProfileAsync');
  console.log('idx of method:', idx);
  console.log(content.slice(idx, idx + 400));
}

fs.writeFileSync(p, content, 'utf8');
