using DJDiP.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace DJDiP.Infrastructure.Payments
{
    // C3 (checkout-orchestration design §4.3): resolves the per-checkout / per-webhook
    // payment provider from the keyed DI registrations set up in Program.cs. Each enabled
    // provider is registered as AddKeyedScoped<IPaymentProvider>("Vipps"|"Stripe"|"Sandbox").
    // The registry canonicalizes an incoming name to the exact registered key casing and
    // pulls the scoped instance from the IServiceProvider, so an adapter's per-request
    // scope (e.g. AppDbContext, HttpClient) is honoured exactly as a direct injection.
    //
    // Single-provider parity: when only one provider is enabled, EnabledProviders has one
    // entry, DefaultProvider is it, and Resolve(default) returns the same instance the old
    // non-keyed registration would have — today's behaviour, unchanged.
    public sealed class PaymentProviderRegistry : IPaymentProviderRegistry
    {
        private readonly IServiceProvider _sp;
        // Canonical (registered) names, keyed case-insensitively for lookup.
        private readonly Dictionary<string, string> _canonical;

        public PaymentProviderRegistry(
            IServiceProvider sp,
            IReadOnlyList<string> enabledProviders,
            string defaultProvider)
        {
            _sp = sp;
            EnabledProviders = enabledProviders;
            DefaultProvider = defaultProvider;
            _canonical = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var name in enabledProviders)
                _canonical[name] = name; // last-write-wins; the set is already de-duped upstream
        }

        public IReadOnlyList<string> EnabledProviders { get; }
        public string DefaultProvider { get; }

        public bool IsEnabled(string name) =>
            !string.IsNullOrWhiteSpace(name) && _canonical.ContainsKey(name);

        public IPaymentProvider Resolve(string name)
        {
            if (string.IsNullOrWhiteSpace(name) || !_canonical.TryGetValue(name, out var canonical))
                throw new InvalidOperationException($"Payment provider '{name}' is not enabled.");

            // Keyed lookups match on the exact registered key — use the canonical casing.
            return _sp.GetRequiredKeyedService<IPaymentProvider>(canonical);
        }
    }
}
