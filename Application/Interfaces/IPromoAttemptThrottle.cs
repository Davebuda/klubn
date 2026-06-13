namespace DJDiP.Application.Interfaces
{
    // Release-gate P2 (2026-06-13) — anti-enumeration throttle for anonymous promo-code and
    // hidden-tier-unlock guessing. Keyed by CLIENT IP (the only handle on an anonymous caller;
    // UseForwardedHeaders has already reconstructed the real IP behind Traefik before this reads
    // it). The threshold is deliberately GENEROUS so a NAT'd legitimate buyer — who enters at most
    // a couple of codes — never trips it, while a brute-forcer racks up failures fast. A SUCCESSFUL
    // code resets the counter, protecting shared-IP users. Backed by IMemoryCache (process-local;
    // one backend instance behind Traefik). This does not replace the global IP rate limiter — it
    // adds a tighter, failure-only counter on the promo/unlock oracle. Redemption caps remain the
    // real bound on abuse; this just raises the cost of discovering valid codes.
    public interface IPromoAttemptThrottle
    {
        // True while this IP has accumulated >= threshold failed promo/unlock attempts in the window.
        bool IsThrottled(string ipAddress);

        // Record one failed promo/unlock attempt (a non-empty code that resolved to nothing).
        void RegisterFailure(string ipAddress);

        // Clear the failure counter for this IP (call on a successful promo/unlock).
        void Reset(string ipAddress);
    }
}
