using System.Text.Json.Serialization;

namespace Marketplace.Application.DTOs.Webhooks;

public class BostaWebhookPayload
{
    [JsonPropertyName("_id")]
    public string? Id { get; set; }

    [JsonPropertyName("eventId")]
    public string? EventId { get; set; }

    [JsonPropertyName("deliveryId")]
    public string? DeliveryId { get; set; }

    [JsonPropertyName("trackingNumber")]
    public string? TrackingNumber { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("timestamp")]
    public DateTime? Timestamp { get; set; }

    [JsonPropertyName("reason")]
    public string? Reason { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }

    [JsonPropertyName("codAmount")]
    public decimal? CodAmount { get; set; }

    [JsonPropertyName("data")]
    public BostaWebhookData? Data { get; set; }

    public string GetEffectiveEventId() =>
        !string.IsNullOrWhiteSpace(EventId) ? EventId.Trim() :
        (!string.IsNullOrWhiteSpace(Id) ? Id.Trim() :
        (!string.IsNullOrWhiteSpace(Data?.Id) ? Data.Id.Trim() :
        $"{GetEffectiveTrackingNumber()}:{GetEffectiveState()}:{Timestamp:O}"));

    public string? GetEffectiveTrackingNumber() =>
        !string.IsNullOrWhiteSpace(TrackingNumber) ? TrackingNumber.Trim() : Data?.TrackingNumber?.Trim();

    public string? GetEffectiveState() =>
        !string.IsNullOrWhiteSpace(State) ? State.Trim() :
        (!string.IsNullOrWhiteSpace(Status) ? Status.Trim() : Data?.State?.Trim() ?? Data?.Status?.Trim());
}

public class BostaWebhookData
{
    [JsonPropertyName("_id")]
    public string? Id { get; set; }

    [JsonPropertyName("trackingNumber")]
    public string? TrackingNumber { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }
}

public class BostaWebhookResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? EventId { get; set; }
    public string? TrackingNumber { get; set; }
    public string? ResultingStatus { get; set; }
}
