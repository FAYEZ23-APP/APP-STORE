using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Notifications;

public class ConsoleSmsSender : ISmsSender
{
    private readonly IFakeMessageStore _messageStore;
    private readonly ILogger<ConsoleSmsSender> _logger;

    public ConsoleSmsSender(IFakeMessageStore messageStore, ILogger<ConsoleSmsSender> logger)
    {
        _messageStore = messageStore;
        _logger = logger;
    }

    public Task SendVerificationSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _messageStore.RecordCode(toPhone, code, "Verify");
        var msg = $"رمز التحقق الخاص بك في سوق مصر هو: {code} (صالح لمدة {(int)expiry.TotalMinutes} دقائق). إذا لم تطلبه تجاهل هذه الرسالة.";
        _logger.LogInformation("[VERIFICATION SMS] To: {Phone} | CODE: {Code} (message body omitted). Use GET /api/dev/auth/last-code in Development.", LogMasking.MaskPhone(toPhone), LogMasking.MaskCode(code));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _messageStore.RecordCode(toPhone, code, "ResetPassword");
        var msg = $"رمز إعادة تعيين كلمة المرور في سوق مصر هو: {code} (صالح لمدة {(int)expiry.TotalMinutes} دقائق). إذا لم تطلبه تجاهل هذه الرسالة.";
        _logger.LogInformation("[PASSWORD RESET SMS] To: {Phone} | CODE: {Code} (message body omitted). Use GET /api/dev/auth/last-code in Development.", LogMasking.MaskPhone(toPhone), LogMasking.MaskCode(code));
        return Task.CompletedTask;
    }

    public Task SendSmsAsync(string toPhone, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[ConsoleSmsSender] SMS to {Phone} dispatched (body omitted from logs, {Length} chars).", LogMasking.MaskPhone(toPhone), message?.Length ?? 0);
        return Task.CompletedTask;
    }
}
