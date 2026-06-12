using DJDiP.Application.Services;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS3A — per-account login lockout. LoginThrottle is IMemoryCache-backed and keyed by
    // normalized email (never IP). These assert: N failures lock the account, Reset clears the
    // lock, and the lock is account-keyed (the throttle takes no IP at all).
    public class LoginThrottleTests
    {
        private const string Email = "victim@test.local";

        private static LoginThrottle NewThrottle()
            => new LoginThrottle(new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public void LockoutLocksAccountAfterNFailures()
        {
            var throttle = NewThrottle();

            Assert.False(throttle.IsLocked(Email));

            // One short of the threshold: still unlocked.
            for (var i = 0; i < LoginThrottle.MaxFailures - 1; i++)
            {
                throttle.RegisterFailure(Email);
                Assert.False(throttle.IsLocked(Email));
            }

            // The MaxFailures-th consecutive failure engages the lock.
            throttle.RegisterFailure(Email);
            Assert.True(throttle.IsLocked(Email));
        }

        [Fact]
        public void CorrectPasswordAfterResetSucceeds()
        {
            var throttle = NewThrottle();

            for (var i = 0; i < LoginThrottle.MaxFailures; i++)
                throttle.RegisterFailure(Email);
            Assert.True(throttle.IsLocked(Email));

            // A successful login resets the counter -> the account is usable again.
            throttle.Reset(Email);
            Assert.False(throttle.IsLocked(Email));
        }

        [Fact]
        public void LockoutIsKeyedByAccountNotIp()
        {
            var throttle = NewThrottle();

            // The throttle API takes NO IP — only an email. Failures for one account accumulate
            // regardless of where they originate, so rotating source IPs cannot evade the lock.
            for (var i = 0; i < LoginThrottle.MaxFailures; i++)
                throttle.RegisterFailure(Email);

            Assert.True(throttle.IsLocked(Email));

            // A DIFFERENT account is unaffected by the first account's failures (email is the key).
            Assert.False(throttle.IsLocked("someone-else@test.local"));

            // Casing/whitespace variants normalize to the same key — they don't mint a fresh bucket.
            Assert.True(throttle.IsLocked("  VICTIM@TEST.LOCAL  "));
        }
    }
}
