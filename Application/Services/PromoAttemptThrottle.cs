using DJDiP.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace DJDiP.Application.Services
{
    // Release-gate P2 (2026-06-13) — IMemoryCache-backed promo/unlock guess throttle.
    //
    // Mirrors LoginThrottle, but keyed by CLIENT IP (anonymous callers have no account) and with a
    // deliberately generous threshold to avoid false-positiving NAT'd shoppers. Each failed attempt
    // (re)arms a window-long sliding TTL, so the throttle naturally lifts AttemptWindow after the
    // last failure with no background sweeper. A successful code Resets the counter.
    //
    // Registered as a singleton (IMemoryCache is a singleton).
    public sealed class PromoAttemptThrottle : IPromoAttemptThrottle
    {
        // ~Real buyers fail at most a couple of codes; a brute-forcer fails continuously. 15 keeps
        // shared-IP false positives near zero while still capping the oracle well under the global
        // 100/min IP limit. Tunable here only — not env-exposed (matches LoginThrottle posture).
        public const int MaxFailures = 15;
        public static readonly TimeSpan AttemptWindow = TimeSpan.FromMinutes(10);

        private const string KeyPrefix = "promo-throttle:";

        private readonly IMemoryCache _cache;

        public PromoAttemptThrottle(IMemoryCache cache)
        {
            _cache = cache;
        }

        private static string Key(string ipAddress) => KeyPrefix + Normalize(ipAddress);

        // Null/blank IP collapses to a single shared bucket rather than minting per-request keys.
        private static string Normalize(string ipAddress) => string.IsNullOrWhiteSpace(ipAddress) ? "unknown" : ipAddress.Trim();

        public bool IsThrottled(string ipAddress)
        {
            return _cache.TryGetValue(Key(ipAddress), out int failures) && failures >= MaxFailures;
        }

        public void RegisterFailure(string ipAddress)
        {
            var key = Key(ipAddress);
            var failures = _cache.TryGetValue(key, out int current) ? current + 1 : 1;
            _cache.Set(key, failures, AttemptWindow);
        }

        public void Reset(string ipAddress)
        {
            _cache.Remove(Key(ipAddress));
        }
    }
}
