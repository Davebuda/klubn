namespace DJDiP.Domain.Models
{
    // Inbound webhook dedup table (at-least-once delivery). Layer-1 idempotency for
    // the payments webhook (P6): a duplicate delivery hits the UNIQUE
    // (Provider, ProviderPspReference, EventType) index → DbUpdateException → 200 no-op,
    // mirroring the IngestController unique-index idempotency lesson.
    // Architecture: docs/design/ticketing-vipps-architecture.md §2 / §4.
    public class PaymentWebhookEvent
    {
        public Guid Id { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string ProviderPspReference { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    }
}
