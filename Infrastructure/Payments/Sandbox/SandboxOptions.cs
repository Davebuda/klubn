namespace DJDiP.Infrastructure.Payments.Sandbox
{
    // Bound from configuration section "Sandbox". The Sandbox provider lets the FULL
    // checkout -> reserve -> capture -> issue -> QR flow run end-to-end with NO Vipps
    // credentials. When real Vipps TEST creds land (P4), VippsPaymentProvider is
    // registered by Name instead and this provider is no longer selected — zero
    // changes to the orchestrator or domain.
    public sealed class SandboxOptions
    {
        public const string SectionName = "Sandbox";

        // HMAC-SHA256 secret used to verify the simulated webhook signature.
        public string WebhookSecret { get; set; } = "sandbox-webhook-secret";
    }
}
