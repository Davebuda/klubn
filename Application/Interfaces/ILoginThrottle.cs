namespace DJDiP.Application.Interfaces
{
    // P0-WS3A — per-account login lockout. Keyed by NORMALIZED EMAIL only (never IP), so a
    // credential-stuffing attacker rotating source IPs cannot evade the lock, and a victim is
    // protected regardless of where the attempts originate. Backed by IMemoryCache (process-local;
    // a single backend instance behind Traefik — see CLAUDE.md infra).
    public interface ILoginThrottle
    {
        // True while the account is locked (>= threshold consecutive failures within the window).
        bool IsLocked(string email);

        // Record one failed login. Crossing the threshold engages the lock for the window.
        void RegisterFailure(string email);

        // Clear all failure state for the account (call on a successful login).
        void Reset(string email);
    }
}
