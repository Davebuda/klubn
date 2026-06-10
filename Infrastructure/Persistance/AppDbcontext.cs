
namespace DJDiP.Infrastructure.Persistance
{
    using Microsoft.EntityFrameworkCore;
    using DJDiP.Domain.Models;

    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        { }

        // Core Entities
        public DbSet<ApplicationUser> ApplicationUsers => Set<ApplicationUser>();
        public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
        public DbSet<DJProfile> DJProfiles => Set<DJProfile>();
        public DbSet<DJApplication> DJApplications => Set<DJApplication>();
        public DbSet<EventOrganizerApplication> EventOrganizerApplications => Set<EventOrganizerApplication>();
        public DbSet<DJTop10> DJTop10s => Set<DJTop10>();
        public DbSet<Event> Events => Set<Event>();
        public DbSet<Genre> Genres => Set<Genre>();
        public DbSet<Newsletter> Newsletters => Set<Newsletter>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderItem> OrderItems => Set<OrderItem>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<PromotionCode> PromotionCodes => Set<PromotionCode>();
        public DbSet<PromoCodeTicketType> PromoCodeTicketTypes => Set<PromoCodeTicketType>();
        public DbSet<PromoRedemption> PromoRedemptions => Set<PromoRedemption>();
        public DbSet<Song> Songs => Set<Song>();
        public DbSet<Ticket> Tickets => Set<Ticket>();
        public DbSet<Venue> Venues => Set<Venue>();
        public DbSet<GalleryMedia> GalleryMedia => Set<GalleryMedia>();
        public DbSet<EventHighlight> EventHighlights => Set<EventHighlight>();
        public DbSet<TicketType> TicketTypes => Set<TicketType>();
        public DbSet<TicketHold> TicketHolds => Set<TicketHold>();
        public DbSet<PaymentWebhookEvent> PaymentWebhookEvents => Set<PaymentWebhookEvent>();

        // Phase 2-4 Entities
        public DbSet<Badge> Badges => Set<Badge>();
        public DbSet<UserBadge> UserBadges => Set<UserBadge>();
        public DbSet<Review> Reviews => Set<Review>();
        public DbSet<DJReview> DJReviews => Set<DJReview>();
        public DbSet<Service> Services => Set<Service>();
        public DbSet<ServiceBooking> ServiceBookings => Set<ServiceBooking>();
        public DbSet<ServiceReview> ServiceReviews => Set<ServiceReview>();
        public DbSet<MediaItem> MediaItems => Set<MediaItem>();
        public DbSet<MediaLike> MediaLikes => Set<MediaLike>();
        public DbSet<MediaComment> MediaComments => Set<MediaComment>();
        public DbSet<Subscription> Subscriptions => Set<Subscription>();
        public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>();
        public DbSet<UserFollowDJ> UserFollowDJs => Set<UserFollowDJ>();
        public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
        public DbSet<SocialMediaLinks> SocialMediaLinks => Set<SocialMediaLinks>();
        public DbSet<PriceRule> PriceRules => Set<PriceRule>();
        public DbSet<UserPoints> UserPoints => Set<UserPoints>();
        public DbSet<Playlist> Playlists => Set<Playlist>();
        public DbSet<PlaylistSong> PlaylistSongs => Set<PlaylistSong>();
        public DbSet<DJMix> DJMixes => Set<DJMix>();


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // ========== CORE ENTITIES ==========

            // EventDJ (Many-to-Many Join Table)
            modelBuilder.Entity<EventDJ>()
                .HasKey(edj => new { edj.EventId, edj.DJId });

            modelBuilder.Entity<EventDJ>()
                .HasOne(edj => edj.Event)
                .WithMany(e => e.EventDJs)
                .HasForeignKey(edj => edj.EventId);

            modelBuilder.Entity<EventDJ>()
                .HasOne(edj => edj.DJ)
                .WithMany(dj => dj.EventDJs)
                .HasForeignKey(edj => edj.DJId);

            // DJProfile-User Relationship (One-to-Many: admin can create multiple DJ profiles)
            modelBuilder.Entity<DJProfile>()
                .HasOne(dj => dj.User)
                .WithMany(u => u.DJProfiles)
                .HasForeignKey(dj => dj.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Order
            modelBuilder.Entity<Order>()
                .HasOne(o => o.User)
                .WithMany(u => u.Orders)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // OrderItem
            modelBuilder.Entity<OrderItem>()
                .HasOne(oi => oi.Order)
                .WithMany(o => o.OrderItems)
                .HasForeignKey(oi => oi.OrderId);

            modelBuilder.Entity<OrderItem>()
                .HasOne(oi => oi.Event)
                .WithMany(e => e.OrderItems)
                .HasForeignKey(oi => oi.EventId);

            // Payment — Order 1→N Payments (multi-attempt, design §3.4). The FK on
            // Payment.OrderId is unchanged; only the nav cardinality changed from 1:1
            // to a collection. The UNIQUE index on Payments.ProviderReference (configured
            // below) keeps attempt references distinct.
            modelBuilder.Entity<Payment>()
                .HasOne(p => p.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(p => p.OrderId);

            // DJTop10
            modelBuilder.Entity<DJTop10>()
                .HasOne(djt => djt.DJ)
                .WithMany(dj => dj.DJTop10s)
                .HasForeignKey(djt => djt.DJId);

            modelBuilder.Entity<DJTop10>()
                .HasOne(djt => djt.Song)
                .WithMany(song => song.DJTop10s)
                .HasForeignKey(djt => djt.SongId);

            // ContactMessage
            modelBuilder.Entity<ContactMessage>()
                .HasOne(cm => cm.User)
                .WithMany(u => u.ContactMessages)
                .HasForeignKey(cm => cm.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Notification
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Restrict);

        // Ticket
        modelBuilder.Entity<Ticket>()
            .HasOne(t => t.User)
            .WithMany(u => u.Tickets)
            .HasForeignKey(t => t.UserId);

        modelBuilder.Entity<Ticket>()
            .HasOne(t => t.Event)
            .WithMany(e => e.Tickets)
            .HasForeignKey(t => t.EventId);

        modelBuilder.Entity<Event>()
            .HasOne(e => e.Venue)
            .WithMany(v => v.Events)
            .HasForeignKey(e => e.VenueId);

            // ========== TICKETING / VIPPS — TicketType (P1) ==========
            modelBuilder.Entity<TicketType>(b =>
            {
                b.HasOne(tt => tt.Event)
                    .WithMany(e => e.TicketTypes)
                    .HasForeignKey(tt => tt.EventId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Enum persisted as int; APPEND-ONLY going forward.
                b.Property(tt => tt.Status).HasConversion<int>();

                // Money in minor units (øre).
                b.Property(tt => tt.PriceMinor);

                // Oversell backstop. Quoted identifiers are provider-neutral
                // (valid on both SQLite and PostgreSQL).
                b.ToTable(t => t.HasCheckConstraint(
                    "CK_TicketType_Capacity",
                    "\"QuantitySold\" + \"QuantityHeld\" <= \"Capacity\""));
            });

            // ========== TICKETING / VIPPS — Order / OrderItem / Payment / Ticket / holds / webhook dedup (P2) ==========

            // Order.Reference is the merchant order ref sent to the provider — UNIQUE
            // (correctness-critical). Filtered so legacy rows with an empty reference
            // don't collide before the paid path is live.
            modelBuilder.Entity<Order>()
                .HasIndex(o => o.Reference)
                .IsUnique()
                .HasFilter("\"Reference\" <> ''");

            // OrderItem → TicketType (tier snapshot). Restrict so a tier in use can't be
            // hard-deleted out from under issued order lines.
            modelBuilder.Entity<OrderItem>()
                .HasOne(oi => oi.TicketType)
                .WithMany()
                .HasForeignKey(oi => oi.TicketTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Payment.ProviderReference (== Order.Reference) — UNIQUE. This is the
            // idempotency backstop P6 relies on (duplicate insert → DbUpdateException).
            modelBuilder.Entity<Payment>()
                .HasIndex(p => p.ProviderReference)
                .IsUnique()
                .HasFilter("\"ProviderReference\" <> ''");

            // Ticket → OrderItem / TicketType (nullable links; issued tickets backfill them).
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.OrderItem)
                .WithMany()
                .HasForeignKey(t => t.OrderItemId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.TicketType)
                .WithMany()
                .HasForeignKey(t => t.TicketTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            // TicketHold — short-lived inventory reservation.
            modelBuilder.Entity<TicketHold>(b =>
            {
                b.HasOne(h => h.Order)
                    .WithMany(o => o.Holds)
                    .HasForeignKey(h => h.OrderId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne(h => h.TicketType)
                    .WithMany()
                    .HasForeignKey(h => h.TicketTypeId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.Property(h => h.Status).HasConversion<int>();
            });

            // PaymentWebhookEvent — inbound dedup. UNIQUE composite
            // (Provider, ProviderPspReference, EventType) is layer-1 idempotency (P6).
            modelBuilder.Entity<PaymentWebhookEvent>()
                .HasIndex(w => new { w.Provider, w.ProviderPspReference, w.EventType })
                .IsUnique();

            // ========== CHECKOUT — Promo v2 (design §3.1, §7) ==========

            // PromotionCode.Code — UNIQUE (uppercase-normalized). The correctness-critical
            // guard behind "promo code unique" (§7).
            modelBuilder.Entity<PromotionCode>()
                .HasIndex(pc => pc.Code)
                .IsUnique();

            // PromoCodeTicketType — join table restricting a promo to listed tiers.
            // Composite PK (PromoCodeId, TicketTypeId).
            modelBuilder.Entity<PromoCodeTicketType>(b =>
            {
                b.HasKey(x => new { x.PromoCodeId, x.TicketTypeId });

                b.HasOne<PromotionCode>()
                    .WithMany(pc => pc.TicketTypes)
                    .HasForeignKey(x => x.PromoCodeId)
                    .OnDelete(DeleteBehavior.Cascade);

                b.HasOne<TicketType>()
                    .WithMany()
                    .HasForeignKey(x => x.TicketTypeId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // PromoRedemption — audit + per-user-limit. Status persisted as int (APPEND-ONLY).
            modelBuilder.Entity<PromoRedemption>(b =>
            {
                b.Property(r => r.Status).HasConversion<int>();

                // One redemption per order (§7).
                b.HasIndex(r => r.OrderId).IsUnique();

                // Per-user limit counting path (Reserved|Consumed rows for a user+code).
                b.HasIndex(r => new { r.PromoCodeId, r.UserId });
            });

            // ========== HIGHLIGHTS / PREVIOUS MOMENTS — EventHighlight ==========
            // Editorial recap of a PAST event. Two FKs to Event (recapped + optional
            // upcoming rebook target) — configure BOTH explicitly with .WithMany() so EF
            // doesn't infer a single ambiguous relationship. Restrict on both so an event
            // in use can't be hard-deleted out from under a highlight.
            modelBuilder.Entity<EventHighlight>(b =>
            {
                b.HasOne(h => h.Event)
                    .WithMany()
                    .HasForeignKey(h => h.EventId)
                    .OnDelete(DeleteBehavior.Restrict);

                b.HasOne(h => h.UpcomingEvent)
                    .WithMany()
                    .HasForeignKey(h => h.UpcomingEventId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // ========== PHASE 2-4 ENTITIES ==========

            // UserFollowDJ (Many-to-Many Join Table)
            modelBuilder.Entity<UserFollowDJ>()
                .HasKey(uf => new { uf.UserId, uf.DJId });

            modelBuilder.Entity<UserFollowDJ>()
                .HasOne(uf => uf.User)
                .WithMany(u => u.FollowedDJs)
                .HasForeignKey(uf => uf.UserId);

            modelBuilder.Entity<UserFollowDJ>()
                .HasOne(uf => uf.DJ)
                .WithMany(dj => dj.Followers)
                .HasForeignKey(uf => uf.DJId);

            // Review
            modelBuilder.Entity<Review>()
                .HasOne(r => r.Event)
                .WithMany()
                .HasForeignKey(r => r.EventId);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.User)
                .WithMany(u => u.Reviews)
                .HasForeignKey(r => r.UserId);

            // DJReview
            modelBuilder.Entity<DJReview>()
                .HasOne(dr => dr.DJ)
                .WithMany(dj => dj.Reviews)
                .HasForeignKey(dr => dr.DJId);

            modelBuilder.Entity<DJReview>()
                .HasOne(dr => dr.User)
                .WithMany()
                .HasForeignKey(dr => dr.UserId);

            // MediaItem
            modelBuilder.Entity<MediaItem>()
                .HasOne(m => m.User)
                .WithMany(u => u.MediaItems)
                .HasForeignKey(m => m.UserId);

            modelBuilder.Entity<MediaItem>()
                .HasOne(m => m.Event)
                .WithMany()
                .HasForeignKey(m => m.EventId);

            // MediaLike
            modelBuilder.Entity<MediaLike>()
                .HasOne(ml => ml.MediaItem)
                .WithMany(m => m.Likes)
                .HasForeignKey(ml => ml.MediaItemId);

            modelBuilder.Entity<MediaLike>()
                .HasOne(ml => ml.User)
                .WithMany(u => u.MediaLikes)
                .HasForeignKey(ml => ml.UserId);

            // MediaComment
            modelBuilder.Entity<MediaComment>()
                .HasOne(mc => mc.MediaItem)
                .WithMany(m => m.Comments)
                .HasForeignKey(mc => mc.MediaItemId);

            modelBuilder.Entity<MediaComment>()
                .HasOne(mc => mc.User)
                .WithMany(u => u.MediaComments)
                .HasForeignKey(mc => mc.UserId);

            // Subscription
            modelBuilder.Entity<Subscription>()
                .HasOne(s => s.User)
                .WithMany(u => u.Subscriptions)
                .HasForeignKey(s => s.UserId);

            // Service
            modelBuilder.Entity<Service>()
                .HasMany(s => s.Bookings)
                .WithOne(sb => sb.Service)
                .HasForeignKey(sb => sb.ServiceId);

            modelBuilder.Entity<Service>()
                .HasMany(s => s.Reviews)
                .WithOne(sr => sr.Service)
                .HasForeignKey(sr => sr.ServiceId);

            // ServiceBooking
            modelBuilder.Entity<ServiceBooking>()
                .HasOne(sb => sb.User)
                .WithMany(u => u.ServiceBookings)
                .HasForeignKey(sb => sb.UserId);

            // ServiceReview
            modelBuilder.Entity<ServiceReview>()
                .HasOne(sr => sr.User)
                .WithMany()
                .HasForeignKey(sr => sr.UserId);

            // PushSubscription
            modelBuilder.Entity<PushSubscription>()
                .HasOne(ps => ps.User)
                .WithMany(u => u.PushSubscriptions)
                .HasForeignKey(ps => ps.UserId);

            // SocialMediaLinks (One-to-One with DJProfile)
            modelBuilder.Entity<SocialMediaLinks>()
                .HasOne(sml => sml.DJProfile)
                .WithOne(dj => dj.SocialMedia)
                .HasForeignKey<SocialMediaLinks>(sml => sml.DJProfileId);

            // PriceRule
            modelBuilder.Entity<PriceRule>()
                .HasOne(pr => pr.Event)
                .WithMany()
                .HasForeignKey(pr => pr.EventId);

            // UserBadge
            modelBuilder.Entity<UserBadge>()
                .HasOne(ub => ub.User)
                .WithMany(u => u.Badges)
                .HasForeignKey(ub => ub.UserId);

            modelBuilder.Entity<UserBadge>()
                .HasOne(ub => ub.Badge)
                .WithMany(b => b.UserBadges)
                .HasForeignKey(ub => ub.BadgeId);

            // UserPoints (One-to-One with User)
            modelBuilder.Entity<UserPoints>()
                .HasOne(up => up.User)
                .WithOne(u => u.Points)
                .HasForeignKey<UserPoints>(up => up.UserId);

            // PlaylistSong
            modelBuilder.Entity<PlaylistSong>()
                .HasOne(ps => ps.Playlist)
                .WithMany(p => p.PlaylistSongs)
                .HasForeignKey(ps => ps.PlaylistId);

            modelBuilder.Entity<PlaylistSong>()
                .HasOne(ps => ps.Song)
                .WithMany()
                .HasForeignKey(ps => ps.SongId);

            // ========== INDEXES ==========

            // Unique email
            modelBuilder.Entity<ApplicationUser>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // Unique QR code for tickets
            modelBuilder.Entity<Ticket>()
                .HasIndex(t => t.QRCode)
                .IsUnique();

            // Unique endpoint for push subscriptions
            modelBuilder.Entity<PushSubscription>()
                .HasIndex(ps => ps.Endpoint)
                .IsUnique();

            // Idempotency for n8n gallery ingest: unique on SourcePostId, filtered so
            // null/manually-uploaded media (SourcePostId == null) are exempt.
            modelBuilder.Entity<GalleryMedia>()
                .HasIndex(gm => gm.SourcePostId)
                .IsUnique()
                .HasFilter("\"SourcePostId\" IS NOT NULL");

            // Landing carousel read path: published highlights ordered by SortOrder.
            modelBuilder.Entity<EventHighlight>()
                .HasIndex(h => new { h.IsPublished, h.SortOrder });

            base.OnModelCreating(modelBuilder);
        }
    }
}
