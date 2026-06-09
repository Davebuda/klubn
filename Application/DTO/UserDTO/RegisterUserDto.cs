namespace DJDiP.Application.DTO.UserDTO
{
    public class RegisterUserDto
    {
        public required string FullName { get; set; }
        public required string Email { get; set; }
        public required string Provider { get; set; }  // "Google", "Facebook", "Email", osv.
    }
}