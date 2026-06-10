using DJDiP.Application.Interfaces;
using DJDiP.Infrastructure.Payments.Vipps;
using Microsoft.AspNetCore.Mvc;

namespace DJDiP.API.Controllers;

// P6: the single normalized payment-webhook endpoint (design §3 — "Do NOT build
// per-provider endpoints with duplicated logic"). Modeled on IngestController:
// [ApiController] under /api, covered by MapControllers() and the Traefik /api route.
//
// Auth is NOT JWT — each provider signs its webhooks and the matching
// IPaymentProvider verifies that signature (constant-time) before anything is parsed.
// Issuance authority: a verified CAPTURED event through orchestrator.FinalizeAsync —
// the same idempotent path the checkout-return poll (reconcileTicketOrder) drives,
// so webhook + poll can never double-issue (layer-1 dedup + the CAS guard).
//
// Vipps subscription registration is a DEPLOY-TIME task (needs the public URL):
//   POST https://api.vipps.no/webhooks/v1/webhooks
//     { "url": "https://klubn.no/api/webhooks/payments/vipps",
//       "events": ["epayment.payment.authorized.v1", "epayment.payment.captured.v1",
//                  "epayment.payment.cancelled.v1", "epayment.payment.expired.v1",
//                  "epayment.payment.refunded.v1", "epayment.payment.terminated.v1"] }
//   → store the returned secret as VIPPS_WEBHOOK_SECRET (env Vipps__WebhookSecret).
//
// Logging hygiene (vipps-v1-plan §security): reference + event type only — never
// raw bodies, never Authorization/signature headers.
[ApiController]
[Route("api/webhooks/payments")]
public class PaymentsWebhookController : ControllerBase
{
    private readonly IPaymentProvider _provider;
    private readonly IPaymentOrchestrator _orchestrator;
    private readonly ILogger<PaymentsWebhookController> _log;

    public PaymentsWebhookController(
        IPaymentProvider provider,
        IPaymentOrchestrator orchestrator,
        ILogger<PaymentsWebhookController> log)
    {
        _provider = provider;
        _orchestrator = orchestrator;
        _log = log;
    }

    [HttpPost("{provider}")]
    public async Task<IActionResult> Receive(string provider, CancellationToken ct)
    {
        // Route segment must match the ACTIVE provider — a webhook for a provider
        // that isn't configured can't be verified, so it can't be trusted.
        if (!string.Equals(provider, _provider.Name, StringComparison.OrdinalIgnoreCase))
        {
            _log.LogWarning("Webhook for inactive provider segment '{Segment}' rejected.", provider);
            return NotFound();
        }

        // The provider seam verifies over the RAW body — read it before any binding.
        string rawBody;
        using (var reader = new StreamReader(Request.Body))
            rawBody = await reader.ReadToEndAsync(ct);

        // Flatten headers for the seam. The Vipps verifier additionally needs the
        // request path+query (part of its string-to-sign), passed as a pseudo-header
        // because IPaymentProvider's contract only carries (rawBody, headers).
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in Request.Headers)
            headers[h.Key] = h.Value.ToString();
        headers[VippsWebhookSignatureVerifier.PathPseudoHeader] =
            Request.Path.Value + Request.QueryString.Value;
        if (!headers.ContainsKey("host") && Request.Host.HasValue)
            headers["host"] = Request.Host.Value ?? string.Empty;

        // ALWAYS verify before normalize (IPaymentProvider contract).
        if (!_provider.VerifyWebhookSignature(rawBody, headers))
        {
            _log.LogWarning("Webhook signature verification FAILED for provider {Provider}.", _provider.Name);
            return Unauthorized();
        }

        DJDiP.Application.DTO.PaymentDTO.PaymentEvent ev;
        try
        {
            ev = _provider.NormalizeWebhook(rawBody, headers);
        }
        catch (Exception ex)
        {
            // Signature was valid, so this is a malformed-but-authentic payload —
            // log the shape problem (no body contents) and reject as bad request.
            _log.LogError(ex, "Webhook normalization failed for provider {Provider}.", _provider.Name);
            return BadRequest();
        }

        await _orchestrator.FinalizeAsync(ev, ct);
        _log.LogInformation("Webhook processed: {Provider} {Type} for {Reference}.",
            _provider.Name, ev.Type, ev.OrderRef);

        // Always 200 once verified+processed — duplicates are idempotent no-ops
        // inside FinalizeAsync, and a 200 stops provider retry storms.
        return Ok();
    }
}
