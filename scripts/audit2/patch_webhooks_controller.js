const fs = require('fs');
let content = fs.readFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', 'utf8');

// 1. Add using Marketplace.Application.DTOs.Payments; if not present
if (!content.includes('using Marketplace.Application.DTOs.Payments;')) {
    content = 'using Marketplace.Application.DTOs.Payments;\r\n' + content;
}

// 2. Add field
if (!content.includes('_paymentGateway;')) {
    content = content.replace(
        '    private readonly ILogger<WebhooksController> _logger;',
        '    private readonly IPaymentGatewayProvider _paymentGateway;\r\n    private readonly ILogger<WebhooksController> _logger;'
    );
}

// 3. Add to constructor
if (!content.includes('IPaymentGatewayProvider paymentGateway')) {
    content = content.replace(
        '        IConfiguration configuration,\r\n        ILogger<WebhooksController> logger)',
        '        IPaymentGatewayProvider paymentGateway,\r\n        IConfiguration configuration,\r\n        ILogger<WebhooksController> logger)'
    );
    content = content.replace(
        '        _configuration = configuration;\r\n        _logger = logger;\r\n    }',
        '        _paymentGateway = paymentGateway;\r\n        _configuration = configuration;\r\n        _logger = logger;\r\n    }'
    );
}

// 4. Add Paymob webhook endpoint
const paymobEndpoint = `
    /// <summary>
    /// Inbound webhook receiver for Paymob payment status callbacks.
    /// Secured via constant-time HMAC-SHA512 signature verification over raw JSON body.
    /// </summary>
    [HttpPost("paymob")]
    [RequestSizeLimit(64 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ProcessPaymobWebhook([FromQuery] string? hmac = null)
    {
        // 1. Read Raw Request Body for Byte-Exact HMAC Verification
        const int maxBodySizeBytes = 64 * 1024;
        if (Request.ContentLength.HasValue && Request.ContentLength.Value > maxBodySizeBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "Payload exceeds maximum allowable size of 64 KB." });
        }

        byte[] rawBodyBytes;
        using (var memoryStream = new MemoryStream())
        {
            var buffer = new byte[8192];
            int bytesRead;
            long totalRead = 0;
            while ((bytesRead = await Request.Body.ReadAsync(buffer, 0, buffer.Length)) > 0)
            {
                totalRead += bytesRead;
                if (totalRead > maxBodySizeBytes)
                {
                    return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "Payload exceeds maximum allowable size of 64 KB." });
                }
                memoryStream.Write(buffer, 0, bytesRead);
            }
            rawBodyBytes = memoryStream.ToArray();
        }

        if (rawBodyBytes.Length == 0)
        {
            return BadRequest(new { error = "Request body cannot be empty." });
        }

        var rawBodyString = Encoding.UTF8.GetString(rawBodyBytes);

        // 2. Extract HMAC from query string or headers
        var receivedHmac = hmac
            ?? Request.Headers["X-Paymob-Signature"].FirstOrDefault()
            ?? Request.Headers["hmac"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(receivedHmac))
        {
            _logger.LogWarning("Paymob webhook rejected: Missing HMAC signature in query string or headers.");
            return Unauthorized(new { error = "Missing HMAC signature." });
        }

        var hmacSecret = _configuration["Payment:Paymob:HmacSecret"]
            ?? _configuration["Payment__Paymob__HmacSecret"]
            ?? "paymob_mock_hmac_secret_512";

        if (!_paymentGateway.VerifyWebhookHmac(rawBodyString, receivedHmac, hmacSecret))
        {
            _logger.LogWarning("Paymob webhook rejected: Invalid HMAC-SHA512 signature.");
            return Unauthorized(new { error = "Invalid webhook HMAC signature." });
        }

        // 3. Deserialize Payload
        PaymobWebhookPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<PaymobWebhookPayload>(rawBodyBytes, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Paymob webhook rejected: Invalid JSON syntax.");
            return BadRequest(new { error = "Invalid JSON payload syntax." });
        }

        if (payload?.Obj == null)
        {
            return BadRequest(new { error = "Invalid Paymob webhook payload structure." });
        }

        _logger.LogInformation("Paymob webhook received: Transaction {TxnId}, Success: {Success}", payload.Obj.Id, payload.Obj.Success);

        if (payload.Obj.Success)
        {
            var merchantOrderId = payload.Obj.Order?.MerchantOrderId;
            if (!string.IsNullOrWhiteSpace(merchantOrderId) && int.TryParse(merchantOrderId, out var orderId))
            {
                var order = await _uow.Orders.GetByIdAsync(orderId);
                if (order != null)
                {
                    order.IsBuyerConfirmed = true;
                    order.ConfirmedAt = DateTime.UtcNow;
                    order.ConfirmationChannel = "Paymob";
                    await _uow.SaveChangesAsync();
                    _logger.LogInformation("Order {OrderId} confirmed via Paymob transaction {TxnId}.", order.Id, payload.Obj.Id);
                }
            }
        }

        return Ok(new { success = true, transactionId = payload.Obj.Id });
    }
`;

if (!content.includes('ProcessPaymobWebhook')) {
    const lastBraceIdx = content.lastIndexOf('}');
    content = content.slice(0, lastBraceIdx) + paymobEndpoint + '\r\n}\r\n';
}

fs.writeFileSync('backend/Marketplace.API/Controllers/WebhooksController.cs', content, 'utf8');
console.log('Successfully updated WebhooksController.cs');
