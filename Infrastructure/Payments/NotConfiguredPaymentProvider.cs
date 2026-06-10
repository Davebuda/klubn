using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;

namespace DJDiP.Infrastructure.Payments
{
    // P3 stub: keeps the DI graph valid until the real VippsPaymentProvider lands in P4.
    // Every operation throws NotImplementedException; nothing calls it at runtime yet
    // (the orchestrator/webhook that would invoke it are P5/P6).
    public sealed class NotConfiguredPaymentProvider : IPaymentProvider
    {
        public string Name => "Vipps";

        private static InvalidOperationException NotReady() =>
            new("Payment provider is not configured yet (pending P4 — Vipps adapter + TEST creds).");

        public Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct)
            => throw NotReady();

        public Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct)
            => throw NotReady();

        public Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
            => throw NotReady();

        public Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
            => throw NotReady();

        public Task CancelAsync(string providerRef, CancellationToken ct)
            => throw NotReady();

        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers)
            => throw NotReady();

        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers)
            => throw NotReady();
    }
}
