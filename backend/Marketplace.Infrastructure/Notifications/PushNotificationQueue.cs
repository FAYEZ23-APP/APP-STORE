using System.Threading.Channels;
using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.Interfaces;

namespace Marketplace.Infrastructure.Notifications;

public class PushNotificationQueue : IPushNotificationQueue
{
    private readonly Channel<PushNotificationJob> _channel;

    public PushNotificationQueue(int capacity = 1000)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        };
        _channel = Channel.CreateBounded<PushNotificationJob>(options);
    }

    public ValueTask EnqueueAsync(PushNotificationJob job, CancellationToken cancellationToken = default)
    {
        if (job.DeviceTokens == null || !job.DeviceTokens.Any())
            return ValueTask.CompletedTask;

        return _channel.Writer.WriteAsync(job, cancellationToken);
    }

    public IAsyncEnumerable<PushNotificationJob> ReadAllAsync(CancellationToken cancellationToken = default)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }
}
