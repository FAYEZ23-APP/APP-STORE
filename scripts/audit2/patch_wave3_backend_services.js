const fs = require('fs');
const path = require('path');

// 1. AdminDtos.cs
const adminDtosPath = path.resolve(__dirname, '../../backend/Marketplace.Application/DTOs/Admin/AdminDtos.cs');
let adminDtos = fs.readFileSync(adminDtosPath, 'utf8');
if (!adminDtos.includes('KybStatus')) {
  adminDtos = adminDtos.replace(
    '    public string? ContactPhone { get; set; }\r\n}',
    '    public string? ContactPhone { get; set; }\r\n' +
    '    public string? KybStatus { get; set; }\r\n' +
    '    public string? CommercialRegisterNumber { get; set; }\r\n' +
    '    public string? TaxCardNumber { get; set; }\r\n}'
  );
  fs.writeFileSync(adminDtosPath, adminDtos, 'utf8');
  console.log('✓ Updated AdminDtos.cs with KybStatus');
}

// 2. AdminService.cs
const adminServicePath = path.resolve(__dirname, '../../backend/Marketplace.Application/Services/AdminService.cs');
let adminService = fs.readFileSync(adminServicePath, 'utf8');
if (!adminService.includes('KybStatus = sp?.KybStatus')) {
  adminService = adminService.replace(
    'ContactPhone = sp?.ContactPhone\r\n            };',
    'ContactPhone = sp?.ContactPhone,\r\n                KybStatus = sp?.KybStatus,\r\n                CommercialRegisterNumber = sp?.CommercialRegisterNumber,\r\n                TaxCardNumber = sp?.TaxCardNumber\r\n            };'
  );
  adminService = adminService.replace(
    'ContactPhone = sellerProfile?.ContactPhone\r\n        };',
    'ContactPhone = sellerProfile?.ContactPhone,\r\n            KybStatus = sellerProfile?.KybStatus,\r\n            CommercialRegisterNumber = sellerProfile?.CommercialRegisterNumber,\r\n            TaxCardNumber = sellerProfile?.TaxCardNumber\r\n        };'
  );
  fs.writeFileSync(adminServicePath, adminService, 'utf8');
  console.log('✓ Updated AdminService.cs mapping');
}

// 3. UserService.cs
const userServicePath = path.resolve(__dirname, '../../backend/Marketplace.Application/Services/UserService.cs');
let userService = fs.readFileSync(userServicePath, 'utf8');
if (!userService.includes('SubmitKybAsync')) {
  // Update GetSellerProfileAsync mapping
  userService = userService.replace(
    '            ContactPhone = sellerProfile?.ContactPhone\r\n        };',
    '            ContactPhone = sellerProfile?.ContactPhone,\r\n' +
    '            CommercialRegisterNumber = sellerProfile?.CommercialRegisterNumber,\r\n' +
    '            TaxCardNumber = sellerProfile?.TaxCardNumber,\r\n' +
    '            NationalIdNumber = sellerProfile?.NationalIdNumber,\r\n' +
    '            KybDocumentUrl = sellerProfile?.KybDocumentUrl,\r\n' +
    '            KybStatus = sellerProfile?.KybStatus ?? "Unverified",\r\n' +
    '            KybRejectionReason = sellerProfile?.KybRejectionReason,\r\n' +
    '            KybVerifiedAt = sellerProfile?.KybVerifiedAt\r\n        };'
  );

  // Update UpdateSellerProfileAsync return mapping
  userService = userService.replace(
    '            ContactPhone = profile.ContactPhone\r\n        };',
    '            ContactPhone = profile.ContactPhone,\r\n' +
    '            CommercialRegisterNumber = profile.CommercialRegisterNumber,\r\n' +
    '            TaxCardNumber = profile.TaxCardNumber,\r\n' +
    '            NationalIdNumber = profile.NationalIdNumber,\r\n' +
    '            KybDocumentUrl = profile.KybDocumentUrl,\r\n' +
    '            KybStatus = profile.KybStatus,\r\n' +
    '            KybRejectionReason = profile.KybRejectionReason,\r\n' +
    '            KybVerifiedAt = profile.KybVerifiedAt\r\n        };'
  );

  // Add SubmitKybAsync & UpdateKybStatusAsync before ChangePasswordAsync
  const kybMethods = '\r\n    public async Task<SellerProfileDto> SubmitKybAsync(int userId, SubmitKybRequest request)\r\n    {\r\n' +
    '        var user = await _uow.Users.GetByIdAsync(userId);\r\n' +
    '        if (user == null)\r\n' +
    '            throw new NotFoundException($"User with ID {userId} not found.");\r\n\r\n' +
    '        if (user.Role != UserRole.Seller)\r\n' +
    '            throw new ForbiddenException("Only sellers can submit KYB verification.");\r\n\r\n' +
    '        var profile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == userId)).FirstOrDefault();\r\n' +
    '        if (profile == null)\r\n' +
    '        {\r\n' +
    '            profile = new SellerProfile\r\n' +
    '            {\r\n' +
    '                UserId = userId,\r\n' +
    '                DispatchCity = "القاهرة",\r\n' +
    '                CommercialRegisterNumber = request.CommercialRegisterNumber?.Trim(),\r\n' +
    '                TaxCardNumber = request.TaxCardNumber?.Trim(),\r\n' +
    '                NationalIdNumber = request.NationalIdNumber?.Trim(),\r\n' +
    '                KybDocumentUrl = request.KybDocumentUrl?.Trim(),\r\n' +
    '                KybStatus = "Pending"\r\n' +
    '            };\r\n' +
    '            await _uow.SellerProfiles.AddAsync(profile);\r\n' +
    '        }\r\n' +
    '        else\r\n' +
    '        {\r\n' +
    '            profile.CommercialRegisterNumber = request.CommercialRegisterNumber?.Trim();\r\n' +
    '            profile.TaxCardNumber = request.TaxCardNumber?.Trim();\r\n' +
    '            profile.NationalIdNumber = request.NationalIdNumber?.Trim();\r\n' +
    '            profile.KybDocumentUrl = request.KybDocumentUrl?.Trim();\r\n' +
    '            profile.KybStatus = "Pending";\r\n' +
    '            profile.KybRejectionReason = null;\r\n' +
    '            _uow.SellerProfiles.Update(profile);\r\n' +
    '        }\r\n\r\n' +
    '        await _uow.SaveChangesAsync();\r\n' +
    '        return await GetSellerProfileAsync(userId);\r\n' +
    '    }\r\n\r\n' +
    '    public async Task<SellerProfileDto> UpdateKybStatusAsync(int sellerId, UpdateKybStatusRequest request, int adminId)\r\n    {\r\n' +
    '        var profile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == sellerId)).FirstOrDefault();\r\n' +
    '        if (profile == null)\r\n' +
    '            throw new NotFoundException($"Seller profile for user {sellerId} not found.");\r\n\r\n' +
    '        var normalizedStatus = request.Status.Trim();\r\n' +
    '        profile.KybStatus = normalizedStatus;\r\n' +
    '        if (string.Equals(normalizedStatus, "Verified", StringComparison.OrdinalIgnoreCase))\r\n' +
    '        {\r\n' +
    '            profile.KybVerifiedAt = DateTime.UtcNow;\r\n' +
    '            profile.KybRejectionReason = null;\r\n' +
    '        }\r\n' +
    '        else if (string.Equals(normalizedStatus, "Rejected", StringComparison.OrdinalIgnoreCase))\r\n' +
    '        {\r\n' +
    '            profile.KybRejectionReason = request.RejectionReason?.Trim();\r\n' +
    '            profile.KybVerifiedAt = null;\r\n' +
    '        }\r\n\r\n' +
    '        _uow.SellerProfiles.Update(profile);\r\n\r\n' +
    '        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog\r\n' +
    '        {\r\n' +
    '            AdminId = adminId,\r\n' +
    '            Action = "UpdateKybStatus",\r\n' +
    '            EntityType = "SellerProfile",\r\n' +
    '            EntityId = profile.Id.ToString(),\r\n' +
    '            Details = $"Admin {adminId} updated KYB status of seller {sellerId} to {profile.KybStatus}. Reason: {request.RejectionReason}",\r\n' +
    '            CreatedAt = DateTime.UtcNow\r\n' +
    '        });\r\n\r\n' +
    '        await _uow.SaveChangesAsync();\r\n' +
    '        return await GetSellerProfileAsync(sellerId);\r\n' +
    '    }\r\n';

  userService = userService.replace('    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request)', kybMethods + '\r\n    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request)');
  fs.writeFileSync(userServicePath, userService, 'utf8');
  console.log('✓ Updated UserService.cs with KYB methods');
}

// 4. ShipmentService.cs
const shipmentServicePath = path.resolve(__dirname, '../../backend/Marketplace.Application/Services/ShipmentService.cs');
let shipmentService = fs.readFileSync(shipmentServicePath, 'utf8');
if (!shipmentService.includes('SettleRemittanceBatchAsync')) {
  const remittanceMethod = '\r\n    public async Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request)\r\n    {\r\n' +
    '        if (request == null || string.IsNullOrWhiteSpace(request.BatchReference))\r\n' +
    '            throw new BadRequestException("BatchReference is required.");\r\n\r\n' +
    '        var response = new SettleRemittanceBatchResponse\r\n        {\r\n' +
    '            BatchReference = request.BatchReference.Trim()\r\n        };\r\n\r\n' +
    '        foreach (var item in request.Items)\r\n        {\r\n' +
    '            response.TotalProcessed++;\r\n' +
    '            Shipment? shipment = null;\r\n\r\n' +
    '            if (item.ShipmentId.HasValue)\r\n            {\r\n' +
    '                shipment = await _uow.Shipments.GetByIdAsync(item.ShipmentId.Value);\r\n            }\r\n' +
    '            else if (!string.IsNullOrWhiteSpace(item.TrackingNumber))\r\n            {\r\n' +
    '                var tn = item.TrackingNumber.Trim();\r\n' +
    '                shipment = (await _uow.Shipments.FindAsync(s => s.TrackingNumber == tn)).FirstOrDefault();\r\n            }\r\n\r\n' +
    '            if (shipment == null)\r\n            {\r\n' +
    '                response.Errors.Add($"Shipment with tracking/ID \'{item.TrackingNumber ?? item.ShipmentId?.ToString()}\' not found.");\r\n' +
    '                continue;\r\n            }\r\n\r\n' +
    '            if (shipment.IsCodSettled)\r\n            {\r\n' +
    '                response.Errors.Add($"Shipment #{shipment.Id} is already settled under reference \'{shipment.SettlementReference}\'.");\r\n' +
    '                continue;\r\n            }\r\n\r\n' +
    '            shipment.IsCodSettled = true;\r\n' +
    '            shipment.CodSettledAt = DateTime.UtcNow;\r\n' +
    '            shipment.SettlementReference = response.BatchReference;\r\n' +
    '            shipment.RemittanceBatchReference = response.BatchReference;\r\n' +
    '            shipment.ReceivedAmount = item.CollectedAmount;\r\n' +
    '            shipment.SettledByAdminId = adminId;\r\n' +
    '            shipment.EscrowReleaseAt = DateTime.UtcNow;\r\n\r\n' +
    '            _uow.Shipments.Update(shipment);\r\n' +
    '            response.TotalSettled++;\r\n' +
    '            response.TotalAmount += item.CollectedAmount;\r\n        }\r\n\r\n' +
    '        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog\r\n        {\r\n' +
    '            AdminId = adminId,\r\n' +
    '            Action = "SettleRemittanceBatch",\r\n' +
    '            EntityType = "RemittanceBatch",\r\n' +
    '            EntityId = response.BatchReference,\r\n' +
    '            Details = $"Settled {response.TotalSettled}/{response.TotalProcessed} shipments in batch \'{response.BatchReference}\'. Total: {response.TotalAmount} EGP.",\r\n' +
    '            CreatedAt = DateTime.UtcNow\r\n        });\r\n\r\n' +
    '        await _uow.SaveChangesAsync();\r\n' +
    '        return response;\r\n    }\r\n';

  // Find last closing brace in ShipmentService.cs
  const lastBrace = shipmentService.lastIndexOf('}');
  shipmentService = shipmentService.slice(0, lastBrace) + remittanceMethod + shipmentService.slice(lastBrace);
  fs.writeFileSync(shipmentServicePath, shipmentService, 'utf8');
  console.log('✓ Updated ShipmentService.cs with SettleRemittanceBatchAsync');
}
