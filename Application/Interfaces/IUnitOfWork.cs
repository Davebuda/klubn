using DJDiP.Domain.Models;

namespace DJDiP.Application.Interfaces
{
    public interface IUnitOfWork : IDisposable
    {
        IUserRepository Users { get; }
        IEventRepository Events { get; }
        ITicketRepository Tickets { get; }
        IOrderRepository Orders { get; }
        IPaymentRepository Payments { get; }
        IDJProfileRepository DJProfiles { get; }
        IRepository<Genre> Genres { get; }
        IRepository<Venue> Venues { get; }
        IRepository<Song> Songs { get; }
        IRepository<Newsletter> Newsletters { get; }
        IRepository<Notification> Notifications { get; }
        IRepository<ContactMessage> ContactMessages { get; }
        IPromoCodeRepository PromotionCodes { get; }
        ITicketTypeRepository TicketTypes { get; }
        IRepository<OrderItem> OrderItems { get; }
        IRepository<DJTop10> DJTop10s { get; }
        IRepository<EventDJ> EventDJs { get; }
        IUserFollowDJRepository UserFollowDJs { get; }
        IRepository<SiteSetting> SiteSettings { get; }
        IRepository<GalleryMedia> GalleryMedia { get; }
        IRepository<EventHighlight> EventHighlights { get; }
        IRepository<DJReview> DJReviews { get; }
        IDJApplicationRepository DJApplications { get; }
        IRepository<Playlist> Playlists { get; }
        IRepository<PlaylistSong> PlaylistSongs { get; }
        IRepository<DJMix> DJMixes { get; }

        Task<int> SaveChangesAsync();
        Task BeginTransactionAsync();
        Task CommitTransactionAsync();
        Task RollbackTransactionAsync();
    }
} 
