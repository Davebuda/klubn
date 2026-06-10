using Microsoft.EntityFrameworkCore.Storage;
using DJDiP.Application.Interfaces;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Persistance.Repositories;

namespace DJDiP.Infrastructure.Persistance
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly AppDbContext _context;
        private IDbContextTransaction? _transaction;

        private IUserRepository? _users;
        private IEventRepository? _events;
        private ITicketRepository? _tickets;
        private IOrderRepository? _orders;
        private IPaymentRepository? _payments;
        private IDJProfileRepository? _djProfiles;
        private IRepository<Genre>? _genres;
        private IRepository<Venue>? _venues;
        private IRepository<Song>? _songs;
        private IRepository<Newsletter>? _newsletters;
        private IRepository<Notification>? _notifications;
        private IRepository<ContactMessage>? _contactMessages;
        private IRepository<PromotionCode>? _promotionCodes;
        private IRepository<OrderItem>? _orderItems;
        private IRepository<DJTop10>? _djTop10s;
        private IRepository<EventDJ>? _eventDJs;
        private IUserFollowDJRepository? _userFollowDJs;
        private IRepository<SiteSetting>? _siteSettings;
        private IRepository<GalleryMedia>? _galleryMedia;
        private IRepository<EventHighlight>? _eventHighlights;
        private IRepository<DJReview>? _djReviews;
        private IDJApplicationRepository? _djApplications;
        private IRepository<Playlist>? _playlists;
        private IRepository<PlaylistSong>? _playlistSongs;
        private IRepository<DJMix>? _djMixes;

        public UnitOfWork(AppDbContext context)
        {
            _context = context;
        }

        public IUserRepository Users => _users ??= new UserRepository(_context);
        public IEventRepository Events => _events ??= new EventRepository(_context);
        public ITicketRepository Tickets => _tickets ??= new TicketRepository(_context);
        public IOrderRepository Orders => _orders ??= new OrderRepository(_context);
        public IPaymentRepository Payments => _payments ??= new PaymentRepository(_context);
        public IDJProfileRepository DJProfiles => _djProfiles ??= new DJProfileRepository(_context);
        public IRepository<Genre> Genres => _genres ??= new Repository<Genre>(_context);
        public IRepository<Venue> Venues => _venues ??= new Repository<Venue>(_context);
        public IRepository<Song> Songs => _songs ??= new Repository<Song>(_context);
        public IRepository<Newsletter> Newsletters => _newsletters ??= new Repository<Newsletter>(_context);
        public IRepository<Notification> Notifications => _notifications ??= new Repository<Notification>(_context);
        public IRepository<ContactMessage> ContactMessages => _contactMessages ??= new Repository<ContactMessage>(_context);
        public IRepository<PromotionCode> PromotionCodes => _promotionCodes ??= new Repository<PromotionCode>(_context);
        public IRepository<OrderItem> OrderItems => _orderItems ??= new Repository<OrderItem>(_context);
        public IRepository<DJTop10> DJTop10s => _djTop10s ??= new Repository<DJTop10>(_context);
        public IRepository<EventDJ> EventDJs => _eventDJs ??= new Repository<EventDJ>(_context);
        public IUserFollowDJRepository UserFollowDJs => _userFollowDJs ??= new UserFollowDJRepository(_context);
        public IRepository<SiteSetting> SiteSettings => _siteSettings ??= new Repository<SiteSetting>(_context);
        public IRepository<GalleryMedia> GalleryMedia => _galleryMedia ??= new Repository<GalleryMedia>(_context);
        public IRepository<EventHighlight> EventHighlights => _eventHighlights ??= new Repository<EventHighlight>(_context);
        public IRepository<DJReview> DJReviews => _djReviews ??= new Repository<DJReview>(_context);
        public IDJApplicationRepository DJApplications => _djApplications ??= new DJApplicationRepository(_context);
        public IRepository<Playlist> Playlists => _playlists ??= new Repository<Playlist>(_context);
        public IRepository<PlaylistSong> PlaylistSongs => _playlistSongs ??= new Repository<PlaylistSong>(_context);
        public IRepository<DJMix> DJMixes => _djMixes ??= new Repository<DJMix>(_context);

        public async Task<int> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync();
        }

        public async Task BeginTransactionAsync()
        {
            _transaction = await _context.Database.BeginTransactionAsync();
        }

        public async Task CommitTransactionAsync()
        {
            if (_transaction != null)
            {
                await _transaction.CommitAsync();
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }

        public async Task RollbackTransactionAsync()
        {
            if (_transaction != null)
            {
                await _transaction.RollbackAsync();
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }

        public void Dispose()
        {
            _transaction?.Dispose();
            _context.Dispose();
        }
    }
} 
