namespace DJDiP.Application.Interfaces
{
    // Minimal read-only view of the enabled payment providers, consumed by the checkout
    // quote to populate CheckoutQuote.AvailableProviders (checkout-orchestration design
    // §4.2). The full provider registry (resolve-by-name, fail-fast per enabled
    // provider) arrives in C3 and will implement this interface; C2 only compiles
    // against it. NOT registered in DI during C2.
    public interface IPaymentProviderCatalog
    {
        // Enabled provider names, e.g. ["Vipps", "Stripe"]. Order is display order.
        IReadOnlyList<string> EnabledProviders { get; }

        // The default provider used when a checkout doesn't specify one.
        string DefaultProvider { get; }
    }
}
