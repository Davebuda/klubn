namespace DJDiP.Domain.Models
{
    public class Payment
    {
        public Guid Id { get; set; }
        public Guid OrderId { get; set; }
        public Order Order { get; set; } = null!;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "NOK";
        public string PaymentMethod { get; set; } = null!;

        // TransactionId is retained; for provider-backed payments its semantics fold into
        // ProviderPspReference (the PSP-side reference). Kept for backward compatibility.
        public string? TransactionId { get; set; }


        public Guid? PromotionCodeId { get; set; }
        public PromotionCode? PromotionCode { get; set; }

        public DateTime PaymentDate { get; set; }
        public PaymentStatus Status { get; set; }

        // Ticketing/Vipps — provider-agnostic seam (P2-T4, design §2/L2).
        public string Provider { get; set; } = "Vipps";          // "Vipps" | "Stripe" (later)
        public string ProviderReference { get; set; } = string.Empty; // == Order.Reference; UNIQUE
        public string? ProviderPspReference { get; set; }        // Vipps pspReference / Stripe charge id
        public string? IdempotencyKey { get; set; }              // reused for capture/refund retries

        // Mirror the PSP aggregate amounts (minor units, øre).
        public long AuthorizedAmountMinor { get; set; } = 0;
        public long CapturedAmountMinor { get; set; } = 0;
        public long RefundedAmountMinor { get; set; } = 0;

        public DateTime? LastSyncedAt { get; set; }              // last webhook/poll reconciliation
    }
}
