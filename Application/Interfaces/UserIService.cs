
using DJDiP.Application.DTO.UserDTO;

namespace DJDiP.Application.Interfaces
{
    public interface IUserService
    {
        Task<UserDetailsDto?> GetUserByIdAsync(string userId);
        Task<bool> UserExistsAsync(string userId);
        Task CreateUserAsync(RegisterUserDto userDto);
        Task UpdateUserAsync(UpdateUserDto userDto);
        Task loginUserAsync(UserLoginDto userLoginDto);

        // P0-WS2 (audit): change a user's role and write ONE attributable audit row.
        // actorId is the JWT-derived admin id (never client input). Returns false if the
        // target user does not exist (no row written in that case).
        Task<bool> ChangeRoleAsync(string actorId, string targetUserId, int newRole);

        // P0-WS3C (GDPR Art. 17) — anonymize (don't delete) the target user: scrub identity
        // fields and pseudonymize the (NOT-NULL, unique) Email, then write ONE "UserErasure"
        // audit row. Financial/ticketing rows (Orders/Tickets/Payments) are NEVER touched —
        // they are retained under the pseudonymized key (Bokføringsloven). Returns false if
        // the user does not exist. actorId is the JWT caller; for self-erasure actor==target.
        Task<bool> AnonymizeUserAsync(string actorId, string targetUserId);

        // P0-WS3C (GDPR Art. 15/20) — owner-scoped data export. Returns the caller's profile
        // + their tickets + orders, or null if the user does not exist. Scoped purely by the
        // passed userId (the resolver always passes the JWT id — never a client-supplied id).
        Task<DJDiP.Application.DTO.UserDTO.ExportDataDto?> ExportUserDataAsync(string userId);
    }
}
