using DJDiP.Application.DTO.PaymentDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Infrastructure.Payments;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DJDiP.Tests
{
    // C3 (checkout-orchestration design §4.3): the provider registry. These tests exercise
    // resolve (known / unknown / case-insensitive), IsEnabled, and the EnabledProviders /
    // DefaultProvider catalog view — including the single-provider parity case that proves
    // today's behaviour is unchanged. Keyed DI is wired with hand-rolled fake providers so
    // the registry's GetRequiredKeyedService path is the real one under test.
    public class PaymentProviderRegistryTests
    {
        // A no-op IPaymentProvider whose Name is set per registration. Only Name is read by
        // these tests; every other member throws so an accidental call surfaces loudly.
        private sealed class StubProvider : IPaymentProvider
        {
            public StubProvider(string name) => Name = name;
            public string Name { get; }
            public Task<InitiateResult> InitiateAsync(InitiateRequest request, CancellationToken ct) => throw new NotSupportedException();
            public Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct) => throw new NotSupportedException();
            public Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct) => throw new NotSupportedException();
            public Task<RefundResult> RefundAsync(string providerRef, Money amount, string idemKey, CancellationToken ct) => throw new NotSupportedException();
            public Task CancelAsync(string providerRef, CancellationToken ct) => throw new NotSupportedException();
            public bool VerifyWebhookSignature(string rawBody, IDictionary<string, string> headers) => throw new NotSupportedException();
            public PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string, string> headers) => throw new NotSupportedException();
        }

        // Build a registry over the given enabled providers, with a keyed StubProvider per
        // name and the first name as the default — the same shape Program.cs wires.
        private static (IPaymentProviderRegistry registry, IServiceProvider sp) Build(params string[] enabled)
        {
            var services = new ServiceCollection();
            foreach (var name in enabled)
            {
                var captured = name; // avoid the foreach-closure trap
                services.AddKeyedScoped<IPaymentProvider>(captured, (_, _) => new StubProvider(captured));
            }
            var sp = services.BuildServiceProvider();
            var registry = new PaymentProviderRegistry(sp, enabled, enabled[0]);
            return (registry, sp);
        }

        [Fact]
        public void Resolve_KnownProvider_ReturnsThatProvider()
        {
            var (registry, _) = Build("Vipps", "Stripe");
            Assert.Equal("Vipps", registry.Resolve("Vipps").Name);
            Assert.Equal("Stripe", registry.Resolve("Stripe").Name);
        }

        [Theory]
        [InlineData("vipps")]
        [InlineData("VIPPS")]
        [InlineData("ViPpS")]
        public void Resolve_IsCaseInsensitive(string input)
        {
            var (registry, _) = Build("Vipps", "Stripe");
            // Resolves to the canonical registered casing regardless of input casing.
            Assert.Equal("Vipps", registry.Resolve(input).Name);
        }

        [Fact]
        public void Resolve_UnknownProvider_Throws()
        {
            var (registry, _) = Build("Vipps");
            var ex = Assert.Throws<InvalidOperationException>(() => registry.Resolve("Stripe"));
            Assert.Equal("Payment provider 'Stripe' is not enabled.", ex.Message);
        }

        [Fact]
        public void Resolve_DisabledProvider_Throws()
        {
            // Sandbox registered/keyed but NOT in the enabled set → not resolvable.
            var (registry, _) = Build("Vipps", "Stripe");
            Assert.Throws<InvalidOperationException>(() => registry.Resolve("Sandbox"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Resolve_NullOrBlank_Throws(string? input)
        {
            var (registry, _) = Build("Vipps");
            Assert.Throws<InvalidOperationException>(() => registry.Resolve(input!));
        }

        [Fact]
        public void IsEnabled_ReflectsTheEnabledSet_CaseInsensitive()
        {
            var (registry, _) = Build("Vipps", "Stripe");
            Assert.True(registry.IsEnabled("Vipps"));
            Assert.True(registry.IsEnabled("stripe"));
            Assert.False(registry.IsEnabled("Sandbox"));
            Assert.False(registry.IsEnabled(""));
            Assert.False(registry.IsEnabled("   "));
        }

        [Fact]
        public void Catalog_ExposesEnabledAndDefault()
        {
            var (registry, _) = Build("Vipps", "Stripe");
            Assert.Equal(new[] { "Vipps", "Stripe" }, registry.EnabledProviders);
            Assert.Equal("Vipps", registry.DefaultProvider);
        }

        [Fact]
        public void SingleProvider_ParityWithTodaysBehaviour()
        {
            // The backward-compat case: one enabled provider == default; Resolve(default)
            // returns it — exactly what the old non-keyed single registration did.
            var (registry, _) = Build("Sandbox");
            Assert.Single(registry.EnabledProviders);
            Assert.Equal("Sandbox", registry.DefaultProvider);
            Assert.Equal("Sandbox", registry.Resolve(registry.DefaultProvider).Name);
            Assert.True(registry.IsEnabled("sandbox"));
            Assert.False(registry.IsEnabled("Vipps"));
        }
    }
}
