using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    // Stateless, side-effect-free checkout pricing (checkout-orchestration design §4.2).
    //
    // The validation rule set here MUST stay in lockstep with
    // PaymentOrchestrator.CreatePaymentAsync (the create path re-derives everything from
    // DB truth). Replicated rules, in order:
    //   1. cart non-empty
    //   2. collapse duplicate lines for the same tier
    //   3. quantity >= 1 per collapsed line
    //   4. every type belongs to the event (count mismatch => "not found")
    //   5. Status == OnSale
    //   6. now within [SalesStart, SalesEnd] when set
    //   7. quantity within [MinPerOrder, MaxPerOrder]
    // PLUS new-in-C2 rules:
    //   8. a line whose type IsHidden is rejected with the SAME "not found" message as an
    //      unknown type (never leak hidden-tier existence) UNLESS the promo unlocks it
    //   9. live availability (Capacity - QuantitySold - QuantityHeld); requested > available
    //      => Ok=false "sold out or too few left" (mirrors create's reservation error)
    //
    // An invalid promo does NOT fail the quote (design §5): the quote returns with
    // Promo.Ok=false + Reason and totals WITHOUT the discount.
    public sealed class CheckoutQuoteService : ICheckoutQuoteService
    {
        private const string Currency = "NOK";
        private const string NotFoundMessage = "One or more ticket types were not found for this event.";

        private readonly IUnitOfWork _unitOfWork;
        private readonly IPromoCodeService _promoCodes;
        private readonly IPaymentProviderCatalog _providers;

        public CheckoutQuoteService(
            IUnitOfWork unitOfWork,
            IPromoCodeService promoCodes,
            IPaymentProviderCatalog providers)
        {
            _unitOfWork = unitOfWork;
            _promoCodes = promoCodes;
            _providers = providers;
        }

        public async Task<CheckoutQuote> QuoteAsync(CheckoutSelection selection, string? userId, CancellationToken ct)
        {
            var providers = _providers.EnabledProviders;

            if (selection.Lines is null || selection.Lines.Count == 0)
                return CheckoutQuote.Failed("Your cart is empty.", Currency, providers);

            // Collapse duplicate lines for the same tier.
            var requested = selection.Lines
                .GroupBy(l => l.TicketTypeId)
                .Select(g => new { TicketTypeId = g.Key, Quantity = g.Sum(x => x.Quantity) })
                .ToList();

            if (requested.Any(r => r.Quantity <= 0))
                return CheckoutQuote.Failed("Ticket quantity must be at least 1.", Currency, providers);

            var typeIds = requested.Select(r => r.TicketTypeId).ToList();
            var types = await _unitOfWork.TicketTypes.GetByEventAndIdsAsync(selection.EventId, typeIds, ct);
            if (types.Count != requested.Count)
                return CheckoutQuote.Failed(NotFoundMessage, Currency, providers);

            // Validate the promo (if supplied) BEFORE the hidden-line rejection so an
            // unlocked hidden line survives. The promo validator receives the resolved
            // line data as PromoLine[] (pure core; no DB beyond the promo row).
            CheckoutQuotePromo? promoResult = null;
            PromoValidationResult? promo = null;
            var hasPromo = !string.IsNullOrWhiteSpace(selection.PromoCode);
            if (hasPromo)
            {
                var promoLines = requested
                    .Select(r =>
                    {
                        var t = types[r.TicketTypeId];
                        return new PromoLine(t.Id, r.Quantity, t.PriceMinor, t.VATRate, t.IsHidden);
                    })
                    .ToList();

                promo = await _promoCodes.ValidateAsync(selection.PromoCode!, selection.EventId, promoLines, userId, ct);
                promoResult = new CheckoutQuotePromo(promo.Code, promo.Ok, promo.Reason);
            }

            var unlocked = promo is { Ok: true }
                ? promo.UnlockedTicketTypeIds.ToHashSet()
                : new HashSet<Guid>();

            var now = DateTime.UtcNow;

            // Per-line validation (mirrors create) + new hidden/availability rules.
            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];

                // Hidden tier: reject with the same message as an unknown type unless the
                // promo unlocks it — never leak hidden-tier existence.
                if (t.IsHidden && !unlocked.Contains(t.Id))
                    return CheckoutQuote.Failed(NotFoundMessage, Currency, providers);

                if (t.Status != TicketTypeStatus.OnSale)
                    return CheckoutQuote.Failed($"\"{t.Name}\" is not on sale.", Currency, providers);
                if (t.SalesStart.HasValue && now < t.SalesStart.Value)
                    return CheckoutQuote.Failed($"Sales for \"{t.Name}\" have not started yet.", Currency, providers);
                if (t.SalesEnd.HasValue && now > t.SalesEnd.Value)
                    return CheckoutQuote.Failed($"Sales for \"{t.Name}\" have ended.", Currency, providers);
                if (r.Quantity < t.MinPerOrder)
                    return CheckoutQuote.Failed($"Minimum {t.MinPerOrder} for \"{t.Name}\".", Currency, providers);
                if (r.Quantity > t.MaxPerOrder)
                    return CheckoutQuote.Failed($"Maximum {t.MaxPerOrder} per order for \"{t.Name}\".", Currency, providers);

                var available = t.Capacity - t.QuantitySold - t.QuantityHeld;
                if (r.Quantity > available)
                    return CheckoutQuote.Failed($"\"{t.Name}\" is sold out or has too few left.", Currency, providers);
            }

            // Per-line discount allocation from the promo (only when the promo validated Ok).
            var discountByType = promo is { Ok: true }
                ? promo.PerLineDiscounts.ToDictionary(d => d.TicketTypeId, d => d.DiscountMinor)
                : new Dictionary<Guid, long>();

            long subtotalMinor = 0, vatMinor = 0, totalMinor = 0, discountMinor = 0;
            var lines = new List<CheckoutQuoteLine>(requested.Count);

            foreach (var r in requested)
            {
                var t = types[r.TicketTypeId];
                var lineGross = checked(t.PriceMinor * r.Quantity);     // VAT-inclusive
                discountByType.TryGetValue(t.Id, out var lineDiscount);
                if (lineDiscount > lineGross) lineDiscount = lineGross; // never exceed gross
                var discountedGross = lineGross - lineDiscount;

                // VAT on the DISCOUNTED gross (prices are VAT-inclusive).
                var net = (long)Math.Round(discountedGross / (1m + t.VATRate), MidpointRounding.AwayFromZero);
                var vat = discountedGross - net;

                subtotalMinor += net;
                vatMinor += vat;
                totalMinor += discountedGross;
                discountMinor += lineDiscount;

                lines.Add(new CheckoutQuoteLine(
                    TicketTypeId: t.Id,
                    Name: t.Name,
                    Quantity: r.Quantity,
                    UnitPriceMinor: t.PriceMinor,
                    VatRate: t.VATRate,
                    LineGrossMinor: lineGross,
                    DiscountMinor: lineDiscount,
                    LineTotalMinor: discountedGross));
            }

            return new CheckoutQuote(
                Ok: true,
                Reason: null,
                Lines: lines,
                SubtotalMinor: subtotalMinor,
                DiscountMinor: discountMinor,
                VatMinor: vatMinor,
                TotalMinor: totalMinor,
                Currency: Currency,
                Promo: promoResult,
                AvailableProviders: providers);
        }
    }
}
