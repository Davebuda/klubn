namespace DJDiP.Domain.Models
{
    public class ApplicationUser
    {
        public required string Id { get; set; }
        public required string FullName { get; set; }
        public required string Email { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public int Role { get; set; } = 0; // 0=User, 1=DJ, 2=Admin, 3=EventOrganizer, 4=CoAdmin
        public bool IsEmailVerified { get; set; } = false;
        public string? EmailVerificationToken { get; set; }
        public string? PasswordResetToken { get; set; }
        public DateTime? PasswordResetTokenExpiry { get; set; }
        public string? Provider { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        // Navigation Properties
        public List<DJProfile> DJProfiles { get; set; } = new();  // One-to-many: Admin can manage multiple DJ profiles
        public List<Order> Orders { get; set; } = new();
        public List<Ticket> Tickets { get; set; } = new();
        public List<ContactMessage> ContactMessages { get; set; } = new();
        public List<Notification> Notifications { get; set; } = new();
        public List<Review> Reviews { get; set; } = new();
        public List<MediaItem> MediaItems { get; set; } = new();
        public List<MediaLike> MediaLikes { get; set; } = new();
        public List<MediaComment> MediaComments { get; set; } = new();
        public List<UserFollowDJ> FollowedDJs { get; set; } = new();
        public List<Subscription> Subscriptions { get; set; } = new();
        public List<ServiceBooking> ServiceBookings { get; set; } = new();
        public List<PushSubscription> PushSubscriptions { get; set; } = new();
        public List<UserBadge> Badges { get; set; } = new();
        public UserPoints? Points { get; set; }
        public List<GalleryMedia> GalleryMedia { get; set; } = new();
    }
}