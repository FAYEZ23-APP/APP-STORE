using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Marketplace.Application.Templates;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Notifications;

public class ConsoleEmailSender : IEmailSender
{
    private readonly IFakeMessageStore _messageStore;
    private readonly ILogger<ConsoleEmailSender> _logger;

    public ConsoleEmailSender(IFakeMessageStore messageStore, ILogger<ConsoleEmailSender> logger)
    {
        _messageStore = messageStore;
        _logger = logger;
    }

    public Task SendVerificationEmailAsync(string toEmail, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _messageStore.RecordCode(toEmail, code, "Verify");
        var (subject, plainText, html) = EmailTemplates.VerificationCode(code, (int)expiry.TotalMinutes);
        _logger.LogInformation("[VERIFICATION OTP] To: {Email} | CODE: {Code} (expires in {Minutes}m). Use GET /api/dev/auth/last-code in Development.", LogMasking.MaskEmail(toEmail), LogMasking.MaskCode(code), (int)expiry.TotalMinutes);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _messageStore.RecordCode(toEmail, code, "ResetPassword");
        var (subject, plainText, html) = EmailTemplates.PasswordResetCode(code, (int)expiry.TotalMinutes);
        _logger.LogInformation("[PASSWORD RESET OTP] To: {Email} | CODE: {Code} (expires in {Minutes}m). Use GET /api/dev/auth/last-code in Development.", LogMasking.MaskEmail(toEmail), LogMasking.MaskCode(code), (int)expiry.TotalMinutes);
        return Task.CompletedTask;
    }

    public Task SendEmailAsync(string toEmail, string subject, string plainTextBody, string htmlBody, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[ConsoleEmailSender] Email to {Email} dispatched (body omitted from logs, {Length} chars).", LogMasking.MaskEmail(toEmail), plainTextBody?.Length ?? 0);
        return Task.CompletedTask;
    }
}
