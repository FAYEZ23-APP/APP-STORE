using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReturnCategory
{
    Standard14Day = 1,
    ManufacturingDefect30Day = 2
}
