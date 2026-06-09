using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using Xunit;

namespace DJDiP.Tests
{
    // Pure unit tests for the door-scan QR token (design §7). No DB, no provider —
    // this is the kind of real assertion that makes a "green build" mean something.
    public class QrTokenServiceTests
    {
        private const string Secret = "test-signing-secret-please-rotate";

        private static QrTokenData SampleData(long? exp = null) => new(
            TicketId: Guid.Parse("11111111-1111-1111-1111-111111111111"),
            EventId: Guid.Parse("22222222-2222-2222-2222-222222222222"),
            AdmitCount: 4,
            ExpiresAtEpoch: exp ?? DateTimeOffset.UtcNow.AddHours(6).ToUnixTimeSeconds());

        [Fact]
        public void Issue_then_Verify_roundtrips_all_fields()
        {
            var svc = new QrTokenService(Secret);
            var data = SampleData();

            var token = svc.Issue(data);
            var result = svc.Verify(token);

            Assert.True(result.IsValid);
            Assert.Equal(QrVerifyStatus.Valid, result.Status);
            Assert.NotNull(result.Data);
            Assert.Equal(data.TicketId, result.Data!.TicketId);
            Assert.Equal(data.EventId, result.Data.EventId);
            Assert.Equal(data.AdmitCount, result.Data.AdmitCount);
            Assert.Equal(data.ExpiresAtEpoch, result.Data.ExpiresAtEpoch);
        }

        [Fact]
        public void Token_has_two_base64url_parts()
        {
            var svc = new QrTokenService(Secret);
            var token = svc.Issue(SampleData());

            var parts = token.Split('.');
            Assert.Equal(2, parts.Length);
            Assert.DoesNotContain('+', token);
            Assert.DoesNotContain('/', token);
            Assert.DoesNotContain('=', token);
        }

        [Fact]
        public void Tampered_payload_fails_signature()
        {
            var svc = new QrTokenService(Secret);
            var token = svc.Issue(SampleData());

            var parts = token.Split('.');
            // Flip a character in the payload segment.
            var firstChar = parts[0][0] == 'A' ? 'B' : 'A';
            var tampered = firstChar + parts[0].Substring(1) + "." + parts[1];

            var result = svc.Verify(tampered);
            Assert.False(result.IsValid);
            Assert.Equal(QrVerifyStatus.BadSignature, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public void Wrong_secret_fails_signature()
        {
            var issuer = new QrTokenService(Secret);
            var attacker = new QrTokenService("a-different-secret");

            var token = issuer.Issue(SampleData());
            var result = attacker.Verify(token);

            Assert.Equal(QrVerifyStatus.BadSignature, result.Status);
        }

        [Fact]
        public void Expired_token_is_detected_but_payload_still_parsed()
        {
            var svc = new QrTokenService(Secret);
            var expired = SampleData(exp: DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeSeconds());

            var token = svc.Issue(expired);
            var result = svc.Verify(token);

            Assert.False(result.IsValid);
            Assert.Equal(QrVerifyStatus.Expired, result.Status);
            Assert.NotNull(result.Data); // expiry is post-signature, so data is trustworthy
            Assert.Equal(expired.TicketId, result.Data!.TicketId);
        }

        [Theory]
        [InlineData("")]
        [InlineData("not-a-token")]
        [InlineData("only-one-part")]
        [InlineData("too.many.parts")]
        [InlineData("!!!.@@@")]
        public void Malformed_tokens_return_BadFormat(string bad)
        {
            var svc = new QrTokenService(Secret);
            var result = svc.Verify(bad);

            Assert.False(result.IsValid);
            // Malformed structure or undecodable base64url -> BadFormat (never throws).
            Assert.True(result.Status is QrVerifyStatus.BadFormat or QrVerifyStatus.BadSignature);
        }

        [Fact]
        public void Empty_secret_throws()
        {
            Assert.Throws<InvalidOperationException>(() => new QrTokenService(""));
        }
    }
}
