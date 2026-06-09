using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IUserRepository : IRepository<ApplicationUser>
    {
        Task<ApplicationUser?> GetByEmailAsync(string email);
        Task<IEnumerable<ApplicationUser>> GetUsersByProviderAsync(string provider);
        Task<bool> EmailExistsAsync(string email);
    }
} 