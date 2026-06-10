using DJDiP.Application.DTO.PaymentDTO;

namespace DJDiP.Application.Interfaces
{
    // Stateless checkout quote (checkout-orchestration design §4.2). Validates the
    // selection EXACTLY like PaymentOrchestrator.CreatePaymentAsync (status, sales
    // window, min/max-per-order, hidden-unlock, live availability) and prices it
    // (incl. promo) with NO side effects, ever. The returned totals are advisory for
    // display; create re-validates and re-prices from the DB inside its own
    // transaction — a quote is never trusted as an input to create.
    public interface ICheckoutQuoteService
    {
        Task<CheckoutQuote> QuoteAsync(CheckoutSelection selection, string? userId, CancellationToken ct);
    }
}
