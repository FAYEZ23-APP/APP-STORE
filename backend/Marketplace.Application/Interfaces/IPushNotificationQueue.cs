using Marketplace.Application.DTOs.Notifications;

namespace Marketplace.Application.Interfaces;

public interface IPushNotificationQueue
{
    ValueTask EnqueueAsync(PushNotificationJob job, CancellationToken cancellationToken = default);
    IAsyncEnumerable<PushNotificationJob> ReadAllAsync(CancellationToken cancellationToken = default);
}
