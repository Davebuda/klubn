using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DJDiP.Infrastructure.Payments.Vipps
{
    // P4: the real Vipps MobilePay ePayment adapter behind IPaymentProvider.
    // Endpoints + shapes verified against developer.vippsmobilepay.com (2026-06-10):
    //   POST /epayment/v1/payments                      (initiate — NOT idempotent at Vipps;
    //                                                    Order.Reference is persisted BEFORE this
    //                                                    call and recovery goes through GetStatusAsync)
    //   GET  /epayment/v1/payments/{reference}          (poll/reconcile)
    //   POST /epayment/v1/payments/{reference}/capture  (Idempotency-Key, modificationAmount)
    //   POST /epayment/v1/payments/{reference}/refund   (Idempotency-Key, modificationAmount)
    //   POST /epayment/v1/payments/{reference}/cancel
    //
    // Privacy (design §8): we never send customer.phoneNumber or request profile scopes —
    // the only buyer-adjacent value Vipps sees is the order reference.
    public sealed class VippsPaymentProvider : IPaymentProvider
    {
        private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

        // Reported to Vipps telemetry/support (review M5: keep in sync with releases).
        private static readonly string SystemVersion =
            typeof(VippsPaymentProvider).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";

        private readonly IHttpClientFactory _httpFactory;
        private readonly VippsAccessTokenCache _tokens;
        private readonly VippsOptions _opts;
        private readonly VippsWebhookSignatureVerifier _webhookVerifier;
        private readonly ILogger<VippsPaymentProvider> _log;

        public VippsPaymentProvider(
            IHttpClientFactory httpFactory,
            VippsAccessTokenCache tokens,
            IOptions<VippsOptions> opts,
            ILogger<VippsPaymentProvider> log)
        {
            _httpFactory = httpFactory;
            _tokens = tokens;
            _opts = opts.Value;
            _webhookVerifier = new VippsWebhookSignatureVerifier(_opts.WebhookSecret);
            _log = log;
        }

        public string Name => "Vipps";

        public async Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct)
        {
            // Mirror SandboxPaymentProvider: the return URL carries the reference so the
            // CheckoutReturnPage can poll/reconcile it (no sandbox flag for the real provider).
            var sep = request.ReturnUrl.Contains('?') ? '&' : '?';
            var returnUrl = $"{request.ReturnUrl}{sep}reference={Uri.EscapeDataString(request.OrderRef)}";

            var body = new
            {
                amount = new { currency = request.Amount.Currency, value = request.Amount.AmountMinor },
                paymentMethod = new { type = "WALLET" },
                reference = request.OrderRef,
                returnUrl,
                userFlow = "WEB_REDIRECT",
                // Vipps caps paymentDescription at 100 chars.
                paymentDescription = Truncate(request.Description ?? $"KlubN tickets {request.OrderRef}", 100)
            };

            var res = await SendAsync(HttpMethod.Post, "/epayment/v1/payments", body,
                idempotencyKey: request.IdempotencyKey, ct);

            var parsed = JsonSerializer.Deserialize<CreatePaymentResponse>(res, JsonOpts)
                         ?? throw new InvalidOperationException("Empty Vipps create-payment response.");
            if (string.IsNullOrEmpty(parsed.RedirectUrl))
                throw new InvalidOperationException("Vipps create-payment response had no redirectUrl.");

            return new InitiateResult(
                ProviderReference: parsed.Reference ?? request.OrderRef,
                RedirectUrl: parsed.RedirectUrl);
        }

        public async Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct)
        {
            var res = await SendAsync(HttpMethod.Get,
                $"/epayment/v1/payments/{Uri.EscapeDataString(providerRef)}", body: null,
                idempotencyKey: null, ct);

            var p = JsonSerializer.Deserialize<GetPaymentResponse>(res, JsonOpts)
                    ?? throw new InvalidOperationException("Empty Vipps get-payment response.");

            var currency = p.Aggregate?.AuthorizedAmount?.Currency ?? "NOK";
            long authorized = p.Aggregate?.AuthorizedAmount?.Value ?? 0;
            long captured = p.Aggregate?.CapturedAmount?.Value ?? 0;
            long refunded = p.Aggregate?.RefundedAmount?.Value ?? 0;

            return new PaymentSnapshot(
                ProviderReference: p.Reference ?? providerRef,
                PspRef: p.PspReference,
                State: MapSnapshotState(p.State, captured, refunded),
                AuthorizedAmount: new Money(authorized, currency),
                CapturedAmount: new Money(captured, currency),
                RefundedAmount: new Money(refunded, currency),
                ObservedAt: DateTime.UtcNow);
        }

        public async Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            var body = new { modificationAmount = new { currency = amount.Currency, value = amount.AmountMinor } };
            var res = await SendAsync(HttpMethod.Post,
                $"/epayment/v1/payments/{Uri.EscapeDataString(providerRef)}/capture", body, idemKey, ct);

            var parsed = JsonSerializer.Deserialize<ModificationResponse>(res, JsonOpts);
            return new CaptureResult(parsed?.PspReference ?? providerRef, amount);
        }

        public async Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            var body = new { modificationAmount = new { currency = amount.Currency, value = amount.AmountMinor } };
            var res = await SendAsync(HttpMethod.Post,
                $"/epayment/v1/payments/{Uri.EscapeDataString(providerRef)}/refund", body, idemKey, ct);

            var parsed = JsonSerializer.Deserialize<ModificationResponse>(res, JsonOpts);
            return new RefundResult(parsed?.PspReference ?? providerRef, amount);
        }

        public async Task CancelAsync(string providerRef, CancellationToken ct)
        {
            await SendAsync(HttpMethod.Post,
                $"/epayment/v1/payments/{Uri.EscapeDataString(providerRef)}/cancel", body: null,
                idempotencyKey: providerRef + "-cancel", ct);
        }

        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers)
            => _webhookVerifier.Verify(rawBody, headers);

        // Vipps ePayment webhook body (epayment.payment.*.v1):
        //   { "msn", "reference", "pspReference", "name": "CREATED|AUTHORIZED|CAPTURED|
        //     REFUNDED|CANCELLED|TERMINATED|ABORTED|EXPIRED", "amount": {currency,value},
        //     "timestamp", "success": bool, ... }
        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers)
        {
            var body = JsonSerializer.Deserialize<WebhookBody>(rawBody ?? "{}", JsonOpts)
                       ?? throw new InvalidOperationException("Vipps webhook body could not be parsed.");
            if (string.IsNullOrEmpty(body.Reference))
                throw new InvalidOperationException("Vipps webhook had no payment reference.");

            return new PaymentEvent(
                OrderRef: body.Reference,
                PspRef: body.PspReference,
                Type: MapWebhookEvent(body.Name, body.Success),
                Amount: new Money(body.Amount?.Value ?? 0, body.Amount?.Currency ?? "NOK"),
                OccurredAt: body.Timestamp ?? DateTime.UtcNow,
                RawPayload: rawBody ?? string.Empty);
        }

        // ---- mapping (pure, unit-tested) ------------------------------------------

        // Poll mapping: the aggregate amounts outrank the state string because ePayment
        // keeps state=AUTHORIZED after a capture — captured/refunded money is only
        // visible in the aggregate.
        public static PaymentEventType MapSnapshotState(string? state, long capturedMinor, long refundedMinor)
        {
            if (refundedMinor > 0) return PaymentEventType.Refunded;
            if (capturedMinor > 0) return PaymentEventType.Captured;

            return state?.ToUpperInvariant() switch
            {
                "AUTHORIZED" => PaymentEventType.Authorized,
                "ABORTED" => PaymentEventType.Cancelled,    // user cancelled in the app
                "TERMINATED" => PaymentEventType.Cancelled, // merchant cancelled
                "EXPIRED" => PaymentEventType.Expired,
                "CREATED" => PaymentEventType.Pending,      // user hasn't acted yet
                _ => PaymentEventType.Pending               // unknown → never finalize
            };
        }

        public static PaymentEventType MapWebhookEvent(string? name, bool? success)
        {
            if (success == false) return PaymentEventType.Failed;

            return name?.ToUpperInvariant() switch
            {
                "AUTHORIZED" => PaymentEventType.Authorized,
                "CAPTURED" => PaymentEventType.Captured,
                "REFUNDED" => PaymentEventType.Refunded,
                "CANCELLED" => PaymentEventType.Cancelled,
                "TERMINATED" => PaymentEventType.Cancelled,
                "ABORTED" => PaymentEventType.Cancelled,
                "EXPIRED" => PaymentEventType.Expired,
                "CREATED" => PaymentEventType.Pending,
                _ => PaymentEventType.Pending
            };
        }

        // ---- HTTP plumbing ---------------------------------------------------------

        private async Task<string> SendAsync(
            HttpMethod method, string path, object? body, string? idempotencyKey, CancellationToken ct)
        {
            var token = await _tokens.GetTokenAsync(ct);

            using var req = new HttpRequestMessage(method, new Uri(new Uri(_opts.BaseUrl), path));
            req.Headers.Add("Authorization", "Bearer " + token);
            req.Headers.Add("Ocp-Apim-Subscription-Key", _opts.SubscriptionKey);
            req.Headers.Add("Merchant-Serial-Number", _opts.Msn);
            req.Headers.Add("Vipps-System-Name", _opts.SystemName);
            req.Headers.Add("Vipps-System-Version", SystemVersion);
            if (!string.IsNullOrEmpty(idempotencyKey))
                req.Headers.Add("Idempotency-Key", idempotencyKey);

            if (body is not null)
                req.Content = new StringContent(
                    JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json");

            var http = _httpFactory.CreateClient(nameof(VippsPaymentProvider));
            using var res = await http.SendAsync(req, ct);
            var responseBody = await res.Content.ReadAsStringAsync(ct);

            if (!res.IsSuccessStatusCode)
            {
                // Log reference-bearing path + status only — never headers or full bodies
                // (vipps-v1-plan §security: webhook/api logging hygiene).
                _log.LogError("Vipps {Method} {Path} failed: {Status} {Reason}.",
                    method, path, (int)res.StatusCode, res.ReasonPhrase);
                throw new InvalidOperationException(
                    $"Vipps request failed with status {(int)res.StatusCode}.");
            }

            return responseBody;
        }

        private static string Truncate(string value, int max)
            => value.Length <= max ? value : value[..max];

        // ---- response/webhook shapes (only the fields we consume) ------------------

        private sealed class CreatePaymentResponse
        {
            [JsonPropertyName("reference")] public string? Reference { get; set; }
            [JsonPropertyName("redirectUrl")] public string? RedirectUrl { get; set; }
        }

        private sealed class GetPaymentResponse
        {
            [JsonPropertyName("reference")] public string? Reference { get; set; }
            [JsonPropertyName("pspReference")] public string? PspReference { get; set; }
            [JsonPropertyName("state")] public string? State { get; set; }
            [JsonPropertyName("aggregate")] public AggregateBody? Aggregate { get; set; }
        }

        private sealed class AggregateBody
        {
            [JsonPropertyName("authorizedAmount")] public AmountBody? AuthorizedAmount { get; set; }
            [JsonPropertyName("capturedAmount")] public AmountBody? CapturedAmount { get; set; }
            [JsonPropertyName("refundedAmount")] public AmountBody? RefundedAmount { get; set; }
            [JsonPropertyName("cancelledAmount")] public AmountBody? CancelledAmount { get; set; }
        }

        private sealed class AmountBody
        {
            [JsonPropertyName("currency")] public string? Currency { get; set; }
            [JsonPropertyName("value")] public long Value { get; set; }
        }

        private sealed class ModificationResponse
        {
            [JsonPropertyName("pspReference")] public string? PspReference { get; set; }
        }

        private sealed class WebhookBody
        {
            [JsonPropertyName("msn")] public string? Msn { get; set; }
            [JsonPropertyName("reference")] public string? Reference { get; set; }
            [JsonPropertyName("pspReference")] public string? PspReference { get; set; }
            [JsonPropertyName("name")] public string? Name { get; set; }
            [JsonPropertyName("amount")] public AmountBody? Amount { get; set; }
            [JsonPropertyName("timestamp")] public DateTime? Timestamp { get; set; }
            [JsonPropertyName("success")] public bool? Success { get; set; }
        }
    }
}
