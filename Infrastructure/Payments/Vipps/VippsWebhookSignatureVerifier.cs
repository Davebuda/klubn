using System.Security.Cryptography;
using System.Text;

namespace DJDiP.Infrastructure.Payments.Vipps
{
    // Vipps MobilePay webhook request authentication (P4), verified against
    // developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication/
    // (fetched 2026-06-10):
    //
    //   Headers:  x-ms-date, x-ms-content-sha256 = base64(SHA256(rawBody)), host,
    //             Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<b64>
    //   String-to-sign (LF, not CRLF):
    //             POST\n{pathAndQuery}\n{x-ms-date};{host};{x-ms-content-sha256}
    //   Key:      UTF-8 bytes of the secret returned at webhook registration
    //             (matches Vipps' official .NET sample).
    //
    // The webhook controller (P6) must pass the request path+query via the
    // pseudo-header "x-request-path-and-query" because IPaymentProvider's
    // signature-verification seam only carries (rawBody, headers).
    //
    // All comparisons are constant-time (FixedTimeEquals) — same posture as
    // IngestController.SecretValid.
    public sealed class VippsWebhookSignatureVerifier
    {
        public const string PathPseudoHeader = "x-request-path-and-query";

        private readonly byte[] _secretKey;

        public VippsWebhookSignatureVerifier(string webhookSecret)
        {
            _secretKey = Encoding.UTF8.GetBytes(webhookSecret ?? string.Empty);
        }

        public bool Verify(string rawBody, IDictionary<string, string> headers)
        {
            if (_secretKey.Length == 0 || headers is null) return false;

            if (!TryGet(headers, "x-ms-date", out var date) ||
                !TryGet(headers, "x-ms-content-sha256", out var contentHash) ||
                !TryGet(headers, "host", out var host) ||
                !TryGet(headers, "authorization", out var authorization) ||
                !TryGet(headers, PathPseudoHeader, out var pathAndQuery))
                return false;

            // 1. The body hash header must match base64(SHA256(rawBody)).
            var computedHash = Convert.ToBase64String(
                SHA256.HashData(Encoding.UTF8.GetBytes(rawBody ?? string.Empty)));
            if (!FixedTimeEqualsUtf8(computedHash, contentHash)) return false;

            // 2. Recompute the signature over the documented string-to-sign.
            var stringToSign = $"POST\n{pathAndQuery}\n{date};{host};{contentHash}";
            using var hmac = new HMACSHA256(_secretKey);
            var expected = Convert.ToBase64String(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign)));

            // 3. Compare against the Signature=<b64> portion of the Authorization header.
            var provided = ExtractSignature(authorization);
            return provided is not null && FixedTimeEqualsUtf8(expected, provided);
        }

        // "HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<b64>"
        internal static string? ExtractSignature(string authorization)
        {
            if (string.IsNullOrWhiteSpace(authorization)) return null;
            const string marker = "&Signature=";
            var idx = authorization.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return null;
            var sig = authorization[(idx + marker.Length)..].Trim();
            return sig.Length == 0 ? null : sig;
        }

        private static bool FixedTimeEqualsUtf8(string a, string b)
            => CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

        private static bool TryGet(IDictionary<string, string> headers, string name, out string value)
        {
            foreach (var kv in headers)
            {
                if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrEmpty(kv.Value))
                {
                    value = kv.Value;
                    return true;
                }
            }
            value = string.Empty;
            return false;
        }
    }
}
