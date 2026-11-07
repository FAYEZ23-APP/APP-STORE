namespace Marketplace.Application.Interfaces;

public interface IWhatsAppNotificationSender
{
    Task<bool> SendTemplateNotificationAsync(
        string toPhone,
        string templateName,
        Dictionary<string, string> parameters,
        CancellationToken cancellationToken = default);
}
