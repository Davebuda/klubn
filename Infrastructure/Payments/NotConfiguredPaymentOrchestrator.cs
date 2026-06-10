using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;

namespace DJDiP.Infrastructure.Payments
{
    // P3 stub: keeps DI valid until the real PaymentOrchestrator (create + finalize
    // paths) is implemented in P5/P6. No resolver invokes it yet.
    public sealed class NotConfiguredPaymentOrchestrator : IPaymentOrchestrator
    {
        private static InvalidOperationException NotReady() =>
            new("Payment orchestrator is not implemented yet (pending P5 checkout / P6 webhook).");

        public Task<CreatePaymentResult> CreatePaymentAsync(
            Guid eventId,
            IReadOnlyList<OrderLineRequest> lines,
            string? customerEmail,
            string? actingUserId,
            string? promoCode,
            string? provider,
            CancellationToken ct)
            => throw NotReady();

        public Task<CreatePaymentResult> RetryPaymentAsync(
            string reference,
            string? provider,
            string actingUserId,
            CancellationToken ct)
            => throw NotReady();

        public Task FinalizeAsync(PaymentEvent paymentEvent, CancellationToken ct, string? viaProvider = null)
            => throw NotReady();
    }
}
