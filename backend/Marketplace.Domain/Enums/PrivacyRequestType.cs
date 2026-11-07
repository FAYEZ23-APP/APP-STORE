using System.Text.Json.Serialization;

namespace Marketplace.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PrivacyRequestType
{
    AccessExport = 1,
    AccountDeletion = 2,
    Rectification = 3,
    ConsentWithdrawal = 4,
    ProcessingRestriction = 5
}
