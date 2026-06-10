using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.API.Controllers;

// C5 REST request bodies for /api/checkout (design §5). Thin DTOs — the controller
// translates these into the SAME Application service calls the GraphQL resolvers use,
// so there is exactly one code path. Lines reuse OrderLineInput {ticketTypeId, quantity}.
//
// Money is never accepted from the client: the server resolves all prices from
// TicketType. These carry only the SELECTION + optional promo/provider/email.
//
// JSON binds camelCase by default (AddControllers, System.Text.Json) so the wire shape
// is { eventId, lines:[{ticketTypeId, quantity}], promoCode?, ... }.

public sealed class CheckoutQuoteRequest
{
    public Guid EventId { get; set; }
    public List<OrderLineInput> Lines { get; set; } = new();
    public string? PromoCode { get; set; }
}

public sealed class CheckoutCreateRequest
{
    public Guid EventId { get; set; }
    public List<OrderLineInput> Lines { get; set; } = new();
    public string? PromoCode { get; set; }
    public string? Provider { get; set; }
    public string? CustomerEmail { get; set; }
}

public sealed class CheckoutRetryRequest
{
    public string Reference { get; set; } = string.Empty;
    public string? Provider { get; set; }
}

// create/retry response: the resolved order summary + off-site redirect + the provider
// actually used (so the FE can label "Pay with {provider}"). Mirrors the GraphQL
// CreateTicketOrderPayload one-for-one.
public sealed record CheckoutOrderResponse(
    OrderSummary Order,
    string RedirectUrl,
    string Provider);
