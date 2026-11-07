namespace Marketplace.Application.Interfaces;

public class FulfillmentSlaCheckResult
{
    public int WarningsSent { get; set; }
    public int AutoCancelled { get; set; }
}

public interface IFulfillmentSlaService
{
    Task<FulfillmentSlaCheckResult> CheckAndEnforceSlaAsync(CancellationToken cancellationToken = default);
}
