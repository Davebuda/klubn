namespace DJDiP.Application.Interfaces
{
    // C3 (checkout-orchestration design §4.3): the multi-provider registry that replaces
    // the single-provider DI from C2. Extends IPaymentProviderCatalog (EnabledProviders +
    // DefaultProvider, consumed by the quote) with name-based resolution so the webhook
    // route segment and per-Payment-row provider can each resolve their own adapter —
    // never the global default. With a single configured provider its behaviour is
    // identical to today: EnabledProviders = [DefaultProvider], Resolve returns that one.
    //
    // Provider-neutral by contract: no provider/Vipps/Stripe types appear in any signature
    // here (mirrors IPaymentProvider). Names are case-insensitive on the way in.
    public interface IPaymentProviderRegistry : IPaymentProviderCatalog
    {
        // Resolve the enabled provider by name (case-insensitive). Throws
        // InvalidOperationException("Payment provider '{name}' is not enabled.") for an
        // unknown or disabled name — a caller must never get a half-configured adapter.
        IPaymentProvider Resolve(string name);

        // True when {name} (case-insensitive) is in the enabled set. The webhook
        // controller uses this to 404 segments for providers that aren't configured
        // (their signatures can't be verified, so they can't be trusted).
        bool IsEnabled(string name);
    }
}
