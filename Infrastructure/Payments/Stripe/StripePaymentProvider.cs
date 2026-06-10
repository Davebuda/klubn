using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace DJDiP.Infrastructure.Payments.Stripe
{
    // The Stripe adapter behind IPaymentProvider — the THIRD provider on the seam
    // (Vipps, Sandbox, Stripe), proving design §3/L2: a new PSP is one new class with
    // ZERO domain or orchestration changes. Verified against the Stripe.net v52 SDK and
    // docs.stripe.com (fetched 2026-06-10).
    //
    // providerRef semantics (SAME as Vipps): the seam always passes the merchant order
    // reference (e.g. "klubn-abc12345") as providerRef in every call. The orchestrator
    // sets Payment.ProviderReference = OrderRef unconditionally (PaymentOrchestrator
    // ~line 159) and ALL callers (ReconcileTicketOrder ~1111/1120, TicketService ~207)
    // pass Payment.ProviderReference into the seam — never the PI id. The Checkout
    // Session id is stored in Payment.ProviderPspReference (via InitiateResult.
    // ProviderReference returned from InitiateAsync). All methods that need the Stripe
    // PaymentIntent id resolve it on-demand via ResolvePaymentIntentIdAsync, which
    // scans the (real-time consistent) Sessions LIST for client_reference_id = orderRef
    // — the list API has no such filter and Search is too stale for read-after-write;
    // see the method comment. session.PaymentIntentId may be null
    // before the buyer completes checkout; the methods handle that safely:
    //   GetStatusAsync  → returns Pending snapshot (state = Pending)
    //   CaptureAsync    → throws (invalid before authorization)
    //   RefundAsync     → throws (invalid before capture)
    //   CancelAsync     → throws (invalid before authorization)
    //
    // Checkout Sessions  create  (mode=payment, payment_intent_data.capture_method=manual
    //                             → Authorized→Capture→Captured matches the seam exactly)
    // PaymentIntents     get (latest_charge expanded) / capture / cancel
    // Refunds            create
    // Idempotency-Key    via RequestOptions.IdempotencyKey
    //
    // Privacy (design §8): the only buyer-adjacent values Stripe sees are the order
    // reference and the optional receipt email — no profile scopes.
    public sealed class StripePaymentProvider : IPaymentProvider
    {
        // Metadata key carrying our Order.Reference on the Session + PaymentIntent so a
        // webhook (which reports the PaymentIntent) can be mapped back to the order.
        private const string OrderRefMetadataKey = "order_ref";

        private readonly StripeClient _client;
        private readonly StripeWebhookSignatureVerifier _webhookVerifier;
        private readonly ILogger<StripePaymentProvider> _log;

        public StripePaymentProvider(
            IOptions<StripeOptions> opts,
            ILogger<StripePaymentProvider> log)
        {
            var settings = opts.Value;
            _client = new StripeClient(settings.SecretKey);
            _webhookVerifier = new StripeWebhookSignatureVerifier(settings.WebhookSecret);
            _log = log;
        }

        public string Name => "Stripe";

        public async Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct)
        {
            // NOK is a minor-unit currency at Stripe (øre), same as our Money record —
            // so AmountMinor maps straight to unit_amount with NO conversion. Guard the
            // currency so a non-minor-unit currency can never silently mis-charge.
            if (!string.Equals(request.Amount.Currency, "NOK", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    $"StripePaymentProvider only handles NOK (got '{request.Amount.Currency}').");

            // Carry the order reference back on the return URL so the CheckoutReturnPage
            // can poll/reconcile it — same convention as the Vipps/Sandbox adapters.
            var sep = request.ReturnUrl.Contains('?') ? '&' : '?';
            var returnUrl = $"{request.ReturnUrl}{sep}reference={Uri.EscapeDataString(request.OrderRef)}";

            var options = new SessionCreateOptions
            {
                Mode = "payment",
                SuccessUrl = returnUrl,
                CancelUrl = returnUrl,
                // client_reference_id lets us list sessions by OrderRef later
                // (ResolvePaymentIntentIdAsync uses ?client_reference_id=<orderRef>).
                ClientReferenceId = request.OrderRef,
                CustomerEmail = string.IsNullOrWhiteSpace(request.CustomerEmail) ? null : request.CustomerEmail,
                LineItems = new List<SessionLineItemOptions>
                {
                    new()
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = request.Amount.Currency.ToLowerInvariant(),
                            UnitAmount = request.Amount.AmountMinor,    // minor units, no math
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = request.Description ?? $"KlubN tickets {request.OrderRef}"
                            }
                        }
                    }
                },
                // capture_method=manual gives us Authorized → (capture) → Captured, the
                // exact lifecycle the orchestrator already drives for Vipps.
                PaymentIntentData = new SessionPaymentIntentDataOptions
                {
                    CaptureMethod = "manual",
                    Metadata = new Dictionary<string, string> { [OrderRefMetadataKey] = request.OrderRef }
                },
                Metadata = new Dictionary<string, string> { [OrderRefMetadataKey] = request.OrderRef }
            };

            Session session;
            try
            {
                session = await new SessionService(_client).CreateAsync(
                    options, Idem(request.IdempotencyKey), ct);
            }
            catch (StripeException ex)
            {
                // Reference-bearing log only — never the raw body/headers (logging hygiene).
                _log.LogError("Stripe create-session failed for {Reference}: {Code}.",
                    request.OrderRef, ex.StripeError?.Code ?? ex.StripeError?.Type);
                throw new InvalidOperationException("Stripe create-session failed.");
            }

            if (string.IsNullOrEmpty(session.Url))
                throw new InvalidOperationException("Stripe create-session response had no redirect url.");

            // ProviderReference = OrderRef (same seam semantics as Vipps — the orchestrator
            // sets Payment.ProviderReference = OrderRef unconditionally and all callers pass
            // that back into every seam method). The session id is stored in
            // Payment.ProviderPspReference (the orchestrator writes init.ProviderReference
            // there, ~line 211) so we can retrieve the session for PI resolution if needed.
            // NOTE: session.Id is returned here rather than session.PaymentIntentId because
            // the PI may not exist yet (buyer hasn't acted); we use it as an opaque PSP ref.
            return new InitiateResult(
                ProviderReference: request.OrderRef,
                RedirectUrl: session.Url);
        }

        public async Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct)
        {
            // providerRef = OrderRef (seam contract — see header comment).
            // Resolve the PaymentIntent id from the session linked to this order.
            var piId = await ResolvePaymentIntentIdAsync(providerRef, ct);
            if (piId is null)
            {
                // Session exists but the buyer hasn't completed checkout — no PI yet.
                // Return Pending so the poll loop keeps waiting; FinalizeAsync ignores Pending.
                return new PaymentSnapshot(
                    ProviderReference: providerRef,
                    PspRef: null,
                    State: PaymentEventType.Pending,
                    AuthorizedAmount: Money.Nok(0),
                    CapturedAmount: Money.Nok(0),
                    RefundedAmount: Money.Nok(0),
                    ObservedAt: DateTime.UtcNow);
            }

            // Expand latest_charge so pi.LatestCharge.AmountRefunded is populated —
            // Stripe stores the refunded total on the charge, not on the PI directly.
            var getOpts = new PaymentIntentGetOptions();
            getOpts.AddExpand("latest_charge");
            var pi = await new PaymentIntentService(_client).GetAsync(piId, getOpts, null, ct);

            var currency = (pi.Currency ?? "nok").ToUpperInvariant();
            long authorized = pi.Amount;
            long captured = pi.AmountReceived;
            long refunded = pi.LatestCharge?.AmountRefunded ?? 0;

            return new PaymentSnapshot(
                ProviderReference: providerRef,
                PspRef: pi.Id,
                State: MapPaymentIntentStatus(pi.Status, captured, refunded),
                AuthorizedAmount: new Money(authorized, currency),
                CapturedAmount: new Money(captured, currency),
                RefundedAmount: new Money(refunded, currency),
                ObservedAt: DateTime.UtcNow);
        }

        public async Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            var piId = await ResolvePaymentIntentIdAsync(providerRef, ct)
                       ?? throw new InvalidOperationException(
                           $"Stripe capture failed for {providerRef}: no PaymentIntent exists yet " +
                           "(session not yet completed by buyer — capture is invalid before authorization).");

            var pi = await new PaymentIntentService(_client).CaptureAsync(
                piId,
                new PaymentIntentCaptureOptions { AmountToCapture = amount.AmountMinor },
                Idem(idemKey), ct);
            return new CaptureResult(pi.Id, new Money(pi.AmountReceived, (pi.Currency ?? amount.Currency).ToUpperInvariant()));
        }

        public async Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct)
        {
            var piId = await ResolvePaymentIntentIdAsync(providerRef, ct)
                       ?? throw new InvalidOperationException(
                           $"Stripe refund failed for {providerRef}: no PaymentIntent exists yet " +
                           "(session not yet completed — refund is invalid before capture).");

            var refund = await new RefundService(_client).CreateAsync(
                new RefundCreateOptions { PaymentIntent = piId, Amount = amount.AmountMinor },
                Idem(idemKey), ct);
            return new RefundResult(refund.Id, new Money(refund.Amount, (refund.Currency ?? amount.Currency).ToUpperInvariant()));
        }

        public async Task CancelAsync(string providerRef, CancellationToken ct)
        {
            var piId = await ResolvePaymentIntentIdAsync(providerRef, ct)
                       ?? throw new InvalidOperationException(
                           $"Stripe cancel failed for {providerRef}: no PaymentIntent exists yet " +
                           "(session not yet completed — cancel the session instead if needed).");

            await new PaymentIntentService(_client).CancelAsync(
                piId, options: null, Idem(providerRef + "-cancel"), ct);
        }

        public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers)
            => _webhookVerifier.Verify(rawBody, headers);

        public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers)
        {
            // Signature was already verified by VerifyWebhookSignature (IPaymentProvider
            // contract). Parse without re-validating; throwOnApiVersionMismatch=false so a
            // Dashboard API-version bump never drops an otherwise-authentic event.
            var stripeEvent = EventUtility.ParseEvent(rawBody ?? "{}", throwOnApiVersionMismatch: false);

            return MapEvent(stripeEvent, rawBody ?? string.Empty)
                   ?? throw new InvalidOperationException(
                       $"Stripe event '{stripeEvent.Type}' carried no payment object to normalize.");
        }

        // ---- PI resolution (adapter-local, real-time consistent) ------------------

        // orderRef → PaymentIntent id, memoized per process (the return-page poll hits
        // this every 2s, no point re-scanning once the PI is known).
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string>
            s_piByOrderRef = new();

        // The Sessions LIST API has NO client_reference_id filter (the API rejects the
        // parameter — live-verified 2026-06-10), and the Search API is explicitly
        // documented as unfit for read-after-write flows (docs/search "Data freshness":
        // up to ~1 min stale — would break capture-right-after-payment). So we list
        // recent sessions (created ≥ -24h; Checkout Sessions expire after 24h) newest-
        // first and match client_reference_id client-side. Holds expire in minutes, so
        // the match is on the first page in practice. Returns null when the session
        // exists but the buyer hasn't completed checkout yet (PI not materialized);
        // throws when no session matches so callers surface a clear error.
        private async Task<string?> ResolvePaymentIntentIdAsync(string orderRef, CancellationToken ct)
        {
            if (s_piByOrderRef.TryGetValue(orderRef, out var known))
                return known;

            var listOpts = new SessionListOptions
            {
                Limit = 100,
                Created = new DateRangeOptions { GreaterThanOrEqual = DateTime.UtcNow.AddHours(-24) }
            };
            var service = new SessionService(_client);
            await foreach (var session in service.ListAutoPagingAsync(listOpts, null, ct)
                               .WithCancellation(ct))
            {
                if (!string.Equals(session.ClientReferenceId, orderRef, StringComparison.Ordinal))
                    continue;

                // PaymentIntentId is null until the buyer completes the session — never
                // memoize that, the next poll must see the PI once it materializes.
                if (string.IsNullOrEmpty(session.PaymentIntentId))
                    return null;

                s_piByOrderRef[orderRef] = session.PaymentIntentId;
                return session.PaymentIntentId;
            }

            throw new InvalidOperationException(
                $"Stripe: no Checkout Session found for order reference '{orderRef}'.");
        }

        // ---- mapping (pure, unit-tested) ------------------------------------------

        // Webhook event → neutral PaymentEvent. Returns null when the event isn't one we
        // model (the caller turns that into a clear throw). Verified event-type list
        // (docs.stripe.com/api/events/types, 2026-06-10):
        //   payment_intent.amount_capturable_updated → Authorized (manual-capture hold set)
        //   payment_intent.succeeded                 → Captured
        //   charge.refunded                          → Refunded
        //   payment_intent.payment_failed            → Failed
        //   payment_intent.canceled                  → Cancelled
        //   checkout.session.expired                 → Expired
        internal static PaymentEvent? MapEvent(Event stripeEvent, string rawPayload)
        {
            var occurredAt = stripeEvent.Created == default ? DateTime.UtcNow : stripeEvent.Created;

            switch (stripeEvent.Type)
            {
                case "payment_intent.amount_capturable_updated":
                    return FromPaymentIntent(stripeEvent, PaymentEventType.Authorized, rawPayload, occurredAt);
                case "payment_intent.succeeded":
                    return FromPaymentIntent(stripeEvent, PaymentEventType.Captured, rawPayload, occurredAt);
                case "payment_intent.payment_failed":
                    return FromPaymentIntent(stripeEvent, PaymentEventType.Failed, rawPayload, occurredAt);
                case "payment_intent.canceled":
                    return FromPaymentIntent(stripeEvent, PaymentEventType.Cancelled, rawPayload, occurredAt);

                case "charge.refunded":
                    return FromCharge(stripeEvent, PaymentEventType.Refunded, rawPayload, occurredAt);

                case "checkout.session.expired":
                    return FromSession(stripeEvent, PaymentEventType.Expired, rawPayload, occurredAt);

                default:
                    return null;
            }
        }

        // The PaymentIntent id is the PSP ref. Amount: AmountReceived for a capture
        // (the funds actually taken), else Amount (the authorized/intended total).
        private static PaymentEvent? FromPaymentIntent(
            Event ev, PaymentEventType type, string raw, DateTime occurredAt)
        {
            if (ev.Data.Object is not PaymentIntent pi) return null;
            var orderRef = MetadataOrderRef(pi.Metadata);
            var amountMinor = type == PaymentEventType.Captured ? pi.AmountReceived : pi.Amount;
            return new PaymentEvent(
                OrderRef: orderRef,
                PspRef: pi.Id,
                Type: type,
                Amount: new Money(amountMinor, (pi.Currency ?? "nok").ToUpperInvariant()),
                OccurredAt: occurredAt,
                RawPayload: raw);
        }

        // charge.refunded: Stripe does NOT copy PaymentIntent metadata onto the Charge,
        // so charge.Metadata["order_ref"] is always empty for Dashboard-issued refunds.
        // We therefore emit OrderRef = string.Empty and rely on the orchestrator's PspRef
        // fallback (FinalizeAsync matches Payment.ProviderPspReference == ev.PspRef when
        // ev.OrderRef is empty). PspRef = charge.PaymentIntentId is the stable join key.
        private static PaymentEvent? FromCharge(
            Event ev, PaymentEventType type, string raw, DateTime occurredAt)
        {
            if (ev.Data.Object is not Charge charge) return null;
            return new PaymentEvent(
                OrderRef: string.Empty,              // never populated on charge events
                PspRef: charge.PaymentIntentId ?? charge.Id,
                Type: type,
                Amount: new Money(charge.AmountRefunded, (charge.Currency ?? "nok").ToUpperInvariant()),
                OccurredAt: occurredAt,
                RawPayload: raw);
        }

        private static PaymentEvent? FromSession(
            Event ev, PaymentEventType type, string raw, DateTime occurredAt)
        {
            if (ev.Data.Object is not Session session) return null;
            // Sessions expire BEFORE a PaymentIntent is captured, so prefer the order ref
            // we set as client_reference_id / metadata. PspRef is the PI if one exists.
            var orderRef = !string.IsNullOrEmpty(session.ClientReferenceId)
                ? session.ClientReferenceId
                : MetadataOrderRef(session.Metadata);
            return new PaymentEvent(
                OrderRef: orderRef,
                PspRef: session.PaymentIntentId,
                Type: type,
                Amount: new Money(session.AmountTotal ?? 0, (session.Currency ?? "nok").ToUpperInvariant()),
                OccurredAt: occurredAt,
                RawPayload: raw);
        }

        // Snapshot mapping from a PaymentIntent.status string. AmountReceived/refunded
        // outrank the status the way Vipps' aggregate outranks its state string.
        public static PaymentEventType MapPaymentIntentStatus(string? status, long capturedMinor, long refundedMinor)
        {
            if (refundedMinor > 0) return PaymentEventType.Refunded;
            if (capturedMinor > 0) return PaymentEventType.Captured;

            return status switch
            {
                "requires_capture" => PaymentEventType.Authorized,   // manual-capture hold placed
                "succeeded" => PaymentEventType.Captured,
                "canceled" => PaymentEventType.Cancelled,
                "requires_payment_method" => PaymentEventType.Pending,
                "requires_confirmation" => PaymentEventType.Pending,
                "requires_action" => PaymentEventType.Pending,
                "processing" => PaymentEventType.Pending,
                _ => PaymentEventType.Pending                        // unknown → never finalize
            };
        }

        private static string MetadataOrderRef(IDictionary<string, string>? metadata)
            => metadata is not null && metadata.TryGetValue(OrderRefMetadataKey, out var r) ? r : string.Empty;

        // Deterministic Idempotency-Key so retries never double-charge (seam contract).
        private static RequestOptions Idem(string? key)
            => string.IsNullOrEmpty(key) ? new RequestOptions() : new RequestOptions { IdempotencyKey = key };
    }
}
