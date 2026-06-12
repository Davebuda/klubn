using System.Text.Json;
using DJDiP.Application.Interfaces;
using DJDiP.Application.DTO.AuditLogDTO;
using DJDiP.Application.DTO.UserDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class UserService : IUserService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IAuditLogService _auditLog;

        public UserService(IUnitOfWork unitOfWork, IAuditLogService auditLog)
        {
            _unitOfWork = unitOfWork;
            _auditLog = auditLog;
        }

        public async Task<UserDetailsDto?> GetUserByIdAsync(string userId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user == null) return null;

            return new UserDetailsDto
            {
                FullName = user.FullName,
                Email = user.Email,
                ProfilePictureUrl = user.ProfilePictureUrl
            };
        }

        public async Task<bool> UserExistsAsync(string userId)
        {
            return await _unitOfWork.Users.ExistsAsync(userId);
        }

        public async Task CreateUserAsync(RegisterUserDto userDto)
        {
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(), // In a real app, this would come from identity
                FullName = userDto.FullName,
                Email = userDto.Email,
                Provider = userDto.Provider
            };

            await _unitOfWork.Users.AddAsync(user);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task UpdateUserAsync(UpdateUserDto userDto)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userDto.Id);
            if (user == null) throw new ArgumentException("User not found");

            user.FullName = userDto.FullName;
            user.Email = userDto.Email;

            if (userDto.ProfilePictureUrl != null)
                user.ProfilePictureUrl = userDto.ProfilePictureUrl;

            await _unitOfWork.Users.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task loginUserAsync(UserLoginDto userLoginDto)
        {
            var user = await _unitOfWork.Users.GetByEmailAsync(userLoginDto.Email);
            if (user == null) throw new ArgumentException("User not found");

            // In a real app, you would validate credentials here
            // For now, we just check if the user exists
        }

        public async Task<bool> ChangeRoleAsync(string actorId, string targetUserId, int newRole)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(targetUserId);
            if (user == null) return false;

            var oldRole = user.Role;
            user.Role = newRole;
            user.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.Users.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();

            // P0-WS2 (audit): one attributable row per SUCCESSFUL role change, AFTER the
            // SaveChanges success point. Actor is the JWT-derived admin (actorId), never the
            // target. RecordAsync does its own isolated SaveChanges.
            await _auditLog.RecordAsync(new CreateAuditLogDTO
            {
                Action = "RoleChange",
                EntityName = "ApplicationUser",
                EntityId = targetUserId,
                UserId = actorId,
                Changes = JsonSerializer.Serialize(new { targetUserId, oldRole, newRole })
            });

            return true;
        }

        public async Task<bool> AnonymizeUserAsync(string actorId, string targetUserId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(targetUserId);
            if (user == null) return false;

            // Scrub identity + auth artifacts. Email is NOT-NULL and UNIQUE, so it cannot be
            // nulled — replace it with a collision-proof pseudonymized placeholder on a reserved
            // non-routable domain. FullName is also `required` (NOT-NULL) so it gets a placeholder
            // rather than null. ProfilePictureUrl + the verification/reset tokens are cleared.
            var shortGuid = Guid.NewGuid().ToString("N")[..12];
            user.Email = $"anonymized+{shortGuid}@deleted.invalid";
            user.FullName = "Deleted user";
            user.ProfilePictureUrl = null;
            user.EmailVerificationToken = null;
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiry = null;
            // Drop the marketing consent on erasure (the data subject is gone).
            user.MarketingOptIn = false;
            user.MarketingPurpose = null;
            user.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.Users.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();

            // Financial rows (Orders/Tickets/Payments) are intentionally NOT touched — they are
            // retained under this now-pseudonymized user key (Bokføringsloven). One attributable
            // audit row per successful erasure (NEW WS3C action — additive to the frozen WS2 map).
            await _auditLog.RecordAsync(new CreateAuditLogDTO
            {
                Action = "UserErasure",
                EntityName = "ApplicationUser",
                EntityId = targetUserId,
                UserId = actorId,
                Changes = JsonSerializer.Serialize(new { targetUserId })
            });

            return true;
        }

        public async Task<ExportDataDto?> ExportUserDataAsync(string userId)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user == null) return null;

            var tickets = await _unitOfWork.Tickets.GetTicketsByUserIdAsync(userId);
            var orders = await _unitOfWork.Orders.GetOrdersByUserIdAsync(userId);

            return new ExportDataDto
            {
                Profile = new ExportProfileDto
                {
                    Id = user.Id,
                    FullName = user.FullName,
                    Email = user.Email,
                    ProfilePictureUrl = user.ProfilePictureUrl,
                    Role = MapRole(user.Role),
                    IsEmailVerified = user.IsEmailVerified,
                    CreatedAt = user.CreatedAt,
                    TermsAcceptedAt = user.TermsAcceptedAt,
                    TermsVersion = user.TermsVersion,
                    MarketingOptIn = user.MarketingOptIn,
                    MarketingOptInAt = user.MarketingOptInAt,
                    MarketingPurpose = user.MarketingPurpose
                },
                Tickets = tickets.Select(t => new ExportTicketDto
                {
                    Id = t.Id,
                    EventId = t.EventId,
                    TicketNumber = t.TicketNumber,
                    Status = t.Status.ToString(),
                    TotalPrice = t.TotalPrice,
                    PurchaseDate = t.PurchaseDate
                }).ToList(),
                Orders = orders.Select(o => new ExportOrderDto
                {
                    Id = o.Id,
                    Reference = o.Reference,
                    Status = o.Status.ToString(),
                    TotalAmount = o.TotalAmount,
                    PromoCode = o.PromoCode,
                    OrderDate = o.OrderDate
                }).ToList()
            };
        }

        private static string MapRole(int role) => role switch
        {
            2 => "Admin",
            1 => "DJ",
            3 => "EventOrganizer",
            4 => "CoAdmin",
            _ => "User"
        };
    }
} 