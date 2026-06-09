namespace DJDiP.Domain.Models
{
    public class Newsletter
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = null!;
        public string UserId { get; set; }
        public ApplicationUser User { get; set; } = null!;
        public DateTime DateSubscribed { get; set; } = DateTime.UtcNow;
    
}
 
}