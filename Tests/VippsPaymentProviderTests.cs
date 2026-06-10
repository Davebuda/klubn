using System.Security.Cryptography;
using System.Text;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Infrastructure.Payments.Vipps;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace DJDiP.Tests
{
    // P4 Vipps adapter unit tests: webhook signature verification (the security-
    // critical path), webhook normalization, and the pure state mappings. No HTTP —
    // the provider's network methods are exercised by the P10 E2E against apitest.
    public class VippsWebhookSignatureVerifierTests
    {
        private const string Secret = "test-webhook-secret-from-registration";
        private const string Body = "{\"reference\":\"klubn-abc123\",\"name\":\"CAPTURED\"}";
        private const string Path = "/api/webhooks/payments/vipps";
        private const string Host = "klubn.no";
        private const string Date = "Tue, 10 Jun 2026 12:00:00 GMT";

        // Builds headers exactly as Vipps signs them (request-authentication doc):
        // contentHash = base64(SHA256(body)); stringToSign = POST\n{path}\n{date};{host};{hash}
        private static Dictionary<string, string> SignedHeaders(
            string body, string secret, string path = Path, string host = Host, string date = Date)
        {
            var contentHash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(body)));
            var stringToSign = $"POST\n{path}\n{date};{host};{contentHash}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(stringToSign)));

            return new Dictionary<string, string>
            {
                ["x-ms-date"] = date,
                ["x-ms-content-sha256"] = contentHash,
                ["Host"] = host,
                ["Authorization"] =
                    $"HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature={signature}",
                [VippsWebhookSignatureVerifier.PathPseudoHeader] = path
            };
        }

        [Fact]
        public void Valid_signature_verifies()
        {
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            Assert.True(verifier.Verify(Body, SignedHeaders(Body, Secret)));
        }

        [Fact]
        public void Tampered_body_fails()
        {
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            var headers = SignedHeaders(Body, Secret);
            Assert.False(verifier.Verify(Body.Replace("CAPTURED", "REFUNDED"), headers));
        }

        [Fact]
        public void Wrong_secret_fails()
        {
            var verifier = new VippsWebhookSignatureVerifier("some-other-secret");
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, Secret)));
        }

        [Fact]
        public void Wrong_path_fails()
        {
            // Signature was made for a different path → string-to-sign differs.
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            var headers = SignedHeaders(Body, Secret);
            headers[VippsWebhookSignatureVerifier.PathPseudoHeader] = "/api/other";
            Assert.False(verifier.Verify(Body, headers));
        }

        [Theory]
        [InlineData("x-ms-date")]
        [InlineData("x-ms-content-sha256")]
        [InlineData("Host")]
        [InlineData("Authorization")]
        [InlineData(VippsWebhookSignatureVerifier.PathPseudoHeader)]
        public void Missing_header_fails(string headerToRemove)
        {
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            var headers = SignedHeaders(Body, Secret);
            headers.Remove(headerToRemove);
            Assert.False(verifier.Verify(Body, headers));
        }

        [Fact]
        public void Malformed_authorization_fails()
        {
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            var headers = SignedHeaders(Body, Secret);
            headers["Authorization"] = "Bearer not-an-hmac-header";
            Assert.False(verifier.Verify(Body, headers));
        }

        [Fact]
        public void Empty_secret_never_verifies()
        {
            // Unconfigured webhook secret must hard-fail, not pass-through.
            var verifier = new VippsWebhookSignatureVerifier(string.Empty);
            Assert.False(verifier.Verify(Body, SignedHeaders(Body, "anything")));
        }

        [Fact]
        public void Header_lookup_is_case_insensitive()
        {
            var verifier = new VippsWebhookSignatureVerifier(Secret);
            var signed = SignedHeaders(Body, Secret);
            var headers = new Dictionary<string, string>
            {
                ["X-MS-DATE"] = signed["x-ms-date"],
                ["X-Ms-Content-Sha256"] = signed["x-ms-content-sha256"],
                ["host"] = signed["Host"],
                ["AUTHORIZATION"] = signed["Authorization"],
                ["X-Request-Path-And-Query"] = signed[VippsWebhookSignatureVerifier.PathPseudoHeader]
            };
            Assert.True(verifier.Verify(Body, headers));
        }
    }

    public class VippsStateMappingTests
    {
        // Aggregate money outranks the state string: ePayment keeps state=AUTHORIZED
        // after capture — captured/refunded funds only show in the aggregate.
        [Theory]
        [InlineData("AUTHORIZED", 0, 0, PaymentEventType.Authorized)]
        [InlineData("AUTHORIZED", 50000, 0, PaymentEventType.Captured)]
        [InlineData("AUTHORIZED", 50000, 50000, PaymentEventType.Refunded)]
        [InlineData("CREATED", 0, 0, PaymentEventType.Pending)]
        [InlineData("ABORTED", 0, 0, PaymentEventType.Cancelled)]
        [InlineData("TERMINATED", 0, 0, PaymentEventType.Cancelled)]
        [InlineData("EXPIRED", 0, 0, PaymentEventType.Expired)]
        [InlineData("authorized", 0, 0, PaymentEventType.Authorized)] // case-insensitive
        [InlineData("SOMETHING_NEW", 0, 0, PaymentEventType.Pending)] // unknown → never finalize
        [InlineData(null, 0, 0, PaymentEventType.Pending)]
        public void Snapshot_state_maps(string? state, long captured, long refunded, PaymentEventType expected)
            => Assert.Equal(expected, VippsPaymentProvider.MapSnapshotState(state, captured, refunded));

        [Theory]
        [InlineData("AUTHORIZED", true, PaymentEventType.Authorized)]
        [InlineData("CAPTURED", true, PaymentEventType.Captured)]
        [InlineData("REFUNDED", true, PaymentEventType.Refunded)]
        [InlineData("CANCELLED", true, PaymentEventType.Cancelled)]
        [InlineData("TERMINATED", true, PaymentEventType.Cancelled)]
        [InlineData("ABORTED", true, PaymentEventType.Cancelled)]
        [InlineData("EXPIRED", true, PaymentEventType.Expired)]
        [InlineData("CREATED", true, PaymentEventType.Pending)]
        [InlineData("AUTHORIZED", false, PaymentEventType.Failed)] // success=false wins
        [InlineData("UNKNOWN_EVENT", true, PaymentEventType.Pending)]
        public void Webhook_event_maps(string name, bool success, PaymentEventType expected)
            => Assert.Equal(expected, VippsPaymentProvider.MapWebhookEvent(name, success));
    }

    public class VippsNormalizeWebhookTests
    {
        // NormalizeWebhook only parses JSON — safe to construct the provider without HTTP.
        private static VippsPaymentProvider Provider() => new(
            httpFactory: null!,
            tokens: null!,
            opts: Options.Create(new VippsOptions { WebhookSecret = "s" }),
            log: NullLogger<VippsPaymentProvider>.Instance);

        [Fact]
        public void Captured_event_normalizes()
        {
            var raw = "{\"msn\":\"123456\",\"reference\":\"klubn-abc123\",\"pspReference\":\"psp-789\"," +
                      "\"name\":\"CAPTURED\",\"amount\":{\"currency\":\"NOK\",\"value\":50000}," +
                      "\"timestamp\":\"2026-06-10T12:00:00Z\",\"success\":true}";

            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());

            Assert.Equal("klubn-abc123", ev.OrderRef);
            Assert.Equal("psp-789", ev.PspRef);
            Assert.Equal(PaymentEventType.Captured, ev.Type);
            Assert.Equal(50000, ev.Amount.AmountMinor);
            Assert.Equal("NOK", ev.Amount.Currency);
            Assert.Equal(raw, ev.RawPayload);
        }

        [Fact]
        public void Missing_reference_throws()
        {
            Assert.Throws<InvalidOperationException>(() =>
                Provider().NormalizeWebhook("{\"name\":\"CAPTURED\"}", new Dictionary<string, string>()));
        }

        [Fact]
        public void Failed_event_maps_to_failed()
        {
            var raw = "{\"reference\":\"klubn-x\",\"name\":\"AUTHORIZED\",\"success\":false}";
            var ev = Provider().NormalizeWebhook(raw, new Dictionary<string, string>());
            Assert.Equal(PaymentEventType.Failed, ev.Type);
        }
    }
}
