using DJDiP.Application.DTO.ContactMessageDTO;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class ContactMessageService : IContactMessageService
    {
        private readonly IUnitOfWork _unitOfWork;

        public ContactMessageService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<ContactMessageReadDto>> GetAllAsync()
        {
            var messages = await _unitOfWork.ContactMessages.GetAllAsync();

            var cache = new Dictionary<string, ApplicationUser>();
            var result = new List<ContactMessageReadDto>();

            foreach (var message in messages.OrderByDescending(m => m.SentAt))
            {
                if (!cache.TryGetValue(message.UserId, out var user))
                {
                    user = await _unitOfWork.Users.GetByIdAsync(message.UserId);
                    if (user != null)
                    {
                        cache[message.UserId] = user;
                    }
                }

                result.Add(ToReadDto(message, user));
            }

            return result;
        }

        public async Task<ContactMessageReadDto?> GetByIdAsync(Guid id)
        {
            var message = await _unitOfWork.ContactMessages.GetByIdAsync(id);
            if (message == null)
            {
                return null;
            }

            var user = await _unitOfWork.Users.GetByIdAsync(message.UserId);
            return ToReadDto(message, user);
        }

        public async Task<Guid> CreateAsync(ContactMessageCreateDto dto)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(dto.UserId);
            if (user == null)
            {
                throw new ArgumentException("User not found");
            }

            var entity = new ContactMessage
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                Message = dto.Message,
                Email = user.Email,
                Name = user.FullName,
                SentAt = DateTime.UtcNow
            };

            await _unitOfWork.ContactMessages.AddAsync(entity);
            await _unitOfWork.SaveChangesAsync();

            return entity.Id;
        }

        public async Task DeleteAsync(Guid id)
        {
            var message = await _unitOfWork.ContactMessages.GetByIdAsync(id);
            if (message == null)
            {
                return;
            }

            await _unitOfWork.ContactMessages.DeleteAsync(message);
            await _unitOfWork.SaveChangesAsync();
        }

        private static ContactMessageReadDto ToReadDto(ContactMessage message, ApplicationUser? user)
        {
            return new ContactMessageReadDto
            {
                Id = message.Id,
                Message = message.Message,
                UserFullName = user?.FullName ?? message.Name,
                CreatedAt = message.SentAt
            };
        }
    }
}
