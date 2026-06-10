using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // Pure discount-math smoke set (checkout-orchestration C2). The full rounding/100%/
    // fixed>total matrix is C6; these lock the load-bearing invariants:
    //   - percent rounds per line (AwayFromZero)
    //   - fixed-amount largest-remainder allocation sums EXACTLY to the total discount
    //   - a line's discount never exceeds its gross
    public class PromoMathTests
    {
        private static (Guid, long) Line(long gross) => (Guid.NewGuid(), gross);

        [Fact]
        public void Percent_rounds_each_line_away_from_zero()
        {
            // 15% of 333 = 49.95 -> 50 (AwayFromZero); 15% of 100 = 15.
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.Percent, 15m, 0,
                new[] { (a, 333L), (b, 100L) });

            Assert.Equal(50, result.Single(r => r.TicketTypeId == a).DiscountMinor);
            Assert.Equal(15, result.Single(r => r.TicketTypeId == b).DiscountMinor);
        }

        [Fact]
        public void Percent_never_exceeds_line_gross()
        {
            var a = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.Percent, 150m, 0, new[] { (a, 1000L) });
            Assert.Equal(1000, result.Single().DiscountMinor); // capped at gross, not 1500
        }

        [Fact]
        public void Fixed_amount_largest_remainder_sums_exactly_to_total()
        {
            // 100 øre across three lines of gross 100/100/100: exact share 33.33 each;
            // floors 33/33/33 = 99, leftover 1 øre goes to the first by tie-break -> 34/33/33.
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var c = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 100,
                new[] { (a, 100L), (b, 100L), (c, 100L) });

            Assert.Equal(100, result.Sum(r => r.DiscountMinor)); // sums EXACTLY
            Assert.Equal(34, result.Single(r => r.TicketTypeId == a).DiscountMinor);
            Assert.Equal(33, result.Single(r => r.TicketTypeId == b).DiscountMinor);
            Assert.Equal(33, result.Single(r => r.TicketTypeId == c).DiscountMinor);
        }

        [Fact]
        public void Fixed_amount_proportional_by_line_gross_sums_exactly()
        {
            // 1000 øre across gross 700/300: exact 700/300 -> floors already sum to 1000.
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 1000,
                new[] { (a, 700L), (b, 300L) });

            Assert.Equal(1000, result.Sum(r => r.DiscountMinor));
            Assert.Equal(700, result.Single(r => r.TicketTypeId == a).DiscountMinor);
            Assert.Equal(300, result.Single(r => r.TicketTypeId == b).DiscountMinor);
        }

        [Fact]
        public void Fixed_amount_capped_at_eligible_gross_when_greater_than_total()
        {
            // Fixed 5000 but eligible gross only 1200 -> total discount = 1200 (free order).
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();
            var result = PromoMath.Allocate(PromoKind.FixedAmount, 0m, 5000,
                new[] { (a, 800L), (b, 400L) });

            Assert.Equal(1200, result.Sum(r => r.DiscountMinor));
            Assert.True(result.All(r => r.DiscountMinor <= 800));
        }
    }
}
