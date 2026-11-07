using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum IncidentStatus
{
    UnderInvestigation = 1,
    Contained = 2,
    ReportedToCenter = 3,
    Resolved = 4
}
