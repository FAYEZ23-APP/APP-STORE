const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../backend/Marketplace.Application/DTOs/Users/UserDtos.cs');
let content = fs.readFileSync(p, 'utf8');

// Find 'public class SellerProfileDto'
const idx = content.indexOf('public class SellerProfileDto');
if (idx !== -1) {
  const endBrace = content.indexOf('}', idx);
  const newProfileDto = 'public class SellerProfileDto\r\n{\r\n' +
    '    public string DispatchCity { get; set; } = string.Empty;\r\n' +
    '    public string? DispatchAddress { get; set; }\r\n' +
    '    public string? ContactPhone { get; set; }\r\n' +
    '    public string? CommercialRegisterNumber { get; set; }\r\n' +
    '    public string? TaxCardNumber { get; set; }\r\n' +
    '    public string? NationalIdNumber { get; set; }\r\n' +
    '    public string? KybDocumentUrl { get; set; }\r\n' +
    '    public string KybStatus { get; set; } = "Unverified";\r\n' +
    '    public string? KybRejectionReason { get; set; }\r\n' +
    '    public DateTime? KybVerifiedAt { get; set; }\r\n}';

  content = content.slice(0, idx) + newProfileDto + content.slice(endBrace + 1);

  // Clean any wrongly inserted fields in UpdateProfileRequest
  const updateReqIdx = content.indexOf('public class UpdateProfileRequest');
  const updateReqEnd = content.indexOf('public class SellerProfileDto');
  const cleanUpdateReq = 'public class UpdateProfileRequest\r\n{\r\n' +
    '    public string Name { get; set; } = string.Empty;\r\n' +
    '    public string? DispatchCity { get; set; }\r\n' +
    '    public string? DispatchAddress { get; set; }\r\n' +
    '    public string? ContactPhone { get; set; }\r\n}\r\n\r\n';

  content = content.slice(0, updateReqIdx) + cleanUpdateReq + content.slice(updateReqEnd);

  fs.writeFileSync(p, content, 'utf8');
  console.log('✓ Successfully fixed SellerProfileDto and UpdateProfileRequest in UserDtos.cs');
}
