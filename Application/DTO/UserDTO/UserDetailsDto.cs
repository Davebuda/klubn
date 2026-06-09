namespace DJDiP.Application.DTO.UserDTO
{
    public class UserDetailsDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ProfilePictureUrl { get; set; }
    }
}