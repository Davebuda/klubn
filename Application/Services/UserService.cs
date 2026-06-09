using DJDiP.Application.Interfaces;
using DJDiP.Application.DTO.UserDTO;
using DJDiP.Domain.Models;

namespace DJDiP.Application.Services
{
    public class UserService : IUserService
    {
        private readonly IUnitOfWork _unitOfWork;

        public UserService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
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
    }
} 