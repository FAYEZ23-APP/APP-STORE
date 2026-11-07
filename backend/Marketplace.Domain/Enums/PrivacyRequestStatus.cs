using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PrivacyRequestStatus
{
    Requested = 1,
    IdentityVerified = 2,
    PendingReview = 3,
    Approved = 4,
    Processing = 5,
    Completed = 6,
    Rejected = 7,
    LegalHold = 8
}
