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
// Vipps subscription: REGISTERED 2026-06-10 via scripts/register-vipps-webhook.py
// (id d3986ab9-63b3-4d98-8d26-bc0a543bc942) for all epayments.payment.*.v1 events —
// note the PLURAL "epayments." domain prefix; the singular form is rejected with 400.
// The returned secret lives in env Vipps__WebhookSecret (VIPPS_WEBHOOK_SECRET).
//
// Logging hygiene (vipps-v1-plan §security): reference + event type only — never
// raw bodies, never Authorization/signature headers.
[ApiController]
[Route("api/webhooks/payments")]
public class PaymentsWebhookController : ControllerBase
{
    private readonly IPaymentProviderRegistry _registry;
    private readonly IPaymentOrchestrator _orchestrator;
    private readonly ILogger<PaymentsWebhookController> _log;

    public PaymentsWebhookController(
        IPaymentProviderRegistry registry,
        IPaymentOrchestrator orchestrator,
        ILogger<PaymentsWebhookController> log)
    {
        _registry = registry;
        _orchestrator = orchestrator;
        _log = log;
    }

    [HttpPost("{provider}")]
    public async Task<IActionResult> Receive(string provider, CancellationToken ct)
    {
        // Route segment must name an ENABLED provider — a webhook for a provider that
        // isn't configured can't be verified, so it can't be trusted. (C3: resolve from
        // the registry instead of a single active provider.)
        if (!_registry.IsEnabled(provider))
        {
            _log.LogWarning("Webhook for inactive provider segment '{Segment}' rejected.", provider);
            return NotFound();
        }

        var resolved = _registry.Resolve(provider);

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
        if (!resolved.VerifyWebhookSignature(rawBody, headers))
        {
            _log.LogWarning("Webhook signature verification FAILED for provider {Provider}.", resolved.Name);
            return Unauthorized();
        }

        DJDiP.Application.DTO.PaymentDTO.PaymentEvent ev;
        try
        {
            ev = resolved.NormalizeWebhook(rawBody, headers);
        }
        catch (Exception ex)
        {
            // Signature was valid, so this is a malformed-but-authentic payload —
            // log the shape problem (no body contents) and reject as bad request.
            _log.LogError(ex, "Webhook normalization failed for provider {Provider}.", resolved.Name);
            return BadRequest();
        }

        // Pass the resolved segment name so FinalizeAsync can WARN+ignore a webhook that
        // arrives on the wrong provider's route for this Payment row (design §8).
        await _orchestrator.FinalizeAsync(ev, ct, resolved.Name);
        _log.LogInformation("Webhook processed: {Provider} {Type} for {Reference}.",
            resolved.Name, ev.Type, ev.OrderRef);

        // Always 200 once verified+processed — duplicates are idempotent no-ops
        // inside FinalizeAsync, and a 200 stops provider retry storms.
        return Ok();
    }
}
