using DJDiP.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace DJDiP.Infrastructure.Persistance
{
    public static class DbInitializer
    {
        public static async Task InitializeAsync(AppDbContext context)
        {
            // Ensure database is created
            await context.Database.EnsureCreatedAsync();

            // Add new columns to existing tables (EnsureCreated won't add columns to existing tables)
            try
            {
                await context.Database.ExecuteSqlRawAsync(
                    @"ALTER TABLE ""Songs"" ADD COLUMN IF NOT EXISTS ""SpotifyUrl"" TEXT;
                      ALTER TABLE ""Songs"" ADD COLUMN IF NOT EXISTS ""SoundCloudUrl"" TEXT;
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""HeroGenres"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""HeroLocation"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""HeroVibes"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""BrandHeadline"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""BrandNarrative"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""EventsHeading"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""EventsTagline"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""CultureHeading"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""ConceptHeading"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""LineupHeading"" TEXT DEFAULT '';
                      ALTER TABLE ""SiteSettings"" ADD COLUMN IF NOT EXISTS ""GalleryVideoUrl"" TEXT DEFAULT '';");

                // Create Playlists table if it doesn't exist (EnsureCreated won't add new tables to existing DBs)
                await context.Database.ExecuteSqlRawAsync(
                    @"CREATE TABLE IF NOT EXISTS ""Playlists"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""Title"" TEXT NOT NULL DEFAULT '',
                        ""Description"" TEXT,
                        ""Genre"" TEXT,
                        ""CoverImageUrl"" TEXT,
                        ""Curator"" TEXT,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      CREATE TABLE IF NOT EXISTS ""PlaylistSongs"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""PlaylistId"" UUID NOT NULL REFERENCES ""Playlists""(""Id"") ON DELETE CASCADE,
                        ""SongId"" UUID NOT NULL REFERENCES ""Songs""(""Id"") ON DELETE CASCADE,
                        ""Position"" INTEGER NOT NULL DEFAULT 0
                      );
                      ALTER TABLE ""Playlists"" ADD COLUMN IF NOT EXISTS ""DJProfileId"" UUID REFERENCES ""DJProfiles""(""Id"") ON DELETE SET NULL;
                      ALTER TABLE ""Venues"" ADD COLUMN IF NOT EXISTS ""ImageUrls"" TEXT;
                      ALTER TABLE ""Playlists"" ADD COLUMN IF NOT EXISTS ""PlaylistUrl"" TEXT;
                      CREATE TABLE IF NOT EXISTS ""DJMixes"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""Title"" TEXT NOT NULL DEFAULT '',
                        ""Description"" TEXT,
                        ""MixUrl"" TEXT NOT NULL DEFAULT '',
                        ""ThumbnailUrl"" TEXT,
                        ""Genre"" TEXT,
                        ""MixType"" TEXT,
                        ""DJProfileId"" UUID REFERENCES ""DJProfiles""(""Id"") ON DELETE SET NULL,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""OrganizerId"" TEXT REFERENCES ""ApplicationUsers""(""Id"") ON DELETE SET NULL;
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""TicketingUrl"" TEXT;
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""Status"" TEXT NOT NULL DEFAULT 'Published';
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""StatusReason"" TEXT;
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""SourcePostId"" TEXT;
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""SourcePlatform"" TEXT;
                      ALTER TABLE ""Events"" ADD COLUMN IF NOT EXISTS ""EventKey"" TEXT;
                      ALTER TABLE ""DJMixes"" ADD COLUMN IF NOT EXISTS ""Source"" TEXT;
                      ALTER TABLE ""DJMixes"" ADD COLUMN IF NOT EXISTS ""Duration"" TEXT;
                      ALTER TABLE ""DJMixes"" ADD COLUMN IF NOT EXISTS ""SourcePostId"" TEXT;
                      ALTER TABLE ""DJMixes"" ADD COLUMN IF NOT EXISTS ""SourcePlatform"" TEXT;
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Events_SourcePostId"" ON ""Events""(""SourcePostId"") WHERE ""SourcePostId"" IS NOT NULL;
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_DJMixes_SourcePostId"" ON ""DJMixes""(""SourcePostId"") WHERE ""SourcePostId"" IS NOT NULL;
                      CREATE INDEX IF NOT EXISTS ""IX_Events_EventKey"" ON ""Events""(""EventKey"") WHERE ""EventKey"" IS NOT NULL;
                      CREATE TABLE IF NOT EXISTS ""EventOrganizerApplications"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""UserId"" TEXT NOT NULL REFERENCES ""ApplicationUsers""(""Id"") ON DELETE CASCADE,
                        ""OrganizationName"" TEXT NOT NULL DEFAULT '',
                        ""Description"" TEXT NOT NULL DEFAULT '',
                        ""Website"" TEXT,
                        ""SocialLinks"" TEXT,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""SubmittedAt"" TIMESTAMP NOT NULL DEFAULT NOW(),
                        ""ReviewedAt"" TIMESTAMP,
                        ""ReviewedByAdminId"" TEXT,
                        ""RejectionReason"" TEXT
                      );");
            }
            catch { /* columns already exist or table doesn't exist yet (handled by EnsureCreated) */ }

            // Check if data already exists
            if (await context.SiteSettings.AnyAsync())
            {
                return; // DB has been seeded
            }

            // Seed Admin User — password must be set via ADMIN_DEFAULT_PASSWORD env var
            var adminPassword = Environment.GetEnvironmentVariable("ADMIN_DEFAULT_PASSWORD")
                ?? throw new InvalidOperationException(
                    "ADMIN_DEFAULT_PASSWORD environment variable must be set for initial database seeding.");

            var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@djdip.com";

            var adminUser = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                Email = adminEmail,
                FullName = "DJ DiP Admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Role = 2, // Admin
                IsEmailVerified = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await context.ApplicationUsers.AddAsync(adminUser);

            // Seed Sample Venue
            var venue = new Venue
            {
                Id = Guid.NewGuid(),
                Name = "The Underground Club",
                Description = "Industrial warehouse turned nightlife sanctuary.",
                Address = "Köpenicker Str. 70",
                City = "Berlin",
                Country = "Germany",
                Capacity = 1000,
                ContactEmail = "info@underground.club",
                ImageUrl = "/media/defaults/venue.jpg"
            };

            await context.Venues.AddAsync(venue);

            // Seed SiteSettings
            var siteSettings = new SiteSetting
            {
                Id = Guid.NewGuid(),
                SiteName = "KlubN",
                Tagline = "Experience the underground",
                PrimaryColor = "#FF0080",
                SecondaryColor = "#00FF9F",
                AccentColor = "#000000",
                HeroTitle = "LET'S GO KLUBN",
                HeroSubtitle = "Immersive club culture, curated lineups, and underground energy — welcome to the KlubN experience.",
                HeroCtaText = "JOIN THE MOVEMENT",
                HeroCtaLink = "/events",
                HeroBackgroundImageUrl = "/media/sections/hero/hero-background.jpg",
                HeroOverlayOpacity = 0.5,
                EnableNewsletter = true,
                EnableNotifications = true,
                EnableReviews = true,
                EnableGamification = true,
                EnableSubscriptions = true,
                MetaDescription = "KlubN - The ultimate platform for electronic music events and DJ culture",
                CopyrightText = $"© {DateTime.UtcNow.Year} KlubN. All rights reserved."
            };

            await context.SiteSettings.AddAsync(siteSettings);

            // Save independent entities first
            await context.SaveChangesAsync();

            // Seed Sample Genres (no DJ profile association initially)
            var genres = new List<Genre>
            {
                new Genre { Id = Guid.NewGuid(), Name = "Techno" },
                new Genre { Id = Guid.NewGuid(), Name = "House" },
                new Genre { Id = Guid.NewGuid(), Name = "Trance" }
            };

            await context.Genres.AddRangeAsync(genres);
            await context.SaveChangesAsync();

            // Seed Sample DJ Profiles
            var djProfiles = new List<DJProfile>
            {
                new DJProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = adminUser.Id,
                    Name = "DJ Shadow",
                    StageName = "Shadow",
                    Bio = "Pioneer of underground techno",
                    ProfilePictureUrl = "/media/defaults/dj.jpg",
                    CreatedAt = DateTime.UtcNow
                },
                new DJProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = adminUser.Id,
                    Name = "Luna Beats",
                    StageName = "Luna",
                    Bio = "House music specialist",
                    ProfilePictureUrl = "/media/defaults/dj.jpg",
                    CreatedAt = DateTime.UtcNow
                },
                new DJProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = adminUser.Id,
                    Name = "Echo Pulse",
                    StageName = "Echo",
                    Bio = "Trance and progressive",
                    ProfilePictureUrl = "/media/defaults/dj.jpg",
                    CreatedAt = DateTime.UtcNow
                },
                new DJProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = adminUser.Id,
                    Name = "Neon Flux",
                    StageName = "Neon",
                    Bio = "Electronic music producer",
                    ProfilePictureUrl = "/media/defaults/dj.jpg",
                    CreatedAt = DateTime.UtcNow
                }
            };

            await context.DJProfiles.AddRangeAsync(djProfiles);
            await context.SaveChangesAsync();

            // Seed Sample Event
            var sampleEvent = new Event
            {
                Id = Guid.NewGuid(),
                Title = "KlubN Opening Night",
                Description = "Join us for the grand opening of KlubN featuring top underground DJs",
                Date = DateTime.UtcNow.AddDays(14),
                Price = 25.00m,
                ImageUrl = "/media/defaults/event.jpg",
                VenueId = venue.Id
            };

            await context.Events.AddAsync(sampleEvent);
            await context.SaveChangesAsync();
        }
    }
}
