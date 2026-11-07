const fs = require('fs');
const path = require('path');

// 1. WebhooksController.cs
const webhooksPath = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers/WebhooksController.cs');
let webhooks = fs.readFileSync(webhooksPath, 'utf8');

if (!webhooks.includes('ProcessCarrierWebhook')) {
  const carrierWebhookMethod = '\r\n\r\n    /// <summary>\r\n' +
    '    /// Generic Carrier webhook receiver secured via HMAC-SHA256 signature (X-Carrier-Signature).\r\n' +
    '    /// </summary>\r\n' +
    '    [HttpPost("carrier")]\r\n' +
    '    [RequestSizeLimit(64 * 1024)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status200OK)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status400BadRequest)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status401Unauthorized)]\r\n' +
    '    public async Task<IActionResult> ProcessCarrierWebhook()\r\n' +
    '    {\r\n' +
    '        if (!Request.HasJsonContentType())\r\n' +
    '            return BadRequest(new { error = "Unsupported Media Type. Content-Type must be application/json." });\r\n\r\n' +
    '        byte[] rawBodyBytes;\r\n' +
    '        using (var ms = new MemoryStream())\r\n' +
    '        {\r\n' +
    '            await Request.Body.CopyToAsync(ms);\r\n' +
    '            rawBodyBytes = ms.ToArray();\r\n' +
    '        }\r\n\r\n' +
    '        if (rawBodyBytes.Length == 0)\r\n' +
    '            return BadRequest(new { error = "Request body cannot be empty." });\r\n\r\n' +
    '        var signatureHeader = Request.Headers["X-Carrier-Signature"].FirstOrDefault();\r\n' +
    '        if (string.IsNullOrWhiteSpace(signatureHeader))\r\n' +
    '            return Unauthorized(new { error = "Missing signature header (X-Carrier-Signature is required)." });\r\n\r\n' +
    '        var webhookSecret = _configuration["Delivery:WebhookSecret"]\r\n' +
    '            ?? _configuration["Carrier:DevSecret"]\r\n' +
    '            ?? "test-webhook-secret-wave2";\r\n\r\n' +
    '        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));\r\n' +
    '        var computedHash = hmac.ComputeHash(rawBodyBytes);\r\n' +
    '        var computedHex = Convert.ToHexString(computedHash);\r\n\r\n' +
    '        byte[] providedBytes;\r\n' +
    '        try { providedBytes = Convert.FromHexString(signatureHeader); }\r\n' +
    '        catch { return Unauthorized(new { error = "Invalid signature encoding." }); }\r\n\r\n' +
    '        if (!CryptographicOperations.FixedTimeEquals(computedHash, providedBytes))\r\n' +
    '        {\r\n' +
    '            _logger.LogWarning("Carrier webhook rejected: Invalid HMAC signature.");\r\n' +
    '            return Unauthorized(new { error = "Invalid carrier webhook HMAC signature." });\r\n' +
    '        }\r\n\r\n' +
    '        using var doc = JsonDocument.Parse(rawBodyBytes);\r\n' +
    '        var root = doc.RootElement;\r\n' +
    '        string? trackingNumber = root.TryGetProperty("trackingNumber", out var tn) ? tn.GetString() : null;\r\n' +
    '        string? rawState = root.TryGetProperty("status", out var st) ? st.GetString() : null;\r\n' +
    '        int? shipmentId = root.TryGetProperty("shipmentId", out var sid) && sid.TryGetInt32(out var idVal) ? idVal : null;\r\n\r\n' +
    '        Shipment? shipment = null;\r\n' +
    '        if (shipmentId.HasValue)\r\n' +
    '            shipment = await _uow.Shipments.GetByIdAsync(shipmentId.Value);\r\n' +
    '        else if (!string.IsNullOrWhiteSpace(trackingNumber))\r\n' +
    '            shipment = (await _uow.Shipments.FindAsync(s => s.TrackingNumber == trackingNumber)).FirstOrDefault();\r\n\r\n' +
    '        if (shipment == null)\r\n' +
    '            return NotFound(new { error = "Shipment not found." });\r\n\r\n' +
    '        if (!string.IsNullOrWhiteSpace(rawState) && Enum.TryParse<ShipmentStatus>(rawState, true, out var targetStatus))\r\n' +
    '        {\r\n' +
    '            await _shipmentService.UpdateCarrierShipmentStatusAsync(shipment.Id, new UpdateShipmentStatusRequest\r\n' +
    '            {\r\n' +
    '                Status = targetStatus.ToString(),\r\n' +
    '                TrackingNumber = trackingNumber ?? shipment.TrackingNumber\r\n' +
    '            });\r\n' +
    '        }\r\n\r\n' +
    '        return Ok(new { success = true, shipmentId = shipment.Id, status = shipment.Status.ToString() });\r\n' +
    '    }\r\n';

  const lastBrace = webhooks.lastIndexOf('}');
  webhooks = webhooks.slice(0, lastBrace) + carrierWebhookMethod + webhooks.slice(lastBrace);
  fs.writeFileSync(webhooksPath, webhooks, 'utf8');
  console.log('✓ Updated WebhooksController.cs with carrier webhook');
}

// 2. AdminController.cs
const adminControllerPath = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers/AdminController.cs');
let adminController = fs.readFileSync(adminControllerPath, 'utf8');

if (!adminController.includes('SettleRemittanceBatch')) {
  // Inject IUserService
  adminController = adminController.replace(
    '    private readonly IShipmentService _shipmentService;\r\n    private readonly IStepUpAuthService _stepUpAuth;',
    '    private readonly IShipmentService _shipmentService;\r\n    private readonly IUserService _userService;\r\n    private readonly IStepUpAuthService _stepUpAuth;'
  );

  adminController = adminController.replace(
    '        IShipmentService shipmentService,\r\n        IStepUpAuthService stepUpAuth)',
    '        IShipmentService shipmentService,\r\n        IUserService userService,\r\n        IStepUpAuthService stepUpAuth)'
  );

  adminController = adminController.replace(
    '        _shipmentService = shipmentService;\r\n        _stepUpAuth = stepUpAuth;',
    '        _shipmentService = shipmentService;\r\n        _userService = userService;\r\n        _stepUpAuth = stepUpAuth;'
  );

  // Add SettleRemittanceBatch & UpdateKybStatus endpoints
  const adminEndpoints = '\r\n\r\n    /// <summary>Settle a batch of carrier remittances atomically and release escrow.</summary>\r\n' +
    '    [HttpPost("shipments/settle-remittance-batch")]\r\n' +
    '    [ProducesResponseType(typeof(SettleRemittanceBatchResponse), StatusCodes.Status200OK)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status400BadRequest)]\r\n' +
    '    public async Task<ActionResult<SettleRemittanceBatchResponse>> SettleRemittanceBatch(\r\n' +
    '        [FromBody] SettleRemittanceBatchRequest request)\r\n' +
    '    {\r\n' +
    '        var adminId = User.GetUserId();\r\n' +
    '        var result = await _shipmentService.SettleRemittanceBatchAsync(adminId, request);\r\n' +
    '        return Ok(result);\r\n' +
    '    }\r\n\r\n' +
    '    /// <summary>Update KYB verification status for a seller.</summary>\r\n' +
    '    [HttpPut("sellers/{id:int}/kyb-status")]\r\n' +
    '    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status400BadRequest)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status404NotFound)]\r\n' +
    '    public async Task<ActionResult<SellerProfileDto>> UpdateKybStatus(\r\n' +
    '        int id,\r\n' +
    '        [FromBody] UpdateKybStatusRequest request)\r\n' +
    '    {\r\n' +
    '        var adminId = User.GetUserId();\r\n' +
    '        var result = await _userService.UpdateKybStatusAsync(id, request, adminId);\r\n' +
    '        return Ok(result);\r\n' +
    '    }\r\n';

  const lastBrace = adminController.lastIndexOf('}');
  adminController = adminController.slice(0, lastBrace) + adminEndpoints + adminController.slice(lastBrace);
  fs.writeFileSync(adminControllerPath, adminController, 'utf8');
  console.log('✓ Updated AdminController.cs with remittance batch and KYB status endpoints');
}

// 3. UsersController.cs
const usersControllerPath = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers/UsersController.cs');
let usersController = fs.readFileSync(usersControllerPath, 'utf8');

if (!usersController.includes('SubmitKyb')) {
  const kybEndpoints = '\r\n\r\n    /// <summary>Submit business KYB documents and identification for seller verification.</summary>\r\n' +
    '    [HttpPut("me/seller-profile/kyb")]\r\n' +
    '    [HttpPut("/api/sellers/kyb")]\r\n' +
    '    [Authorize(Roles = "Seller")]\r\n' +
    '    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]\r\n' +
    '    [ProducesResponseType(StatusCodes.Status400BadRequest)]\r\n' +
    '    public async Task<ActionResult<SellerProfileDto>> SubmitKyb([FromBody] SubmitKybRequest request)\r\n' +
    '    {\r\n' +
    '        var userId = User.GetUserId();\r\n' +
    '        var result = await _userService.SubmitKybAsync(userId, request);\r\n' +
    '        return Ok(result);\r\n' +
    '    }\r\n';

  const lastBrace = usersController.lastIndexOf('}');
  usersController = usersController.slice(0, lastBrace) + kybEndpoints + usersController.slice(lastBrace);
  fs.writeFileSync(usersControllerPath, usersController, 'utf8');
  console.log('✓ Updated UsersController.cs with SubmitKyb endpoint');
}
