
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
    }
}
