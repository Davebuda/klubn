using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace DJDiP.Infrastructure.Payments.Sandbox
{
    // Provider-agnostic seam impl (design §3) used until Vipps TEST creds arrive.
    // Deterministic, network-free: it never calls an external PSP. It lets us prove
    // the orchestrator, hold/oversell logic, ticket issuance and QR signing end-to-end.
    //
    // IMPORTANT: contains ZERO Vipps coupling — it does not touch VippsPaymentProvider
    // (P4) or VippsOptions. Swapping to the real Vipps adapter later is a one-line DI
    // change; this class and the orchestrator stay untouched.
    public sealed class SandboxPaymentProvider : IPaymentProvider
    {
        public const string SignatureHeader = "X-Sandbox-Signature";

        private readonly byte[] _webhookKey;

        public SandboxPaymentProvider(IOptions<SandboxOptions> options)
        {
            var secret = options.Value.WebhookSecret;
            _webhookKey = Encoding.UTF8.GetBytes(
                string.IsNullOrWhiteSpace(secret) ? "sandbox-webhook-secret" : secret);
        }

        public string Name => "Sandbox";

        // No external call: hand back a redirect to the app's return page carrying the
        // order reference. The frontend's sandbox return view completes the payment via
        // the completeSandboxPayment mutation (which drives the same FinalizeAsync path
        // a real webhook would).
        public Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct)
        {
            var providerRef = "sbx-" + request.OrderRef;
            var sep = request.ReturnUrl.Contains('?') ? '&' : '?';
            // Param key is "reference" to match the frontend CheckoutReturnPage reader.
            var redirect = $"{request.ReturnUrl}{sep}reference={Uri.EscapeDataString(request.OrderRef)}&sandbox=1";
            return Task.FromResult(new InitiateResult(providerRef, redirect));
        }

        // Poll fallback: report the payment as authorized for the requested reference.
        public Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct)
        {
            var snapshot = new PaymentSnapshot(
                ProviderReference: providerRef,
                PspRef: "sbx-psp-" + providerRef,
                State: PaymentEventType.Authorized,
                AuthorizedAmount: Money.Nok(0),
                CapturedAmount: Money.Nok(0),
                RefundedAmount: Money.Nok(0),
                ObservedAt: DateTime.UtcNow);
            return Task.FromResult(snapshot);
        }

        public Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
            => Task.FromResult(new CaptureResult("sbx-psp-" + providerRef, amount));

        public Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
            => Task.FromResult(new RefundResult("sbx-refund-" + providerRef, amount));

        public Task CancelAsync(string providerRef, CancellationToken ct) => Task.CompletedTask;

        // Constant-time HMAC verification mirroring the real-provider contract.
        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers)
        {
            if (headers is null || !TryGetHeader(headers, SignatureHeader, out var provided) || string.IsNullOrEmpty(provided))
                return false;

            byte[] providedBytes;
            try { providedBytes = Convert.FromHexString(provided); }
            catch { return false; }

            using var hmac = new HMACSHA256(_webhookKey);
            var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody ?? string.Empty));
            return CryptographicOperations.FixedTimeEquals(providedBytes, expected);
        }

        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers)
        {
            var body = JsonSerializer.Deserialize<WebhookBody>(rawBody ?? "{}")
                       ?? throw new InvalidOperationException("Sandbox webhook body could not be parsed.");

            var type = Enum.TryParse<PaymentEventType>(body.type, ignoreCase: true, out var t)
                ? t
                : PaymentEventType.Captured;

            return new PaymentEvent(
                OrderRef: body.orderRef ?? string.Empty,
                PspRef: body.pspRef,
                Type: type,
                Amount: new Money(body.amountMinor, string.IsNullOrWhiteSpace(body.currency) ? "NOK" : body.currency),
                OccurredAt: DateTime.UtcNow,
                RawPayload: rawBody ?? string.Empty);
        }

        // Helper so the SignatureHeader can be applied to an arbitrary body (used by the
        // dev completeSandboxPayment path and by tests to forge a valid signature).
        public string ComputeSignature(string rawBody)
        {
            using var hmac = new HMACSHA256(_webhookKey);
            return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody ?? string.Empty)));
        }

        private static bool TryGetHeader(IDictionary<string, string> headers, string name, out string value)
        {
            foreach (var kv in headers)
            {
                if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = kv.Value;
                    return true;
                }
            }
            value = string.Empty;
            return false;
        }

        private sealed class WebhookBody
        {
            public string? orderRef { get; set; }
            public string? pspRef { get; set; }
            public string? type { get; set; }
            public long amountMinor { get; set; }
            public string? currency { get; set; }
        }
    }
}
