namespace DJDiP.Application.Services
{
    // Bound from configuration section "Qr" (env key Qr__SigningSecret).
    // The HMAC-SHA256 signing secret for door-scan QR tokens. MUST be a strong random
    // value set via gitignored .env in prod; never commit a real secret. Rotating this
    // invalidates all previously issued (un-scanned) tickets, so rotate deliberately.
    public sealed class QrOptions
    {
        public const string SectionName = "Qr";

        public string SigningSecret { get; set; } = string.Empty;
    }
}
