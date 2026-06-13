using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DJDiP.API.Controllers;

// C5 REST checkout surface (checkout-orchestration design §5). A THIN wrapper over the
// SAME Application services the GraphQL resolvers use (ICheckoutQuoteService +
// IPaymentOrchestrator) — ZERO business logic lives here. One code path, two surfaces.
//
// Auth: controller-level [Authorize] (JWT), matching FileUploadController. The identity is
// always the authenticated principal's "userId" claim — never trusted from the body
// (P0-T3 identity rule). quote is [AllowAnonymous] because a logged-out shopper can price
// a cart (design §4.2: anonymous-allowed; per-user promo limits just see userId=null).
//
// Error mapping (design §5/§8): the orchestrator/quote services throw
// InvalidOperationException for business failures. We map pragmatically WITHOUT fragile
// message string-matching:
//   - empty cart / unknown provider  -> 400 (bad input — caller can fix the request)
//   - everything else (sold out, code exhausted/invalid, not on sale, ownership) -> 409
//     (a state conflict the caller can't fix by editing the request).
// Auth (401) is handled by [Authorize] before any handler runs.
[ApiController]
[Route("api/checkout")]
[Authorize]
public class CheckoutController : ControllerBase
{
    private readonly ICheckoutQuoteService _quotes;
    private readonly IPaymentOrchestrator _orchestrator;
    private readonly IPromoAttemptThrottle _promoThrottle;

    public CheckoutController(
        ICheckoutQuoteService quotes,
        IPaymentOrchestrator orchestrator,
        IPromoAttemptThrottle promoThrottle)
    {
        _quotes = quotes;
        _orchestrator = orchestrator;
        _promoThrottle = promoThrottle;
    }

    // Identity from the JWT principal (same claim the GraphQL RequireAuthentication reads).
    private string? CurrentUserId() => User.FindFirst("userId")?.Value;

    // The two business-input failures that are the caller's fault (fixable by editing the
    // request) and therefore map to 400 rather than 409. Kept as an explicit set so the
    // mapping is robust: the orchestrator raises these BEFORE any state exists (design §8).
    private static readonly HashSet<string> BadInputMessages = new(StringComparer.Ordinal)
    {
        "Your cart is empty.",
        "Ticket quantity must be at least 1.",
        "Unknown payment provider."
    };

    // POST /api/checkout/quote — stateless price of a selection (incl. promo). 200 even
    // when the promo is invalid (quote.promo.ok=false + reason) OR the selection is invalid
    // (quote.ok=false + reason) so the UI can render inline feedback. 400 only for
    // structurally bad input (malformed JSON / missing fields — handled by [ApiController]
    // model validation before this runs).
    [HttpPost("quote")]
    [AllowAnonymous]
    public async Task<ActionResult<CheckoutQuote>> Quote(
        [FromBody] CheckoutQuoteRequest body, CancellationToken ct)
    {
        // Release-gate P2 (2026-06-13): mirror the GraphQL quote throttle — a brute-forcing IP
        // gets its promo lookup suppressed (cart still prices), denying the validity oracle.
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var hasPromo = !string.IsNullOrWhiteSpace(body.PromoCode);
        var effectivePromo = (hasPromo && _promoThrottle.IsThrottled(ip)) ? null : body.PromoCode;
        var lines = (body.Lines ?? new List<OrderLineInput>())
            .Select(l => new CheckoutSelectionLine(l.TicketTypeId, l.Quantity))
            .ToList();
        var selection = new CheckoutSelection(body.EventId, lines, effectivePromo);
        var quote = await _quotes.QuoteAsync(selection, CurrentUserId(), ct);
        if (hasPromo && effectivePromo is not null)
        {
            if (quote.Promo is { Ok: false }) _promoThrottle.RegisterFailure(ip);
            else if (quote.Promo is { Ok: true }) _promoThrottle.Reset(ip);
        }
        return Ok(quote);
    }

    // POST /api/checkout/create — create the order, reserve inventory + promo, start the
    // payment. 200 with the resolved summary + redirectUrl + provider actually used.
    [HttpPost("create")]
    public async Task<ActionResult<CheckoutOrderResponse>> Create(
        [FromBody] CheckoutCreateRequest body, CancellationToken ct)
    {
        var userId = CurrentUserId();
        var lines = (body.Lines ?? new List<OrderLineInput>())
            .Select(l => new OrderLineRequest(l.TicketTypeId, l.Quantity))
            .ToList();
        try
        {
            var result = await _orchestrator.CreatePaymentAsync(
                body.EventId, lines, body.CustomerEmail, userId,
                body.PromoCode, body.Provider, ct);
            return Ok(new CheckoutOrderResponse(result.Order, result.RedirectUrl, result.Provider));
        }
        catch (InvalidOperationException ex)
        {
            return Problem(ex);
        }
    }

    // POST /api/checkout/retry — start a NEW attempt on an unpaid order (owner-checked in
    // the orchestrator). Same response/error shape as create.
    [HttpPost("retry")]
    public async Task<ActionResult<CheckoutOrderResponse>> Retry(
        [FromBody] CheckoutRetryRequest body, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        try
        {
            var result = await _orchestrator.RetryPaymentAsync(body.Reference, body.Provider, userId, ct);
            return Ok(new CheckoutOrderResponse(result.Order, result.RedirectUrl, result.Provider));
        }
        catch (InvalidOperationException ex)
        {
            return Problem(ex);
        }
    }

    // ProblemDetails for a business failure: 400 for fixable bad input, 409 for a state
    // conflict. Title carries the human message so the FE can surface it inline.
    private ObjectResult Problem(InvalidOperationException ex)
    {
        var status = BadInputMessages.Contains(ex.Message)
            ? StatusCodes.Status400BadRequest
            : StatusCodes.Status409Conflict;
        return Problem(detail: ex.Message, statusCode: status);
    }
}
