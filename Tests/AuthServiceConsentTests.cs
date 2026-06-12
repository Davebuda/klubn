using DJDiP.Application.Options;
using DJDiP.Application.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS3C (GDPR) — consent at signup. RegisterAsync must REJECT when acceptTerms is false
    // (server-enforced, no user created), and on success stamp TermsAcceptedAt + TermsVersion.
    // Marketing opt-in is stored SEPARATELY (its own timestamp + purpose) and never inferred
    // from terms acceptance.
    public class AuthServiceConsentTests
    {
        private static (AuthService svc, GdprUserRepository users) NewService()
        {
            var users = new GdprUserRepository();
            var uow = new GdprUnitOfWork(users: users);
            var settings = Options.Create(new AuthSettings
            {
                Key = "test-signing-key-please-32chars-minimum-ok",
                Issuer = "DJDiP",
                Audience = "DJDiP",
                AccessTokenMinutes = 60
            });
            var svc = new AuthService(uow, settings, new NoopLoginThrottle());
            return (svc, users);
        }

        [Fact]
        public async Task Signup_RequiresTermsAcceptance()
        {
            var (svc, users) = NewService();

            // acceptTerms:false -> rejected and NO user added.
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                svc.RegisterAsync("Ada", "ada@test.local", "E2e!TestPass123", acceptTerms: false));
            Assert.Equal(0, users.AddCount);

            // acceptTerms:true -> user added + consent stamped.
            var payload = await svc.RegisterAsync("Ada", "ada@test.local", "E2e!TestPass123", acceptTerms: true);
            Assert.NotNull(payload.AccessToken);

            var user = Assert.Single(users.Added);
            Assert.NotNull(user.TermsAcceptedAt);
            Assert.Equal(AuthService.CurrentTermsVersion, user.TermsVersion);
        }

        [Fact]
        public async Task Signup_StoresMarketingOptInSeparately()
        {
            var (svc, users) = NewService();

            // Terms-only signup: marketing stays false, no marketing timestamp/purpose.
            await svc.RegisterAsync("Grace", "grace@test.local", "E2e!TestPass123", acceptTerms: true);
            var termsOnly = users.Added[0];
            Assert.NotNull(termsOnly.TermsAcceptedAt);   // terms ARE stamped
            Assert.False(termsOnly.MarketingOptIn);      // marketing is independent — not opted in
            Assert.Null(termsOnly.MarketingOptInAt);
            Assert.Null(termsOnly.MarketingPurpose);
        }

        [Fact]
        public async Task Signup_MarketingOptIn_StampsTimestampAndPurpose()
        {
            var (svc, users) = NewService();

            await svc.RegisterAsync(
                "Linus", "linus@test.local", "E2e!TestPass123",
                acceptTerms: true, marketingOptIn: true, marketingPurpose: "newsletter");

            var u = Assert.Single(users.Added);
            Assert.True(u.MarketingOptIn);
            Assert.NotNull(u.MarketingOptInAt);
            Assert.Equal("newsletter", u.MarketingPurpose);
            // Terms still independently stamped.
            Assert.NotNull(u.TermsAcceptedAt);
        }

        [Fact]
        public async Task Signup_MarketingOptIn_DefaultsPurposeWhenNotSupplied()
        {
            var (svc, users) = NewService();

            await svc.RegisterAsync(
                "Ken", "ken@test.local", "E2e!TestPass123",
                acceptTerms: true, marketingOptIn: true, marketingPurpose: null);

            Assert.Equal("email-marketing", users.Added[0].MarketingPurpose);
        }
    }
}
