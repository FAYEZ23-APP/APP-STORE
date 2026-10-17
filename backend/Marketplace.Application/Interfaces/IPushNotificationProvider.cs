namespace Marketplace.Application.Interfaces;

public interface IPushNotificationProvider
{
    Task<bool> SendPushAsync(string deviceToken, string title, string body, Dictionary<string, string>? data = null);
    Task<int> SendMulticastPushAsync(IEnumerable<string> deviceTokens, string title, string body, Dictionary<string, string>? data = null);
}
