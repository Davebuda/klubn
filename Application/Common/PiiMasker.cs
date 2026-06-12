namespace DJDiP.Application.Common
{
    // P0-WS3C (GDPR operationalization). Masks email addresses before they reach any log
    // sink so common flows (email send/failure/disabled, order confirmation) never persist a
    // raw address (GDPR data-minimization; logs are a retained, lower-controlled surface).
    //
    // Style: first char of the local part + "***@" + domain, e.g. "john@klubn.no" -> "j***@klubn.no".
    // Edge cases are handled conservatively — when the input isn't a recognizable address we
    // still emit a non-identifying token, never the raw value.
    public static class PiiMasker
    {
        // Mask an email to "x***@domain". Null/whitespace -> "(none)". A value with no '@'
        // (not an email) is masked as "***" so we never leak it verbatim. A single-char or
        // empty local part still collapses to "***@domain" (no information about the local part).
        public static string MaskEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return "(none)";

            var trimmed = email.Trim();
            var at = trimmed.IndexOf('@');

            // No '@' — not an address shape; don't echo it back.
            if (at <= 0 || at == trimmed.Length - 1)
                return "***";

            var local = trimmed[..at];
            var domain = trimmed[(at + 1)..];

            // Keep only the first char of the local part; the rest is always "***".
            var firstChar = local[0];
            return $"{firstChar}***@{domain}";
        }
    }
}
