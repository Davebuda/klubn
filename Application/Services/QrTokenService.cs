using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace DJDiP.Application.Services
{
    // Pure HMAC-SHA256 implementation of IQrTokenService (design §7).
    // Token layout:  base64url(payloadJson) + "." + base64url(hmacSha256(payloadJson)).
    // Stateless and deterministic — fully unit-testable without any DB or provider.
    public sealed class QrTokenService : IQrTokenService
    {
        private readonly byte[] _key;

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.Never
        };

        // DI ctor — secret from configuration ("Qr:SigningSecret").
        public QrTokenService(IOptions<QrOptions> options)
            : this(options.Value.SigningSecret)
        {
        }

        // Direct ctor — convenient for unit tests.
        public QrTokenService(string signingSecret)
        {
            if (string.IsNullOrWhiteSpace(signingSecret))
                throw new InvalidOperationException(
                    "Qr:SigningSecret is not configured. Set env Qr__SigningSecret to a strong random value.");
            _key = Encoding.UTF8.GetBytes(signingSecret);
        }

        public string Issue(QrTokenData data)
        {
            var payload = new Payload { t = data.TicketId, e = data.EventId, a = data.AdmitCount, x = data.ExpiresAtEpoch };
            var json = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOpts);
            var sig = Sign(json);
            return $"{Base64Url.Encode(json)}.{Base64Url.Encode(sig)}";
        }

        public QrVerifyResult Verify(string token)
        {
            if (string.IsNullOrEmpty(token))
                return QrVerifyResult.Fail(QrVerifyStatus.BadFormat);

            var dot = token.IndexOf('.');
            if (dot <= 0 || dot != token.LastIndexOf('.') || dot == token.Length - 1)
                return QrVerifyResult.Fail(QrVerifyStatus.BadFormat);

            byte[] json, sig;
            try
            {
                json = Base64Url.Decode(token.AsSpan(0, dot));
                sig = Base64Url.Decode(token.AsSpan(dot + 1));
            }
            catch
            {
                return QrVerifyResult.Fail(QrVerifyStatus.BadFormat);
            }

            // Constant-time compare — never short-circuit on the signature.
            var expected = Sign(json);
            if (!CryptographicOperations.FixedTimeEquals(sig, expected))
                return QrVerifyResult.Fail(QrVerifyStatus.BadSignature);

            Payload? p;
            try { p = JsonSerializer.Deserialize<Payload>(json, JsonOpts); }
            catch { return QrVerifyResult.Fail(QrVerifyStatus.BadFormat); }
            if (p is null)
                return QrVerifyResult.Fail(QrVerifyStatus.BadFormat);

            var data = new QrTokenData(p.t, p.e, p.a, p.x);

            var nowEpoch = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (nowEpoch > p.x)
                return QrVerifyResult.Expired(data);

            return QrVerifyResult.Ok(data);
        }

        private byte[] Sign(byte[] data)
        {
            using var hmac = new HMACSHA256(_key);
            return hmac.ComputeHash(data);
        }

        // Compact wire shape {t,e,a,x}; mutable for System.Text.Json.
        private sealed class Payload
        {
            public Guid t { get; set; }
            public Guid e { get; set; }
            public int a { get; set; }
            public long x { get; set; }
        }
    }

    // URL-safe base64 (no padding) — keeps QR tokens compact and scanner-friendly.
    internal static class Base64Url
    {
        public static string Encode(ReadOnlySpan<byte> bytes)
        {
            var s = Convert.ToBase64String(bytes);
            return s.TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        public static byte[] Decode(ReadOnlySpan<char> input)
        {
            var s = new string(input).Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4)
            {
                case 2: s += "=="; break;
                case 3: s += "="; break;
                case 1: throw new FormatException("Invalid base64url length.");
            }
            return Convert.FromBase64String(s);
        }
    }
}
