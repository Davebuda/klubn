using System.Security.Cryptography;
using System.Text;

namespace DJDiP.Infrastructure.Payments.Stripe
{
    // Stripe webhook request authentication, verified against
    // docs.stripe.com/webhooks#verify-manually (fetched 2026-06-10):
    //
    //   Header:  Stripe-Signature: t=<unix-ts>,v1=<hex-hmac>[,v0=<hex-hmac>]…
    //   signed_payload = "{t}.{rawBody}"
    //   expected = hex( HMAC-SHA256(key = whsec_ secret bytes, msg = signed_payload) )
    //   Compare `expected` against EACH v1 signature constant-time; ignore all
    //   non-v1 schemes (the v0 scheme is a fake test signature → downgrade-attack
    //   protection). Reject if |now - t| > tolerance (Stripe's SDK default 300s).
    //
    // We hand-roll this (rather than Stripe.net's EventUtility.ConstructEvent) so the
    // verify step matches IPaymentProvider's (rawBody, headers) seam exactly and stays
    // independent of the SDK's static StripeConfiguration — same posture as
    // VippsWebhookSignatureVerifier. All comparisons are constant-time (FixedTimeEquals),
    // mirroring IngestController.SecretValid.
    public sealed class StripeWebhookSignatureVerifier
    {
        public const string SignatureHeader = "Stripe-Signature";

        // Stripe.net's default replay tolerance (EventUtility.DefaultTimeTolerance).
        public const long DefaultToleranceSeconds = 300;

        private readonly byte[] _secretKey;
        private readonly long _toleranceSeconds;

        public StripeWebhookSignatureVerifier(string webhookSecret, long toleranceSeconds = DefaultToleranceSeconds)
        {
            _secretKey = Encoding.UTF8.GetBytes(webhookSecret ?? string.Empty);
            _toleranceSeconds = toleranceSeconds;
        }

        public bool Verify(string rawBody, IDictionary<string, string> headers)
            => Verify(rawBody, headers, DateTimeOffset.UtcNow);

        // utcNow is injectable so the stale-timestamp path is unit-testable.
        public bool Verify(string rawBody, IDictionary<string, string> headers, DateTimeOffset utcNow)
        {
            if (_secretKey.Length == 0 || headers is null) return false;
            if (!TryGet(headers, SignatureHeader, out var signatureHeader)) return false;

            if (!TryParse(signatureHeader, out var timestamp, out var v1Signatures)) return false;

            // 1. Replay window: reject stale (or far-future) timestamps before any HMAC.
            var skew = Math.Abs(utcNow.ToUnixTimeSeconds() - timestamp);
            if (skew > _toleranceSeconds) return false;

            // 2. Recompute the expected signature over "{t}.{rawBody}".
            var signedPayload = $"{timestamp}.{rawBody ?? string.Empty}";
            using var hmac = new HMACSHA256(_secretKey);
            var expected = Convert.ToHexString(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload))).ToLowerInvariant();

            // 3. Constant-time compare against each v1 signature (multiple appear during
            // a secret roll). Any match → authentic.
            foreach (var provided in v1Signatures)
                if (FixedTimeEqualsUtf8(expected, provided)) return true;

            return false;
        }

        // "t=1700000000,v1=abc…,v0=def…" → timestamp + every v1 hex signature.
        internal static bool TryParse(string header, out long timestamp, out List<string> v1Signatures)
        {
            timestamp = 0;
            v1Signatures = new List<string>();
            if (string.IsNullOrWhiteSpace(header)) return false;

            var haveTimestamp = false;
            foreach (var element in header.Split(','))
            {
                var eq = element.IndexOf('=');
                if (eq < 1) continue;
                var prefix = element[..eq].Trim();
                var value = element[(eq + 1)..].Trim();
                if (value.Length == 0) continue;

                if (prefix == "t")
                {
                    if (long.TryParse(value, out var ts)) { timestamp = ts; haveTimestamp = true; }
                }
                else if (prefix == "v1")
                {
                    // Ignore all non-v1 schemes (e.g. the fake v0) — downgrade defence.
                    v1Signatures.Add(value.ToLowerInvariant());
                }
            }

            return haveTimestamp && v1Signatures.Count > 0;
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
