namespace DJDiP.Infrastructure.Payments.Vipps
{
    // Bound from configuration section "Vipps" (env keys Vipps__ClientId, etc.).
    // Plumbing only (P3-T4); real values arrive with Vipps TEST creds (P4).
    //
    // Privacy note (design §8.5): only the minimal personal data is ever stored
    // (CustomerEmail, name if logged in, amount, ticket type, timestamps). NO Vipps
    // profile scopes, NO phone, NO address. Secrets live in gitignored .env only;
    // never commit real values. See architecture §8 (GDPR / data-minimization).
    public sealed class VippsOptions
    {
        public const string SectionName = "Vipps";

        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public string SubscriptionKey { get; set; } = string.Empty;
        public string Msn { get; set; } = string.Empty;            // Merchant Serial Number
        public string BaseUrl { get; set; } = "https://apitest.vipps.no";
        public string WebhookSecret { get; set; } = string.Empty;
        public string SystemName { get; set; } = "klubn";
    }
}
