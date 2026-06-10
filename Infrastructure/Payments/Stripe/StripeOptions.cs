namespace DJDiP.Infrastructure.Payments.Stripe
{
    // Bound from configuration section "Stripe" (env keys Stripe__SecretKey, etc.).
    // Stripe is the third IPaymentProvider behind the same seam as Vipps/Sandbox —
    // adding it required ZERO domain or orchestration changes (design §3, L2).
    //
    // Privacy note (design §8.5 / GDPR data-minimization): the only buyer-adjacent
    // value Stripe sees is the order reference (carried as client_reference_id /
    // metadata) plus the optional customer email Stripe needs to email a receipt.
    // No profile scopes beyond that. Secrets live in gitignored .env only; never
    // commit real values.
    public sealed class StripeOptions
    {
        public const string SectionName = "Stripe";

        // Secret API key (sk_test_… / sk_live_…). Used as the Stripe API bearer.
        public string SecretKey { get; set; } = string.Empty;

        // Endpoint signing secret (whsec_…) returned when the webhook endpoint is
        // registered in the Stripe Dashboard / CLI. Used to verify Stripe-Signature.
        public string WebhookSecret { get; set; } = string.Empty;

        // Publishable key (pk_test_… / pk_live_…). Not used server-side for the hosted
        // Checkout redirect flow, but bound here so the frontend build can read it from
        // one source of truth and so a future Payment Element flow has it ready.
        public string PublishableKey { get; set; } = string.Empty;
    }
}
