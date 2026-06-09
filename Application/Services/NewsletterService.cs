using DJDiP.Application.DTO.NewsLetterDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class NewsletterService : INewsletterService
    {
        private readonly IUnitOfWork _unitOfWork;

        public NewsletterService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<NewsletterDto>> GetAllAsync()
        {
            var subscriptions = await _unitOfWork.Newsletters.GetAllAsync();
            return subscriptions.Select(MapToDto).ToList();
        }

        public async Task<NewsletterDto?> GetByIdAsync(Guid id)
        {
            var subscription = await _unitOfWork.Newsletters.GetByIdAsync(id);
            return subscription == null ? null : MapToDto(subscription);
        }

        public async Task<NewsletterDto> SubscribeAsync(CreateNewsletterDto dto)
        {
            var existing = (await _unitOfWork.Newsletters.GetAllAsync())
                .FirstOrDefault(n => n.Email.Equals(dto.Email, StringComparison.OrdinalIgnoreCase));

            if (existing != null)
            {
                return MapToDto(existing);
            }

            var subscription = new Newsletter
            {
                Id = Guid.NewGuid(),
                Email = dto.Email,
                UserId = dto.UserId,
                DateSubscribed = DateTime.UtcNow
            };

            await _unitOfWork.Newsletters.AddAsync(subscription);
            await _unitOfWork.SaveChangesAsync();

            return MapToDto(subscription);
        }

        public async Task<bool> UnsubscribeAsync(Guid id)
        {
            var subscription = await _unitOfWork.Newsletters.GetByIdAsync(id);
            if (subscription == null)
            {
                return false;
            }

            await _unitOfWork.Newsletters.DeleteAsync(subscription);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        private static NewsletterDto MapToDto(Newsletter subscription) => new NewsletterDto
        {
            Id = subscription.Id,
            Email = subscription.Email,
            UserId = subscription.UserId,
            SubscribedAt = subscription.DateSubscribed,
            IsActive = true
        };
    }
}
