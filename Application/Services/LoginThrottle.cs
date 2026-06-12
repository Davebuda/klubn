using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace DJDiP.Application.Services
{
    // P0-WS3A — per-account login lockout backed by IMemoryCache.
    //
    // Lock after MaxFailures CONSECUTIVE failures, keyed by normalized email (never IP), for
    // LockoutWindow. A successful login Resets the counter. The failure counter and the lock share
    // the same sliding window: each failure (re)arms a window-long TTL, so the lock naturally
    // expires LockoutWindow after the last failed attempt without any background sweeper.
    //
    // Registered as a singleton (IMemoryCache is a singleton); injected into the scoped AuthService.
    public sealed class LoginThrottle : ILoginThrottle
    {
        public const int MaxFailures = 5;
        public static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

        private const string KeyPrefix = "login-throttle:";

        private readonly IMemoryCache _cache;

        public LoginThrottle(IMemoryCache cache)
        {
            _cache = cache;
        }

        private static string Key(string email) => KeyPrefix + Normalize(email);

        // Email is the identity. Normalize so casing/whitespace can't mint a separate bucket and
        // dodge the lock. Null/blank collapses to empty string (still email-keyed, never IP).
        private static string Normalize(string email) => (email ?? string.Empty).Trim().ToLowerInvariant();

        public bool IsLocked(string email)
        {
            return _cache.TryGetValue(Key(email), out int failures) && failures >= MaxFailures;
        }

        public void RegisterFailure(string email)
        {
            var key = Key(email);
            var failures = _cache.TryGetValue(key, out int current) ? current + 1 : 1;
            // Re-arm a fresh sliding window on every failure: the lock holds for LockoutWindow after
            // the LAST failed attempt, then the entry evicts and the account is free again.
            _cache.Set(key, failures, LockoutWindow);
        }

        public void Reset(string email)
        {
            _cache.Remove(Key(email));
        }
    }
}
