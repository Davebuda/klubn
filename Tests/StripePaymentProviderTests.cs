using System.Security.Cryptography;
using System.Text;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Infrastructure.Payments.Stripe;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Stripe;
using Xunit;

namespace DJDiP.Tests
{
    // Stripe adapter unit tests, mirroring the Vipps suite: webhook signature
    // verification (the security-critical path), webhook normalization for each mapped
    // event type, money mapping, and the pure PaymentIntent-status mapping. No HTTP —
    // the provider's network methods are exercised by an E2E against Stripe test mode.
    public class StripeWebhookSignatureVerifierTests
    {
        private const string Secret = "whsec_test_secret_from_registration";
        private const string Body = "{\"id\":\"evt_1\",\"object\":\"event\",\"type\":\"payment_intent.succeeded\"}";

        // Builds the Stripe-Signature header exactly as Stripe signs it
        // (docs.stripe.com/webhooks#verify-manually):
        //   signed_payload = "{t}.{body}";  v1 = hex(HMAC-SHA256(secret, signed_payload))
        private static Dictionary<string, string> SignedHeaders(
            string body, string secret, long timestamp, bool includeV0 = true)
        {
            var signedPayload = $"{timestamp}.{body}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var v1 = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload))).ToLowerInvariant();
            var header = $"t={timestamp},v1={v1}";
            if (includeV0) header += ",v0=fakefakefake";   // Stripe sends a fake v0 in test events
            return new Dictionary<string, string> { ["Stripe-Signature"] = header };
        }

        private static long Now() => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        [Fact]
        public void Valid_signature_verifies()
        {
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            Assert.True(verifier.Verify(Body, SignedHeaders(Body, Secret, Now())));
        }

        [Fact]
        public void Tampered_body_fails()
        {
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var headers = SignedHeaders(Body, Secret, Now());
            Assert.False(verifier.Verify(Body.Replace("succeeded", "payment_failed"), headers));
        }

        [Fact]
        public void Wrong_secret_fails()
        {
            var verifier = new StripeWebhookSignatureVerifier("whsec_some_other_secret");
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, Secret, Now())));
        }

        [Fact]
        public void Stale_timestamp_outside_tolerance_fails()
        {
            // Signed 10 minutes ago — outside the 300s default tolerance, even though the
            // HMAC itself is valid. This is the Stripe replay-protection guarantee.
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var old = Now() - 600;
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, Secret, old)));
        }

        [Fact]
        public void Future_timestamp_outside_tolerance_fails()
        {
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var future = Now() + 600;
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, Secret, future)));
        }

        [Fact]
        public void Timestamp_within_tolerance_verifies()
        {
            // Fixed clock so the test never flakes near the tolerance boundary.
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var signedAt = 1_700_000_000L;
            var headers = SignedHeaders(Body, Secret, signedAt);
            var checkedAt = DateTimeOffset.FromUnixTimeSeconds(signedAt + 200); // < 300s skew
            Assert.True(verifier.Verify(Body, headers, checkedAt));
        }

        [Fact]
        public void Missing_signature_header_fails()
        {
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            Assert.False(verifier.Verify(Body, new Dictionary<string, string>()));
        }

        [Fact]
        public void Header_with_no_v1_scheme_fails()
        {
            // Only a fake v0 present → no valid scheme → reject (downgrade defence).
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var headers = new Dictionary<string, string> { ["Stripe-Signature"] = $"t={Now()},v0=deadbeef" };
            Assert.False(verifier.Verify(Body, headers));
        }

        [Fact]
        public void Multiple_v1_signatures_any_match_verifies()
        {
            // During a secret roll Stripe sends one v1 per active secret. A match on EITHER
            // must verify. Build a header with a bogus v1 first, then the real one.
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var ts = Now();
            var real = SignedHeaders(Body, Secret, ts, includeV0: false)["Stripe-Signature"];
            var realV1 = real[(real.IndexOf("v1=", StringComparison.Ordinal) + 3)..];
            var headers = new Dictionary<string, string>
            {
                ["Stripe-Signature"] = $"t={ts},v1=00000000deadbeef,v1={realV1}"
            };
            Assert.True(verifier.Verify(Body, headers));
        }

        [Fact]
        public void Header_lookup_is_case_insensitive()
        {
            var verifier = new StripeWebhookSignatureVerifier(Secret);
            var signed = SignedHeaders(Body, Secret, Now())["Stripe-Signature"];
            var headers = new Dictionary<string, string> { ["STRIPE-SIGNATURE"] = signed };
            Assert.True(verifier.Verify(Body, headers));
        }

        [Fact]
        public void Empty_secret_never_verifies()
        {
            // Unconfigured webhook secret must hard-fail, not pass-through.
            var verifier = new StripeWebhookSignatureVerifier(string.Empty);
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, "anything", Now())));
        }
    }

    public class StripePaymentIntentStatusMappingTests
    {
        // Received/refunded amounts outrank the status string (a captured/refunded PI can
        // linger in a non-obvious status), mirroring the Vipps aggregate-outranks-state rule.
        [Theory]
        [InlineData("requires_capture", 0, 0, PaymentEventType.Authorized)]
        [InlineData("succeeded", 50000, 0, PaymentEventType.Captured)]
        [InlineData("succeeded", 50000, 50000, PaymentEventType.Refunded)]
        [InlineData("requires_capture", 0, 30000, PaymentEventType.Refunded)] // refund outranks
        [InlineData("canceled", 0, 0, PaymentEventType.Cancelled)]
        [InlineData("requires_payment_method", 0, 0, PaymentEventType.Pending)]
        [InlineData("requires_confirmation", 0, 0, PaymentEventType.Pending)]
        [InlineData("requires_action", 0, 0, PaymentEventType.Pending)]
        [InlineData("processing", 0, 0, PaymentEventType.Pending)]
        [InlineData("something_new", 0, 0, PaymentEventType.Pending)] // unknown → never finalize
        [InlineData(null, 0, 0, PaymentEventType.Pending)]
        public void Status_maps(string? status, long captured, long refunded, PaymentEventType expected)
            => Assert.Equal(expected, StripePaymentProvider.MapPaymentIntentStatus(status, captured, refunded));
    }

    public class StripeNormalizeWebhookTests
    {
        // NormalizeWebhook only parses + maps JSON (signature already verified) — safe to
        // construct the provider without real Stripe creds.
        private static StripePaymentProvider Provider() => new(
            opts: Options.Create(new StripeOptions { SecretKey = "sk_test_x", WebhookSecret = "whsec_x" }),
            log: NullLogger<StripePaymentProvider>.Instance);

        // Minimal authentic Stripe event envelope wrapping a typed object.
        private static string EventJson(string type, string objectJson, long created = 1_700_000_000) =>
            $"{{\"id\":\"evt_1\",\"object\":\"event\",\"type\":\"{type}\",\"created\":{created}," +
            $"\"data\":{{\"object\":{objectJson}}}}}";

        private static string PaymentIntentJson(string status, long amount, long amountReceived) =>
            $"{{\"id\":\"pi_123\",\"object\":\"payment_intent\",\"status\":\"{status}\"," +
            $"\"amount\":{amount},\"amount_received\":{amountReceived},\"currency\":\"nok\"," +
            $"\"metadata\":{{\"order_ref\":\"klubn-abc123\"}}}}";

        [Fact]
        public void Amount_capturable_updated_maps_to_authorized()
        {
            var raw = EventJson("payment_intent.amount_capturable_updated",
                PaymentIntentJson("requires_capture", 50000, 0));
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());

            Assert.Equal("klubn-abc123", ev.OrderRef);
            Assert.Equal("pi_123", ev.PspRef);
            Assert.Equal(PaymentEventType.Authorized, ev.Type);
            Assert.Equal(50000, ev.Amount.AmountMinor);   // authorized total = amount
            Assert.Equal("NOK", ev.Amount.Currency);
            Assert.Equal(raw, ev.RawPayload);
        }

        [Fact]
        public void Succeeded_maps_to_captured_with_amount_received()
        {
            var raw = EventJson("payment_intent.succeeded",
                PaymentIntentJson("succeeded", 50000, 50000));
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());

            Assert.Equal(PaymentEventType.Captured, ev.Type);
            Assert.Equal(50000, ev.Amount.AmountMinor); // captured = amount_received
            Assert.Equal("pi_123", ev.PspRef);
        }

        [Fact]
        public void Payment_failed_maps_to_failed()
        {
            var raw = EventJson("payment_intent.payment_failed",
                PaymentIntentJson("requires_payment_method", 50000, 0));
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());
            Assert.Equal(PaymentEventType.Failed, ev.Type);
        }

        [Fact]
        public void Canceled_maps_to_cancelled()
        {
            var raw = EventJson("payment_intent.canceled",
                PaymentIntentJson("canceled", 50000, 0));
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());
            Assert.Equal(PaymentEventType.Cancelled, ev.Type);
        }

        [Fact]
        public void Charge_refunded_maps_to_refunded_via_pspref_with_empty_orderref()
        {
            // Stripe does NOT copy PaymentIntent metadata onto the Charge, so a real
            // charge.refunded (e.g. a Dashboard-issued refund) arrives metadata-less.
            // The contract: OrderRef stays empty and PspRef carries the PI id — the
            // orchestrator's FinalizeAsync falls back to ProviderPspReference matching.
            var charge = "{\"id\":\"ch_1\",\"object\":\"charge\",\"payment_intent\":\"pi_123\"," +
                         "\"amount_refunded\":20000,\"currency\":\"nok\",\"metadata\":{}}";
            var raw = EventJson("charge.refunded", charge);
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());

            Assert.Equal(PaymentEventType.Refunded, ev.Type);
            Assert.Equal(20000, ev.Amount.AmountMinor); // partial-refund total
            Assert.Equal("pi_123", ev.PspRef);          // charge maps back to its PI
            Assert.Equal(string.Empty, ev.OrderRef);    // never populated on charge events
        }

        [Fact]
        public void Session_expired_maps_to_expired_via_client_reference_id()
        {
            // Session expires before a PI is captured → OrderRef comes from
            // client_reference_id, which we set to Order.Reference at create time.
            var session = "{\"id\":\"cs_1\",\"object\":\"checkout.session\"," +
                          "\"client_reference_id\":\"klubn-abc123\",\"payment_intent\":\"pi_123\"," +
                          "\"amount_total\":50000,\"currency\":\"nok\"}";
            var raw = EventJson("checkout.session.expired", session);
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());

            Assert.Equal(PaymentEventType.Expired, ev.Type);
            Assert.Equal("klubn-abc123", ev.OrderRef);
            Assert.Equal(50000, ev.Amount.AmountMinor);
        }

        [Fact]
        public void Unmodeled_event_throws()
        {
            // An event type we don't map carries no normalizable payment → clear throw
            // (the controller turns this into a 400, never a silent finalize).
            var raw = EventJson("payment_intent.created",
                PaymentIntentJson("requires_payment_method", 50000, 0));
            Assert.Throws<InvalidOperationException>(() =>
                Provider().NormalizeWebhook(raw, new Dictionary<string, string>()));
        }

        [Fact]
        public void OccurredAt_uses_event_created_timestamp()
        {
            var raw = EventJson("payment_intent.succeeded",
                PaymentIntentJson("succeeded", 50000, 50000), created: 1_700_000_000);
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());
            Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1_700_000_000).UtcDateTime, ev.OccurredAt);
        }
    }
}
