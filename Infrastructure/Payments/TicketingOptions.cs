namespace DJDiP.Infrastructure.Payments
{
    // Bound from configuration section "Ticketing". Orchestration knobs that are
    // provider-agnostic (apply equally to Sandbox / Vipps / Stripe).
    public sealed class TicketingOptions
    {
        public const string SectionName = "Ticketing";

        // Where the payment provider redirects the buyer back to after the off-site
        // payment step. The order Reference is appended as ?ref=...
        public string CheckoutReturnUrl { get; set; } = "http://localhost:5173/checkout/return";

        // How long an inventory hold stands before the sweeper may expire it.
        public int HoldMinutes { get; set; } = 10;

        // QR tokens expire this many hours after the event's start (design §7 — tokens
        // are time-boxed to the event). Events have no explicit end time in the model.
        public int QrExpiryBufferHours { get; set; } = 12;

        // How often the TicketHoldSweeper scans for abandoned checkouts.
        public int SweepIntervalSeconds { get; set; } = 60;

        // Extra slack past HoldExpiresAt before a hold is swept. Protects a buyer who
        // is mid-payment right at the expiry boundary.
        public int SweepGraceMinutes { get; set; } = 2;
    }
}
