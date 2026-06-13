using DJDiP.Application.Services;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace DJDiP.Tests
{
    // Release-gate P2 (2026-06-13) — anti-enumeration promo/unlock throttle. PromoAttemptThrottle is
    // IMemoryCache-backed and keyed by CLIENT IP. These assert: N failures throttle the IP, a reset
    // (successful code) clears it, the throttle is IP-scoped, and a blank IP collapses to one bucket.
    public class PromoAttemptThrottleTests
    {
        private const string Ip = "203.0.113.7";

        private static PromoAttemptThrottle NewThrottle()
            => new PromoAttemptThrottle(new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public void ThrottlesIpAfterMaxFailures()
        {
            var throttle = NewThrottle();
            Assert.False(throttle.IsThrottled(Ip));

            // One short of the threshold: still allowed.
            for (var i = 0; i < PromoAttemptThrottle.MaxFailures - 1; i++)
            {
                throttle.RegisterFailure(Ip);
                Assert.False(throttle.IsThrottled(Ip));
            }

            // The MaxFailures-th failed guess engages the throttle.
            throttle.RegisterFailure(Ip);
            Assert.True(throttle.IsThrottled(Ip));
        }

        [Fact]
        public void ResetClearsThrottle()
        {
            var throttle = NewThrottle();
            for (var i = 0; i < PromoAttemptThrottle.MaxFailures; i++)
                throttle.RegisterFailure(Ip);
            Assert.True(throttle.IsThrottled(Ip));

            // A successful code resets the counter -> the IP can use promo codes again.
            throttle.Reset(Ip);
            Assert.False(throttle.IsThrottled(Ip));
        }

        [Fact]
        public void ThrottleIsScopedPerIp()
        {
            var throttle = NewThrottle();
            for (var i = 0; i < PromoAttemptThrottle.MaxFailures; i++)
                throttle.RegisterFailure(Ip);

            Assert.True(throttle.IsThrottled(Ip));
            // A different IP is unaffected — one abuser does not lock out everyone.
            Assert.False(throttle.IsThrottled("198.51.100.42"));
        }

        [Fact]
        public void BlankIpCollapsesToOneBucket()
        {
            var throttle = NewThrottle();
            // null/blank/whitespace all normalize to the same "unknown" bucket rather than minting
            // fresh per-request keys that would never accumulate to the threshold.
            for (var i = 0; i < PromoAttemptThrottle.MaxFailures; i++)
                throttle.RegisterFailure("");
            Assert.True(throttle.IsThrottled("   "));
            Assert.True(throttle.IsThrottled(null!));
        }
    }
}
