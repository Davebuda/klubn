using DJDiP.Application.Services;
using DJDiP.Domain.Models;
using Xunit;

namespace DJDiP.Tests
{
    // P0-WS1 (TRUSTS-CLIENT-IDENTITY #followDj): the resolver now passes the JWT-verified
    // caller (a real principal always exists), so FollowService must NOT auto-create a
    // "Guest Listener" placeholder user for an unknown id. These tests pin that behaviour.
    public class FollowServiceTests
    {
        private static readonly Guid DjId = Guid.NewGuid();

        [Fact]
        public async Task FollowDj_does_not_create_a_placeholder_user_for_an_unknown_id()
        {
            // No users seeded -> the old code would have minted a placeholder ApplicationUser.
            var users = new FakeUserRepository();
            var follows = new FakeUserFollowDJRepository();
            var uow = new AuthzUnitOfWork(users: users, follows: follows);
            var svc = new FollowService(uow);

            await svc.FollowDjAsync("verified-user-1", DjId);

            Assert.Equal(0, users.AddCount);              // NO placeholder user created
            Assert.Empty(users.Added);
            Assert.Single(follows.Rows);                  // the follow row IS recorded
            Assert.Equal("verified-user-1", follows.Rows[0].UserId); // keyed to the JWT caller
            Assert.Equal(DjId, follows.Rows[0].DJId);
        }

        [Fact]
        public async Task FollowDj_is_idempotent_when_already_following()
        {
            var existing = new UserFollowDJ { UserId = "u1", DJId = DjId, FollowedAt = DateTime.UtcNow };
            var follows = new FakeUserFollowDJRepository(existing);
            var users = new FakeUserRepository();
            var uow = new AuthzUnitOfWork(users: users, follows: follows);
            var svc = new FollowService(uow);

            await svc.FollowDjAsync("u1", DjId);

            Assert.Single(follows.Rows);     // no duplicate row
            Assert.Equal(0, users.AddCount); // and still no placeholder
        }
    }
}
