using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DiscountType
{
    Percentage,
    FixedAmount
}
