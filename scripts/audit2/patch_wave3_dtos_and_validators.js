const fs = require('fs');
const path = require('path');

// 1. UserDtos.cs
const userDtosPath = path.resolve(__dirname, '../../backend/Marketplace.Application/DTOs/Users/UserDtos.cs');
let userDtos = fs.readFileSync(userDtosPath, 'utf8');

if (!userDtos.includes('CommercialRegisterNumber')) {
  // Update SellerProfileDto
  userDtos = userDtos.replace(
    '    public string? ContactPhone { get; set; }\r\n}',
    '    public string? ContactPhone { get; set; }\r\n' +
    '    public string? CommercialRegisterNumber { get; set; }\r\n' +
    '    public string? TaxCardNumber { get; set; }\r\n' +
    '    public string? NationalIdNumber { get; set; }\r\n' +
    '    public string? KybDocumentUrl { get; set; }\r\n' +
    '    public string KybStatus { get; set; } = "Unverified";\r\n' +
    '    public string? KybRejectionReason { get; set; }\r\n' +
    '    public DateTime? KybVerifiedAt { get; set; }\r\n}'
  );

  // Append SubmitKybRequest & UpdateKybStatusRequest
  const kybDtos = '\r\n\r\npublic class SubmitKybRequest\r\n{\r\n' +
    '    public string? CommercialRegisterNumber { get; set; }\r\n' +
    '    public string? TaxCardNumber { get; set; }\r\n' +
    '    public string? NationalIdNumber { get; set; }\r\n' +
    '    public string? KybDocumentUrl { get; set; }\r\n' +
    '}\r\n\r\n' +
    'public class UpdateKybStatusRequest\r\n{\r\n' +
    '    public string Status { get; set; } = string.Empty;\r\n' +
    '    public string? RejectionReason { get; set; }\r\n' +
    '}\r\n';
  userDtos += kybDtos;

  fs.writeFileSync(userDtosPath, userDtos, 'utf8');
  console.log('✓ Updated UserDtos.cs with KYB DTOs');
} else {
  console.log('• UserDtos.cs already has KYB DTOs');
}

// 2. UserValidators.cs
const userValidatorsPath = path.resolve(__dirname, '../../backend/Marketplace.Application/Validators/Users/UserValidators.cs');
let userValidators = fs.readFileSync(userValidatorsPath, 'utf8');

if (!userValidators.includes('SubmitKybRequestValidator')) {
  const kybValidators = '\r\n\r\npublic class SubmitKybRequestValidator : AbstractValidator<SubmitKybRequest>\r\n{\r\n' +
    '    public SubmitKybRequestValidator()\r\n    {\r\n' +
    '        RuleFor(x => x.CommercialRegisterNumber)\r\n            .MaximumLength(50);\r\n\r\n' +
    '        RuleFor(x => x.TaxCardNumber)\r\n            .MaximumLength(50);\r\n\r\n' +
    '        RuleFor(x => x.NationalIdNumber)\r\n            .MaximumLength(30);\r\n\r\n' +
    '        RuleFor(x => x.KybDocumentUrl)\r\n            .MaximumLength(500);\r\n' +
    '    }\r\n}\r\n\r\n' +
    'public class UpdateKybStatusRequestValidator : AbstractValidator<UpdateKybStatusRequest>\r\n{\r\n' +
    '    public UpdateKybStatusRequestValidator()\r\n    {\r\n' +
    '        RuleFor(x => x.Status)\r\n            .NotEmpty().WithMessage("Status is required.")\r\n' +
    '            .Must(s => new[] { "Verified", "Rejected", "Pending", "Unverified" }.Contains(s))\r\n' +
    '            .WithMessage("Status must be Verified, Rejected, Pending, or Unverified.");\r\n\r\n' +
    '        RuleFor(x => x.RejectionReason)\r\n            .MaximumLength(500);\r\n' +
    '    }\r\n}\r\n';
  userValidators += kybValidators;

  fs.writeFileSync(userValidatorsPath, userValidators, 'utf8');
  console.log('✓ Updated UserValidators.cs with KYB validators');
} else {
  console.log('• UserValidators.cs already has KYB validators');
}

// 3. ShipmentDtos.cs
const shipmentDtosPath = path.resolve(__dirname, '../../backend/Marketplace.Application/DTOs/Shipments/ShipmentDtos.cs');
let shipmentDtos = fs.readFileSync(shipmentDtosPath, 'utf8');

if (!shipmentDtos.includes('SettleRemittanceBatchRequest')) {
  const remittanceDtos = '\r\n\r\npublic class RemittanceItemRequest\r\n{\r\n' +
    '    public string? TrackingNumber { get; set; }\r\n' +
    '    public int? ShipmentId { get; set; }\r\n' +
    '    public decimal CollectedAmount { get; set; }\r\n' +
    '}\r\n\r\n' +
    'public class SettleRemittanceBatchRequest\r\n{\r\n' +
    '    public string BatchReference { get; set; } = string.Empty;\r\n' +
    '    public List<RemittanceItemRequest> Items { get; set; } = new();\r\n' +
    '}\r\n\r\n' +
    'public class SettleRemittanceBatchResponse\r\n{\r\n' +
    '    public string BatchReference { get; set; } = string.Empty;\r\n' +
    '    public int TotalProcessed { get; set; }\r\n' +
    '    public int TotalSettled { get; set; }\r\n' +
    '    public decimal TotalAmount { get; set; }\r\n' +
    '    public List<string> Errors { get; set; } = new();\r\n' +
    '}\r\n';

  shipmentDtos += remittanceDtos;
  fs.writeFileSync(shipmentDtosPath, shipmentDtos, 'utf8');
  console.log('✓ Updated ShipmentDtos.cs with Remittance DTOs');
} else {
  console.log('• ShipmentDtos.cs already has Remittance DTOs');
}

// 4. ShipmentValidators.cs
const shipmentValidatorsPath = path.resolve(__dirname, '../../backend/Marketplace.Application/Validators/Shipments/ShipmentValidators.cs');
let shipmentValidators = fs.readFileSync(shipmentValidatorsPath, 'utf8');

if (!shipmentValidators.includes('SettleRemittanceBatchRequestValidator')) {
  // Find last closing brace and insert before it
  const lastBrace = shipmentValidators.lastIndexOf('}');
  const remittanceValidators = '\r\npublic class RemittanceItemRequestValidator : AbstractValidator<RemittanceItemRequest>\r\n{\r\n' +
    '    public RemittanceItemRequestValidator()\r\n    {\r\n' +
    '        RuleFor(x => x)\r\n            .Must(x => !string.IsNullOrWhiteSpace(x.TrackingNumber) || x.ShipmentId.HasValue)\r\n' +
    '            .WithMessage("Either TrackingNumber or ShipmentId must be provided.");\r\n\r\n' +
    '        RuleFor(x => x.CollectedAmount)\r\n            .GreaterThanOrEqualTo(0)\r\n            .WithMessage("Collected amount cannot be negative.");\r\n' +
    '    }\r\n}\r\n\r\n' +
    'public class SettleRemittanceBatchRequestValidator : AbstractValidator<SettleRemittanceBatchRequest>\r\n{\r\n' +
    '    public SettleRemittanceBatchRequestValidator()\r\n    {\r\n' +
    '        RuleFor(x => x.BatchReference)\r\n            .NotEmpty().WithMessage("BatchReference is required.")\r\n            .MaximumLength(100);\r\n\r\n' +
    '        RuleFor(x => x.Items)\r\n            .NotNull().WithMessage("Items list is required.")\r\n            .Must(x => x != null && x.Count > 0).WithMessage("At least one remittance item is required.");\r\n\r\n' +
    '        RuleForEach(x => x.Items).SetValidator(new RemittanceItemRequestValidator());\r\n' +
    '    }\r\n}\r\n';

  shipmentValidators = shipmentValidators.slice(0, lastBrace) + remittanceValidators + shipmentValidators.slice(lastBrace);
  fs.writeFileSync(shipmentValidatorsPath, shipmentValidators, 'utf8');
  console.log('✓ Updated ShipmentValidators.cs with Remittance validators');
} else {
  console.log('• ShipmentValidators.cs already has Remittance validators');
}
