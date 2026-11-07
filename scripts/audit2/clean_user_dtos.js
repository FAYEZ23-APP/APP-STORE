const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../backend/Marketplace.Application/DTOs/Users/UserDtos.cs');
let content = fs.readFileSync(p, 'utf8');

const badPartStart = 'public class SellerProfileDto';
const badPartEnd = 'public class ChangePasswordRequest';

const idx1 = content.indexOf(badPartStart);
const idx2 = content.indexOf(badPartEnd);

if (idx1 !== -1 && idx2 !== -1) {
  const cleanSellerProfileDto = 'public class SellerProfileDto\r\n{\r\n' +
    '    public string DispatchCity { get; set; } = string.Empty;\r\n' +
    '    public string? DispatchAddress { get; set; }\r\n' +
    '    public string? ContactPhone { get; set; }\r\n' +
    '    public string? CommercialRegisterNumber { get; set; }\r\n' +
    '    public string? TaxCardNumber { get; set; }\r\n' +
    '    public string? NationalIdNumber { get; set; }\r\n' +
    '    public string? KybDocumentUrl { get; set; }\r\n' +
    '    public string KybStatus { get; set; } = "Unverified";\r\n' +
    '    public string? KybRejectionReason { get; set; }\r\n' +
    '    public DateTime? KybVerifiedAt { get; set; }\r\n}\r\n\r\n';

  content = content.slice(0, idx1) + cleanSellerProfileDto + content.slice(idx2);
  fs.writeFileSync(p, content, 'utf8');
  console.log('✓ Cleaned UserDtos.cs');
} else {
  console.error('Indices not found:', idx1, idx2);
}
