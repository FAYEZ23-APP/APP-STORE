using Marketplace.Application.DTOs.Payments;

namespace Marketplace.Application.Interfaces;

public interface IPaymentGatewayProvider
{
    Task<PaymentIntentResult> CreatePaymentIntentAsync(PaymentIntentRequest request, CancellationToken cancellationToken = default);
    bool VerifyWebhookHmac(string rawBody, string receivedHmac, string hmacSecret);
    Task<RefundResult> ProcessRefundAsync(RefundRequest request, CancellationToken cancellationToken = default);
}
