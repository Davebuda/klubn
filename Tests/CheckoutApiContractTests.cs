using System.Text.Json;
using DJDiP.Application.DTO.PaymentDTO;
using Xunit;

namespace DJDiP.Tests
{
    // C5 API-surface contract tests. The full request/response behaviour (auth, error
    // status codes, route existence) is covered by C8 runtime E2E against a live backend;
    // these lock the two things a unit test CAN prove deterministically:
    //   1. the orchestrator result carries the ACTUAL provider used (so create/retry can
    //      label "Pay with {provider}" — the bug C5 fixes was returning a global default);
    //   2. the wire DTOs serialize to the pinned camelCase JSON shape the frontend (C10)
    //      consumes — money fields in minor units, VatRate -> "vatRate" (not "vATRate").
    public class CheckoutApiContractTests
    {
        // System.Text.Json with ASP.NET Core's default camelCase policy = the exact
        // serializer AddControllers() and HotChocolate's JSON both use on the wire.
        private static readonly JsonSerializerOptions Web =
            new(JsonSerializerDefaults.Web);

        [Fact]
        public async Task Create_result_carries_the_actual_provider_used()
        {
            using var h = new OrchestratorTestHarness(); // default provider == "Sandbox"
            var (eventId, type) = h.SeedEvent(priceMinor: 50000, capacity: 10);
            var user = h.SeedUser();

            var result = await h.Orchestrator.CreatePaymentAsync(
                eventId, new[] { new OrderLineRequest(type.Id, 1) },
                customerEmail: null, actingUserId: user.Id,
                promoCode: null, provider: null, CancellationToken.None);

            Assert.Equal("Sandbox", result.Provider);
        }

        [Fact]
        public void Create_payload_serializes_camelCase_with_minor_units()
        {
            // CreatePaymentResult is the Application-layer shape the REST CheckoutOrderResponse
            // and the GraphQL CreateTicketOrderPayload both mirror 1:1 ({ order, redirectUrl,
            // provider }). Asserting it here locks the wire contract for both surfaces.
            var summary = new OrderSummary(
                Reference: "klubn-abc123",
                Lines: new[]
                {
                    new OrderLineSummary(
                        TicketTypeName: "GA", Quantity: 2, AdmitCount: 1,
                        UnitPriceMinor: 10000, VatRate: 0.12m, LineTotalMinor: 20000)
                },
                SubtotalMinor: 17857,
                VatMinor: 2143,
                TotalMinor: 20000,
                Currency: "NOK");
            var resp = new CreatePaymentResult(summary, "https://pay.example/abc", "Vipps");

            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(resp, Web));
            var root = doc.RootElement;

            // top-level shape: { order, redirectUrl, provider }
            Assert.Equal("https://pay.example/abc", root.GetProperty("redirectUrl").GetString());
            Assert.Equal("Vipps", root.GetProperty("provider").GetString());

            var order = root.GetProperty("order");
            Assert.Equal("klubn-abc123", order.GetProperty("reference").GetString());
            Assert.Equal(17857, order.GetProperty("subtotalMinor").GetInt64());
            Assert.Equal(2143, order.GetProperty("vatMinor").GetInt64());
            Assert.Equal(20000, order.GetProperty("totalMinor").GetInt64());
            Assert.Equal("NOK", order.GetProperty("currency").GetString());

            var line = order.GetProperty("lines")[0];
            Assert.Equal("GA", line.GetProperty("ticketTypeName").GetString());
            Assert.Equal(10000, line.GetProperty("unitPriceMinor").GetInt64());
            // The pinned-casing rule: VatRate -> "vatRate", never "vATRate".
            Assert.Equal(0.12m, line.GetProperty("vatRate").GetDecimal());
            Assert.Equal(20000, line.GetProperty("lineTotalMinor").GetInt64());
        }

        [Fact]
        public void CheckoutQuote_serializes_camelCase_with_promo_subobject()
        {
            var quote = new CheckoutQuote(
                Ok: true,
                Reason: null,
                Lines: new[]
                {
                    new CheckoutQuoteLine(
                        TicketTypeId: Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        Name: "GA", Quantity: 1, UnitPriceMinor: 10000, VatRate: 0.12m,
                        LineGrossMinor: 10000, DiscountMinor: 1000, LineTotalMinor: 9000)
                },
                SubtotalMinor: 8036,
                DiscountMinor: 1000,
                VatMinor: 964,
                TotalMinor: 9000,
                Currency: "NOK",
                Promo: new CheckoutQuotePromo("SAVE10", Ok: true, Reason: null),
                AvailableProviders: new[] { "Vipps", "Stripe" });

            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(quote, Web));
            var root = doc.RootElement;

            Assert.True(root.GetProperty("ok").GetBoolean());
            Assert.Equal(1000, root.GetProperty("discountMinor").GetInt64());
            Assert.Equal(9000, root.GetProperty("totalMinor").GetInt64());

            var promo = root.GetProperty("promo");
            Assert.Equal("SAVE10", promo.GetProperty("code").GetString());
            Assert.True(promo.GetProperty("ok").GetBoolean());

            var providers = root.GetProperty("availableProviders");
            Assert.Equal("Vipps", providers[0].GetString());
            Assert.Equal("Stripe", providers[1].GetString());

            var line = root.GetProperty("lines")[0];
            Assert.Equal("vatRate", line.EnumerateObject().Single(p =>
                p.Name.Equals("vatRate", StringComparison.Ordinal)).Name); // casing locked
            Assert.Equal(9000, line.GetProperty("lineTotalMinor").GetInt64());
        }
    }
}
