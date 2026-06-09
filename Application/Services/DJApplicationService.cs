using DJDiP.Application.DTO.DJApplicationDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using Microsoft.Extensions.Logging;

namespace DJDiP.Application.Services
{
    public class DJApplicationService : IDJApplicationService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<DJApplicationService> _logger;

        public DJApplicationService(
            IUnitOfWork unitOfWork,
            ILogger<DJApplicationService> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<DJApplicationDto> SubmitApplicationAsync(CreateDJApplicationDto dto)
        {
            try
            {
                // Validate user exists
                var user = await _unitOfWork.Users.GetByIdAsync(dto.UserId);
                if (user == null)
                {
                    throw new ArgumentException($"User {dto.UserId} not found");
                }

                // Check if user already has a DJ profile
                var existingDJProfile = await _unitOfWork.DJProfiles.GetByIdAsync(Guid.Parse(dto.UserId));
                if (existingDJProfile != null)
                {
                    throw new InvalidOperationException("User already has a DJ profile");
                }

                // Check if user already has a pending application
                var hasPending = await _unitOfWork.DJApplications.HasPendingApplicationAsync(dto.UserId);
                if (hasPending)
                {
                    throw new InvalidOperationException("User already has a pending DJ application");
                }

                // Check for existing application (approved or rejected) for reapplication logic
                var existingApplication = await _unitOfWork.DJApplications.GetByUserIdAsync(dto.UserId);
                if (existingApplication != null && existingApplication.Status == ApplicationStatus.Approved)
                {
                    throw new InvalidOperationException("User application was already approved");
                }

                // Create new application
                var application = new DJApplication
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    StageName = dto.StageName,
                    Bio = dto.Bio,
                    Genre = dto.Genre,
                    YearsExperience = dto.YearsExperience,
                    Specialties = dto.Specialties,
                    InfluencedBy = dto.InfluencedBy,
                    EquipmentUsed = dto.EquipmentUsed,
                    SocialLinks = dto.SocialLinks,
                    ProfileImageUrl = dto.ProfileImageUrl,
                    CoverImageUrl = dto.CoverImageUrl,
                    Status = ApplicationStatus.Pending,
                    SubmittedAt = DateTime.UtcNow
                };

                await _unitOfWork.DJApplications.AddAsync(application);
                await _unitOfWork.SaveChangesAsync();

                _logger.LogInformation(
                    "DJ application submitted by user {UserId} with stage name {StageName}",
                    dto.UserId,
                    dto.StageName
                );

                return MapToDto(application);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting DJ application for user {UserId}", dto.UserId);
                throw;
            }
        }

        public async Task<DJApplicationDto?> GetApplicationByIdAsync(Guid id)
        {
            var application = await _unitOfWork.DJApplications.GetByIdAsync(id);
            return application != null ? MapToDto(application) : null;
        }

        public async Task<DJApplicationDto?> GetApplicationByUserIdAsync(string userId)
        {
            var application = await _unitOfWork.DJApplications.GetByUserIdAsync(userId);
            return application != null ? MapToDto(application) : null;
        }

        public async Task<IEnumerable<DJApplicationDto>> GetAllApplicationsAsync()
        {
            var applications = await _unitOfWork.DJApplications.GetAllAsync();
            return applications.Select(MapToDto);
        }

        public async Task<IEnumerable<DJApplicationDto>> GetPendingApplicationsAsync()
        {
            var applications = await _unitOfWork.DJApplications.GetByStatusAsync(ApplicationStatus.Pending);
            return applications.Select(MapToDto);
        }

        public async Task<DJApplicationDto> ApproveApplicationAsync(UpdateApplicationStatusDto dto)
        {
            try
            {
                await _unitOfWork.BeginTransactionAsync();

                var application = await _unitOfWork.DJApplications.GetByIdAsync(dto.ApplicationId);
                if (application == null)
                {
                    throw new ArgumentException($"Application {dto.ApplicationId} not found");
                }

                if (application.Status != ApplicationStatus.Pending)
                {
                    throw new InvalidOperationException($"Application is not pending (current status: {application.Status})");
                }

                var user = await _unitOfWork.Users.GetByIdAsync(application.UserId);
                if (user == null)
                {
                    throw new ArgumentException($"User {application.UserId} not found");
                }

                // Update application status
                application.Status = ApplicationStatus.Approved;
                application.ReviewedAt = DateTime.UtcNow;
                application.ReviewedByAdminId = dto.ReviewedByAdminId;

                await _unitOfWork.DJApplications.UpdateAsync(application);

                // Upgrade user role to DJ (1 = DJ)
                user.Role = 1;
                await _unitOfWork.Users.UpdateAsync(user);

                // Create DJ Profile from application data
                var djProfile = new DJProfile
                {
                    Id = Guid.Parse(application.UserId),
                    UserId = application.UserId,
                    Name = application.StageName,
                    Bio = application.Bio,
                    ProfilePictureUrl = application.ProfileImageUrl,
                    CoverImageUrl = application.CoverImageUrl,
                    YearsExperience = application.YearsExperience,
                    Specialties = application.Specialties,
                    InfluencedBy = application.InfluencedBy,
                    EquipmentUsed = application.EquipmentUsed,
                    SocialLinks = application.SocialLinks,
                    Genre = application.Genre,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _unitOfWork.DJProfiles.AddAsync(djProfile);

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                _logger.LogInformation(
                    "DJ application {ApplicationId} approved by admin {AdminId}. User {UserId} upgraded to DJ role and profile created",
                    dto.ApplicationId,
                    dto.ReviewedByAdminId,
                    application.UserId
                );

                return MapToDto(application);
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                _logger.LogError(ex, "Error approving DJ application {ApplicationId}", dto.ApplicationId);
                throw;
            }
        }

        public async Task<DJApplicationDto> RejectApplicationAsync(UpdateApplicationStatusDto dto)
        {
            try
            {
                var application = await _unitOfWork.DJApplications.GetByIdAsync(dto.ApplicationId);
                if (application == null)
                {
                    throw new ArgumentException($"Application {dto.ApplicationId} not found");
                }

                if (application.Status != ApplicationStatus.Pending)
                {
                    throw new InvalidOperationException($"Application is not pending (current status: {application.Status})");
                }

                application.Status = ApplicationStatus.Rejected;
                application.ReviewedAt = DateTime.UtcNow;
                application.ReviewedByAdminId = dto.ReviewedByAdminId;
                application.RejectionReason = dto.RejectionReason;

                await _unitOfWork.DJApplications.UpdateAsync(application);
                await _unitOfWork.SaveChangesAsync();

                _logger.LogInformation(
                    "DJ application {ApplicationId} rejected by admin {AdminId} with reason: {Reason}",
                    dto.ApplicationId,
                    dto.ReviewedByAdminId,
                    dto.RejectionReason
                );

                return MapToDto(application);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting DJ application {ApplicationId}", dto.ApplicationId);
                throw;
            }
        }

        public async Task<bool> HasPendingApplicationAsync(string userId)
        {
            return await _unitOfWork.DJApplications.HasPendingApplicationAsync(userId);
        }

        private static DJApplicationDto MapToDto(DJApplication application)
        {
            return new DJApplicationDto
            {
                Id = application.Id,
                UserId = application.UserId,
                StageName = application.StageName,
                Bio = application.Bio,
                Genre = application.Genre,
                YearsExperience = application.YearsExperience,
                Specialties = application.Specialties,
                InfluencedBy = application.InfluencedBy,
                EquipmentUsed = application.EquipmentUsed,
                SocialLinks = application.SocialLinks,
                ProfileImageUrl = application.ProfileImageUrl,
                CoverImageUrl = application.CoverImageUrl,
                Status = application.Status,
                SubmittedAt = application.SubmittedAt,
                ReviewedAt = application.ReviewedAt,
                ReviewedByAdminId = application.ReviewedByAdminId,
                RejectionReason = application.RejectionReason,
                UserEmail = application.User?.Email,
                UserName = application.User?.FullName
            };
        }
    }
}
