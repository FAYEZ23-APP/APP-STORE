using Marketplace.Application.DTOs.Payments;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.DTOs.Webhooks;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/webhooks")]
public class WebhooksController : ControllerBase
{
    private readonly IWebhookSecurityService _webhookSecurity;
    private readonly IShipmentService _shipmentService;
    private readonly ISsrfProtectionService _ssrfService;
    private readonly IUnitOfWork _uow;
    private readonly IConfiguration _configuration;
    private readonly IPaymentGatewayProvider _paymentGateway;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        IWebhookSecurityService webhookSecurity,
        IShipmentService shipmentService,
        ISsrfProtectionService ssrfService,
        IUnitOfWork uow,
        IPaymentGatewayProvider paymentGateway,
        IConfiguration configuration,
        ILogger<WebhooksController> logger)
    {
        _webhookSecurity = webhookSecurity;
        _shipmentService = shipmentService;
        _ssrfService = ssrfService;
        _uow = uow;
        _paymentGateway = paymentGateway;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Inbound webhook receiver for Bosta shipping status callbacks.
    /// Secured via HMAC-SHA256 signature verification over the exact raw body.
    /// </summary>
    [HttpPost("bosta")]
    [RequestSizeLimit(64 * 1024)] // 64 KB limit
    [ProducesResponseType(typeof(BostaWebhookResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> ProcessBostaWebhook()
    {
        // 1. Content-Type Validation
        if (!Request.HasJsonContentType())
        {
            return BadRequest(new { error = "Unsupported Media Type. Content-Type must be application/json." });
        }

        // 2. Read Raw Request Body for Byte-Exact HMAC Verification (Max 64 KB)
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

        // 3. Signature Header Verification
        var signatureHeader = Request.Headers["X-Bosta-Signature"].FirstOrDefault()
            ?? Request.Headers["x-bosta-signature"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            _logger.LogWarning("Bosta webhook rejected: Missing X-Bosta-Signature header.");
            return Unauthorized(new { error = "Missing signature header (X-Bosta-Signature is required)." });
        }

        var webhookSecret = _configuration["Bosta:WebhookSecret"]
            ?? _configuration["Bosta__WebhookSecret"]
            ?? "bosta-webhook-secret-key-phase11";

        if (!_webhookSecurity.VerifyBostaSignature(rawBodyBytes, signatureHeader, webhookSecret))
        {
            _logger.LogWarning("Bosta webhook rejected: Invalid HMAC signature.");
            return Unauthorized(new { error = "Invalid webhook HMAC signature." });
        }

        // 4. Deserialization & Schema Validation
        BostaWebhookPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<BostaWebhookPayload>(rawBodyBytes, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Bosta webhook rejected: Invalid JSON syntax.");
            return BadRequest(new { error = "Invalid JSON payload syntax." });
        }

        if (payload == null)
        {
            return BadRequest(new { error = "Invalid webhook payload schema." });
        }

        var trackingNumber = payload.GetEffectiveTrackingNumber();
        var rawState = payload.GetEffectiveState();

        if (string.IsNullOrWhiteSpace(trackingNumber) || string.IsNullOrWhiteSpace(rawState))
        {
            return BadRequest(new { error = "TrackingNumber and State are mandatory webhook properties." });
        }

        // 5. Timestamp Replay Validation
        DateTime? timestamp = payload.Timestamp;
        if (!timestamp.HasValue && Request.Headers.TryGetValue("X-Bosta-Timestamp", out var tsHeader))
        {
            var tsStr = tsHeader.ToString().Trim();
            if (long.TryParse(tsStr, out var epoch))
            {
                timestamp = epoch > 10000000000L
                    ? DateTimeOffset.FromUnixTimeMilliseconds(epoch).UtcDateTime
                    : DateTimeOffset.FromUnixTimeSeconds(epoch).UtcDateTime;
            }
            else if (DateTime.TryParse(tsStr, out var parsedTs))
            {
                timestamp = parsedTs;
            }
        }

        if (timestamp.HasValue)
        {
            if (!_webhookSecurity.VerifyTimestamp(timestamp.Value, maxAgeSeconds: 300))
            {
                _logger.LogWarning("Bosta webhook rejected: Expired or invalid timestamp ({Timestamp}).", timestamp.Value);
                return BadRequest(new { error = "Webhook timestamp has expired or exceeds allowable clock drift." });
            }
        }

        // 6. Idempotency & Duplicate Replay Check
        var eventId = payload.GetEffectiveEventId();
        if (await _webhookSecurity.IsEventProcessedAsync("Bosta", eventId))
        {
            _logger.LogInformation("Bosta webhook event {EventId} previously processed. Returning 200 OK idempotently.", eventId);
            return Ok(new BostaWebhookResponse
            {
                Success = true,
                Message = "Event already processed (idempotent acknowledge)",
                EventId = eventId,
                TrackingNumber = trackingNumber
            });
        }

        // 7. Verify Referenced Shipment
        var shipment = (await _uow.Shipments.FindAsync(s => s.TrackingNumber == trackingNumber)).FirstOrDefault();
        if (shipment == null)
        {
            _logger.LogWarning("Bosta webhook references nonexistent shipment tracking number '{TrackingNumber}'.", trackingNumber);
            return NotFound(new { error = $"Shipment with tracking number '{trackingNumber}' not found." });
        }

        // 8. Map Bosta State to Platform ShipmentStatus
        var normalizedState = rawState.Trim().ToUpperInvariant();
        ShipmentStatus targetStatus;
        ReturnReason returnReason = ReturnReason.RefusedByBuyer;

        switch (normalizedState)
        {
            case "DELIVERED":
            case "SUCCESSFUL":
                targetStatus = ShipmentStatus.Delivered;
                break;

            case "RETURNED_TO_BUSINESS":
            case "CANCELLED":
            case "FAILED":
            case "EXCEPTION":
            case "RETURNED":
                targetStatus = ShipmentStatus.Returned;
                if (!string.IsNullOrWhiteSpace(payload.Reason) &&
                    Enum.TryParse<ReturnReason>(payload.Reason.Trim(), true, out var parsedReason))
                {
                    returnReason = parsedReason;
                }
                break;

            case "IN_TRANSIT":
            case "PICKED_UP":
            case "WAITING_FOR_ROUTE":
                targetStatus = ShipmentStatus.InTransit;
                break;

            case "OUT_FOR_DELIVERY":
            case "READY_FOR_PICKUP":
                targetStatus = ShipmentStatus.ReadyForPickup;
                break;

            default:
                _logger.LogWarning("Bosta webhook received unmapped state '{State}'.", normalizedState);
                return BadRequest(new { error = $"Unrecognized carrier shipment state '{rawState}'." });
        }

        // 9. Execute Authorized State Transition via Business Service
        try
        {
            await _shipmentService.UpdateCarrierShipmentStatusAsync(shipment.Id, new UpdateShipmentStatusRequest
            {
                Status = targetStatus.ToString(),
                ReturnReason = targetStatus == ShipmentStatus.Returned ? returnReason.ToString() : null,
                TrackingNumber = trackingNumber
            });
        }
        catch (Marketplace.Application.Exceptions.BadRequestException ex)
        {
            // State machine violation (e.g. out-of-order transition from Delivered -> InTransit)
            _logger.LogWarning("Bosta webhook state transition rejected by state machine: {Message}", ex.Message);
            return BadRequest(new { error = ex.Message });
        }

        // 10. Record Event Idempotency in Database
        var payloadHash = Convert.ToHexString(SHA256.HashData(rawBodyBytes));
        await _webhookSecurity.TryRecordProcessedEventAsync(new ProcessedWebhookEvent
        {
            Provider = "Bosta",
            EventId = eventId,
            EventType = normalizedState,
            TrackingNumber = trackingNumber,
            ShipmentId = shipment.Id,
            PayloadHash = payloadHash,
            Status = "Processed",
            ProcessedAt = DateTime.UtcNow
        });

        // 11. Write Audit Log
        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = null,
            Action = "BostaWebhookProcessed",
            EntityType = "Shipment",
            EntityId = shipment.Id.ToString(),
            Details = $"Bosta webhook {eventId} transitioned shipment #{shipment.Id} (AWB: {trackingNumber}) to {targetStatus}.",
            CreatedAt = DateTime.UtcNow
        });
        await _uow.SaveChangesAsync();

        _logger.LogInformation("Bosta webhook {EventId} processed successfully for shipment #{ShipmentId}.", eventId, shipment.Id);

        return Ok(new BostaWebhookResponse
        {
            Success = true,
            Message = "Webhook processed successfully",
            EventId = eventId,
            TrackingNumber = trackingNumber,
            ResultingStatus = targetStatus.ToString()
        });
    }

    /// <summary>
    /// SSRF Destination Validation and Safe Outbound Fetch Endpoint.
    /// Validates URLs against internal networks, private IPs, loopback, and cloud metadata.
    /// </summary>
    [HttpPost("ssrf/verify-url")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyExternalUrl([FromBody] JsonElement body)
    {
        if (!body.TryGetProperty("url", out var urlProp) || string.IsNullOrWhiteSpace(urlProp.GetString()))
        {
            return BadRequest(new { error = "Property 'url' is required." });
        }

        var url = urlProp.GetString()!.Trim();

        // 1. Syntactic & Scheme Validation
        if (!_ssrfService.IsValidExternalUrl(url, out var uri, out var syntaxError))
        {
            return BadRequest(new { isSafe = false, error = syntaxError });
        }

        // 2. DNS & IP Destination Validation
        var (isSafe, destError) = await _ssrfService.IsSafeDestinationAsync(uri!);
        if (!isSafe)
        {
            return BadRequest(new { isSafe = false, error = destError });
        }

        // 3. Optional Safe HTTP Fetch (using SSRF-protected socket handler)
        bool tryFetch = body.TryGetProperty("fetch", out var fetchProp) && fetchProp.GetBoolean();
        if (tryFetch)
        {
            try
            {
                using var client = _ssrfService.CreateSafeHttpClient(TimeSpan.FromSeconds(3));
                using var response = await client.GetAsync(uri);
                return Ok(new
                {
                    isSafe = true,
                    message = "URL is safe and reachable",
                    statusCode = (int)response.StatusCode
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    isSafe = false,
                    error = $"Outbound fetch failed: {ex.Message}"
                });
            }
        }

        return Ok(new
        {
            isSafe = true,
            message = "URL passed all SSRF destination checks",
            host = uri!.Host,
            port = uri.Port,
            scheme = uri.Scheme
        });
    }


    /// <summary>
    /// Generic Carrier webhook receiver secured via HMAC-SHA256 signature (X-Carrier-Signature).
    /// </summary>
    [HttpPost("carrier")]
    [RequestSizeLimit(64 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ProcessCarrierWebhook()
    {
        if (!Request.HasJsonContentType())
            return BadRequest(new { error = "Unsupported Media Type. Content-Type must be application/json." });

        byte[] rawBodyBytes;
        using (var ms = new MemoryStream())
        {
            await Request.Body.CopyToAsync(ms);
            rawBodyBytes = ms.ToArray();
        }

        if (rawBodyBytes.Length == 0)
            return BadRequest(new { error = "Request body cannot be empty." });

        var signatureHeader = Request.Headers["X-Carrier-Signature"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(signatureHeader))
            return Unauthorized(new { error = "Missing signature header (X-Carrier-Signature is required)." });

        var webhookSecret = _configuration["Delivery:WebhookSecret"]
            ?? _configuration["Carrier:DevSecret"]
            ?? "test-webhook-secret-wave2";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
        var computedHash = hmac.ComputeHash(rawBodyBytes);
        var computedHex = Convert.ToHexString(computedHash);

        byte[] providedBytes;
        try { providedBytes = Convert.FromHexString(signatureHeader); }
        catch { return Unauthorized(new { error = "Invalid signature encoding." }); }

        if (!CryptographicOperations.FixedTimeEquals(computedHash, providedBytes))
        {
            _logger.LogWarning("Carrier webhook rejected: Invalid HMAC signature.");
            return Unauthorized(new { error = "Invalid carrier webhook HMAC signature." });
        }

        using var doc = JsonDocument.Parse(rawBodyBytes);
        var root = doc.RootElement;
        string? trackingNumber = root.TryGetProperty("trackingNumber", out var tn) ? tn.GetString() : null;
        string? rawState = root.TryGetProperty("status", out var st) ? st.GetString() : null;
        int? shipmentId = root.TryGetProperty("shipmentId", out var sid) && sid.TryGetInt32(out var idVal) ? idVal : null;

        Shipment? shipment = null;
        if (shipmentId.HasValue)
            shipment = await _uow.Shipments.GetByIdAsync(shipmentId.Value);
        else if (!string.IsNullOrWhiteSpace(trackingNumber))
            shipment = (await _uow.Shipments.FindAsync(s => s.TrackingNumber == trackingNumber)).FirstOrDefault();

        if (shipment == null)
            return NotFound(new { error = "Shipment not found." });

        if (!string.IsNullOrWhiteSpace(rawState) && Enum.TryParse<ShipmentStatus>(rawState, true, out var targetStatus))
        {
            await _shipmentService.UpdateCarrierShipmentStatusAsync(shipment.Id, new UpdateShipmentStatusRequest
            {
                Status = targetStatus.ToString(),
                TrackingNumber = trackingNumber ?? shipment.TrackingNumber
            });
        }

        return Ok(new { success = true, shipmentId = shipment.Id, status = shipment.Status.ToString() });
    }

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

}
