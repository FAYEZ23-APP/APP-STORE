using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReturnStatus
{
    Pending,
    Approved,
    Rejected,
    Completed
}
