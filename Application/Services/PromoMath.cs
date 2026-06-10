using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    // Pure, deterministic discount math (checkout-orchestration design §4.1). No DB, no
    // clock, no I/O — exhaustively unit-testable. All amounts are minor units (øre).
    //
    // Invariants enforced here:
    //  - A line's discount never exceeds its gross.
    //  - Percent: per eligible line, round(lineGross * pct / 100, AwayFromZero), summed.
    //  - FixedAmount: min(AmountMinor, eligibleGross) allocated across eligible lines
    //    proportionally by line gross using LARGEST-REMAINDER so the parts sum EXACTLY
    //    to the total discount (never over/under by a rounding øre).
    //  - 100% / fixed>=total ⇒ total discount can equal eligible gross (free order is
    //    legal; the orchestrator handles the zero-total case in C4 — not here).
    //
    // VAT is intentionally NOT computed here — this returns discount amounts only; the
    // quote service / orchestrator applies VAT on the discounted gross per line.
    public static class PromoMath
    {
        // Computes the per-line discount allocation for the given eligible lines.
        // `eligible` carries (TicketTypeId, LineGrossMinor) for lines the promo applies
        // to. Returns one entry per eligible line (lines with 0 discount are included so
        // callers get a complete, deterministic map). Sum of results == total discount.
        public static IReadOnlyList<PromoLineDiscount> Allocate(
            PromoKind kind,
            decimal discountPercentage,
            long fixedAmountMinor,
            IReadOnlyList<(Guid TicketTypeId, long LineGrossMinor)> eligible)
        {
            if (eligible.Count == 0)
                return Array.Empty<PromoLineDiscount>();

            return kind == PromoKind.Percent
                ? AllocatePercent(discountPercentage, eligible)
                : AllocateFixed(fixedAmountMinor, eligible);
        }

        private static IReadOnlyList<PromoLineDiscount> AllocatePercent(
            decimal pct,
            IReadOnlyList<(Guid TicketTypeId, long LineGrossMinor)> eligible)
        {
            var result = new List<PromoLineDiscount>(eligible.Count);
            foreach (var (id, gross) in eligible)
            {
                // round(gross * pct/100) — capped at gross (pct>100 or negative guarded).
                var raw = (decimal)gross * pct / 100m;
                var disc = (long)Math.Round(raw, MidpointRounding.AwayFromZero);
                if (disc < 0) disc = 0;
                if (disc > gross) disc = gross;
                result.Add(new PromoLineDiscount(id, disc));
            }
            return result;
        }

        private static IReadOnlyList<PromoLineDiscount> AllocateFixed(
            long fixedAmountMinor,
            IReadOnlyList<(Guid TicketTypeId, long LineGrossMinor)> eligible)
        {
            var eligibleGross = eligible.Sum(e => e.LineGrossMinor);
            var totalDiscount = Math.Min(fixedAmountMinor, eligibleGross);
            if (totalDiscount <= 0 || eligibleGross <= 0)
                return eligible.Select(e => new PromoLineDiscount(e.TicketTypeId, 0L)).ToList();

            // Largest-remainder apportionment: floor each line's exact share, then hand
            // the leftover øre (totalDiscount - sum(floors)) to the lines with the
            // largest fractional remainders. Guarantees parts sum EXACTLY to totalDiscount.
            var floors = new long[eligible.Count];
            var remainders = new (int Index, decimal Frac)[eligible.Count];
            long allocated = 0;

            for (var i = 0; i < eligible.Count; i++)
            {
                var exact = (decimal)totalDiscount * eligible[i].LineGrossMinor / eligibleGross;
                var floor = (long)Math.Floor(exact);
                floors[i] = floor;
                remainders[i] = (i, exact - floor);
                allocated += floor;
            }

            var leftover = totalDiscount - allocated;
            // Distribute leftover to the largest fractional remainders (ties → lowest index
            // for determinism).
            foreach (var r in remainders
                         .OrderByDescending(x => x.Frac)
                         .ThenBy(x => x.Index)
                         .Take((int)leftover))
            {
                floors[r.Index] += 1;
            }

            var result = new List<PromoLineDiscount>(eligible.Count);
            for (var i = 0; i < eligible.Count; i++)
            {
                var disc = floors[i];
                if (disc > eligible[i].LineGrossMinor) disc = eligible[i].LineGrossMinor; // never exceed gross
                result.Add(new PromoLineDiscount(eligible[i].TicketTypeId, disc));
            }
            return result;
        }
    }
}
