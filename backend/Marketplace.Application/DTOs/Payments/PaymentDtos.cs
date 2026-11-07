using System.Text.Json.Serialization;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.DTOs.Payments;

public class PaymentIntentRequest
{
    public int OrderId { get; set; }
    public decimal Amount { get; set; }
    public int AmountCents => (int)Math.Round(Amount * 100m);
    public string Currency { get; set; } = "EGP";
    public string BuyerEmail { get; set; } = string.Empty;
    public string BuyerPhone { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Card;
}

public class PaymentIntentResult
{
    public bool Success { get; set; }
    public string? TransactionId { get; set; }
    public string? ClientSecret { get; set; }
    public string? PaymentUrl { get; set; }
    public string? PaymentToken { get; set; }
    public string? ErrorMessage { get; set; }
}

public class RefundRequest
{
    public string TransactionId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int AmountCents => (int)Math.Round(Amount * 100m);
    public string? Reason { get; set; }
}

public class RefundResult
{
    public bool Success { get; set; }
    public string? RefundId { get; set; }
    public string? ErrorMessage { get; set; }
}

public class PaymobWebhookPayload
{
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("obj")]
    public PaymobTransactionObj? Obj { get; set; }
}

public class PaymobTransactionObj
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("amount_cents")]
    public int AmountCents { get; set; }

    [JsonPropertyName("currency")]
    public string? Currency { get; set; }

    [JsonPropertyName("txn_response_code")]
    public string? TxnResponseCode { get; set; }

    [JsonPropertyName("order")]
    public PaymobOrderObj? Order { get; set; }
}

public class PaymobOrderObj
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("merchant_order_id")]
    public string? MerchantOrderId { get; set; }
}
