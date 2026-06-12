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
                      );
                      CREATE TABLE IF NOT EXISTS ""EventHighlights"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""EventId"" UUID NOT NULL REFERENCES ""Events""(""Id"") ON DELETE CASCADE,
                        ""Title"" TEXT NOT NULL DEFAULT '',
                        ""Blurb"" TEXT,
                        ""CoverImageUrl"" TEXT NOT NULL DEFAULT '',
                        ""CoverVideoUrl"" TEXT,
                        ""HighlightDate"" TIMESTAMP NOT NULL DEFAULT NOW(),
                        ""UpcomingEventId"" UUID REFERENCES ""Events""(""Id"") ON DELETE SET NULL,
                        ""IsPublished"" BOOLEAN NOT NULL DEFAULT FALSE,
                        ""SortOrder"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      -- AuditLog (WS2 / TM-1) append-only trail. Runtime uses EnsureCreated, so
                      -- existing Postgres DBs need this idempotent catch-up (fresh SQLite gets the
                      -- table + indexes from the model via EnsureCreated). Postgres syntax by design.
                      CREATE TABLE IF NOT EXISTS ""AuditLogs"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""Timestamp"" TIMESTAMP NOT NULL DEFAULT NOW(),
                        ""Action"" TEXT NOT NULL DEFAULT '',
                        ""EntityName"" TEXT NOT NULL DEFAULT '',
                        ""EntityId"" TEXT NOT NULL DEFAULT '',
                        ""UserId"" TEXT NOT NULL DEFAULT '',
                        ""Changes"" TEXT
                      );
                      CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_EntityName_EntityId"" ON ""AuditLogs""(""EntityName"", ""EntityId"");
                      CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_UserId"" ON ""AuditLogs""(""UserId"");
                      CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_Timestamp"" ON ""AuditLogs""(""Timestamp"");
                      -- GDPR consent (WS3C) — signup terms + separate marketing opt-in. Same
                      -- catch-up pattern as AuditLogs: fresh SQLite gets these via EnsureCreated
                      -- from the model; existing Postgres DBs get them here. Postgres-only syntax.
                      ALTER TABLE ""ApplicationUsers"" ADD COLUMN IF NOT EXISTS ""TermsAcceptedAt"" TIMESTAMP;
                      ALTER TABLE ""ApplicationUsers"" ADD COLUMN IF NOT EXISTS ""TermsVersion"" TEXT;
                      ALTER TABLE ""ApplicationUsers"" ADD COLUMN IF NOT EXISTS ""MarketingOptIn"" BOOLEAN NOT NULL DEFAULT FALSE;
                      ALTER TABLE ""ApplicationUsers"" ADD COLUMN IF NOT EXISTS ""MarketingOptInAt"" TIMESTAMP;
                      ALTER TABLE ""ApplicationUsers"" ADD COLUMN IF NOT EXISTS ""MarketingPurpose"" TEXT;");

                // ── Ticketing + payments (P1/P2) — prod schema evolution. Runtime uses
                // EnsureCreated, so existing Postgres DBs never receive the EF migrations;
                // this idempotent block is the production path (same pattern as above).
                // Back-filled columns get NO FK constraints on purpose: legacy rows
                // (zero-guid defaults) must never block startup. The UNIQUE indexes are
                // the correctness-critical pieces (webhook dedup + reference lookups).
                await context.Database.ExecuteSqlRawAsync(
                    @"CREATE TABLE IF NOT EXISTS ""TicketTypes"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""EventId"" UUID NOT NULL REFERENCES ""Events""(""Id"") ON DELETE CASCADE,
                        ""Name"" TEXT NOT NULL DEFAULT '',
                        ""Description"" TEXT,
                        ""PriceMinor"" BIGINT NOT NULL DEFAULT 0,
                        ""VATRate"" NUMERIC NOT NULL DEFAULT 0.12,
                        ""Currency"" TEXT NOT NULL DEFAULT 'NOK',
                        ""Capacity"" INTEGER NOT NULL DEFAULT 0,
                        ""QuantitySold"" INTEGER NOT NULL DEFAULT 0,
                        ""QuantityHeld"" INTEGER NOT NULL DEFAULT 0,
                        ""AdmitCount"" INTEGER NOT NULL DEFAULT 1,
                        ""MinPerOrder"" INTEGER NOT NULL DEFAULT 1,
                        ""MaxPerOrder"" INTEGER NOT NULL DEFAULT 10,
                        ""SalesStart"" TIMESTAMP,
                        ""SalesEnd"" TIMESTAMP,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""SortOrder"" INTEGER NOT NULL DEFAULT 0,
                        CONSTRAINT ""CK_TicketType_Capacity"" CHECK (""QuantitySold"" + ""QuantityHeld"" <= ""Capacity"")
                      );
                      CREATE INDEX IF NOT EXISTS ""IX_TicketTypes_EventId"" ON ""TicketTypes""(""EventId"");
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""Reference"" TEXT NOT NULL DEFAULT '';
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""CustomerEmail"" TEXT;
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""HoldExpiresAt"" TIMESTAMP;
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Orders_Reference"" ON ""Orders""(""Reference"") WHERE ""Reference"" <> '';
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""Provider"" TEXT NOT NULL DEFAULT '';
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""ProviderReference"" TEXT NOT NULL DEFAULT '';
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""ProviderPspReference"" TEXT;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""IdempotencyKey"" TEXT;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""AuthorizedAmountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""CapturedAmountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""RefundedAmountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""LastSyncedAt"" TIMESTAMP;
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Payments_ProviderReference"" ON ""Payments""(""ProviderReference"") WHERE ""ProviderReference"" <> '';
                      ALTER TABLE ""OrderItems"" ADD COLUMN IF NOT EXISTS ""TicketTypeId"" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
                      ALTER TABLE ""OrderItems"" ADD COLUMN IF NOT EXISTS ""UnitVatRate"" NUMERIC NOT NULL DEFAULT 0.12;
                      ALTER TABLE ""OrderItems"" ADD COLUMN IF NOT EXISTS ""UnitPriceMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""OrderItems"" ADD COLUMN IF NOT EXISTS ""LineTotalMinor"" BIGINT NOT NULL DEFAULT 0;
                      CREATE INDEX IF NOT EXISTS ""IX_OrderItems_TicketTypeId"" ON ""OrderItems""(""TicketTypeId"");
                      ALTER TABLE ""Tickets"" ADD COLUMN IF NOT EXISTS ""OrderItemId"" UUID;
                      ALTER TABLE ""Tickets"" ADD COLUMN IF NOT EXISTS ""TicketTypeId"" UUID;
                      ALTER TABLE ""Tickets"" ADD COLUMN IF NOT EXISTS ""AdmitCount"" INTEGER NOT NULL DEFAULT 1;
                      ALTER TABLE ""Tickets"" ADD COLUMN IF NOT EXISTS ""AdmitsRemaining"" INTEGER NOT NULL DEFAULT 1;
                      ALTER TABLE ""Tickets"" ADD COLUMN IF NOT EXISTS ""RedeemedAt"" TIMESTAMP;
                      CREATE INDEX IF NOT EXISTS ""IX_Tickets_OrderItemId"" ON ""Tickets""(""OrderItemId"");
                      CREATE INDEX IF NOT EXISTS ""IX_Tickets_TicketTypeId"" ON ""Tickets""(""TicketTypeId"");
                      CREATE TABLE IF NOT EXISTS ""TicketHolds"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""OrderId"" UUID NOT NULL REFERENCES ""Orders""(""Id"") ON DELETE CASCADE,
                        ""TicketTypeId"" UUID NOT NULL REFERENCES ""TicketTypes""(""Id""),
                        ""Quantity"" INTEGER NOT NULL DEFAULT 0,
                        ""ExpiresAt"" TIMESTAMP NOT NULL,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      CREATE INDEX IF NOT EXISTS ""IX_TicketHolds_OrderId"" ON ""TicketHolds""(""OrderId"");
                      CREATE INDEX IF NOT EXISTS ""IX_TicketHolds_TicketTypeId"" ON ""TicketHolds""(""TicketTypeId"");
                      CREATE TABLE IF NOT EXISTS ""PaymentWebhookEvents"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""Provider"" TEXT NOT NULL DEFAULT '',
                        ""ProviderPspReference"" TEXT NOT NULL DEFAULT '',
                        ""EventType"" TEXT NOT NULL DEFAULT '',
                        ""ReceivedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PaymentWebhookEvents_Dedup"" ON ""PaymentWebhookEvents""(""Provider"", ""ProviderPspReference"", ""EventType"");");

                // ── Checkout orchestration (C1) — promo v2, hidden tiers, multi-attempt
                // payments — prod schema evolution (same established pattern; design §7).
                // Idempotent: ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS.
                // Types follow the Postgres dialect: BIGINT for *Minor (øre, long),
                // TIMESTAMP for dates, BOOLEAN for flags, INTEGER for enums/counters.
                // Back-filled columns carry NO FK constraints so legacy rows never block
                // startup. The UNIQUE indexes (PromotionCodes.Code, PromoRedemptions.OrderId)
                // are the correctness-critical invariants (§7). NB: the Order→Payments nav
                // changed 1:1→1:N, so the old UNIQUE IX_Payments_OrderId is demoted to a
                // plain index — drop-and-recreate idempotently (a second attempt per order
                // must be insertable).
                await context.Database.ExecuteSqlRawAsync(
                    @"ALTER TABLE ""TicketTypes"" ADD COLUMN IF NOT EXISTS ""IsHidden"" BOOLEAN NOT NULL DEFAULT FALSE;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""Kind"" INTEGER NOT NULL DEFAULT 0;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""AmountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""ValidFrom"" TIMESTAMP;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""MaxRedemptions"" INTEGER;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""MaxRedemptionsPerUser"" INTEGER;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""EventId"" UUID;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""UnlocksHiddenTypes"" BOOLEAN NOT NULL DEFAULT FALSE;
                      ALTER TABLE ""PromotionCodes"" ADD COLUMN IF NOT EXISTS ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE;
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PromotionCodes_Code"" ON ""PromotionCodes""(""Code"");
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""PromotionCodeId"" UUID;
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""PromoCode"" TEXT;
                      ALTER TABLE ""Orders"" ADD COLUMN IF NOT EXISTS ""DiscountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""OrderItems"" ADD COLUMN IF NOT EXISTS ""DiscountMinor"" BIGINT NOT NULL DEFAULT 0;
                      ALTER TABLE ""Payments"" ADD COLUMN IF NOT EXISTS ""AttemptNo"" INTEGER NOT NULL DEFAULT 1;
                      DROP INDEX IF EXISTS ""IX_Payments_OrderId"";
                      CREATE INDEX IF NOT EXISTS ""IX_Payments_OrderId"" ON ""Payments""(""OrderId"");
                      CREATE TABLE IF NOT EXISTS ""PromoCodeTicketTypes"" (
                        ""PromoCodeId"" UUID NOT NULL,
                        ""TicketTypeId"" UUID NOT NULL,
                        CONSTRAINT ""PK_PromoCodeTicketTypes"" PRIMARY KEY (""PromoCodeId"", ""TicketTypeId"")
                      );
                      CREATE INDEX IF NOT EXISTS ""IX_PromoCodeTicketTypes_TicketTypeId"" ON ""PromoCodeTicketTypes""(""TicketTypeId"");
                      CREATE TABLE IF NOT EXISTS ""PromoRedemptions"" (
                        ""Id"" UUID PRIMARY KEY,
                        ""PromoCodeId"" UUID NOT NULL,
                        ""OrderId"" UUID NOT NULL,
                        ""UserId"" TEXT NOT NULL DEFAULT '',
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
                      );
                      CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PromoRedemptions_OrderId"" ON ""PromoRedemptions""(""OrderId"");
                      CREATE INDEX IF NOT EXISTS ""IX_PromoRedemptions_PromoCodeId_UserId"" ON ""PromoRedemptions""(""PromoCodeId"", ""UserId"");");
            }
            catch { /* columns already exist or table doesn't exist yet (handled by EnsureCreated) */ }

            // ── DEV CONVENIENCE: EventHighlights table + one sample published highlight ──
            // Runtime uses EnsureCreated (not migrations), so a newly-added table is NOT created
            // on an already-existing database. Create it and seed one published highlight so the
            // landing "Previous Moments" section is visible in development. Runs BEFORE the
            // "already seeded" early-return so it applies to existing dev databases.
            // Production must apply the EF migration `AddEventHighlights` instead (Postgres typing).
            if (string.Equals(
                    Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                    "Development", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await context.Database.ExecuteSqlRawAsync(
                        @"CREATE TABLE IF NOT EXISTS ""EventHighlights"" (
                            ""Id"" TEXT PRIMARY KEY,
                            ""EventId"" TEXT NOT NULL,
                            ""Title"" TEXT NOT NULL DEFAULT '',
                            ""Blurb"" TEXT,
                            ""CoverImageUrl"" TEXT NOT NULL DEFAULT '',
                            ""CoverVideoUrl"" TEXT,
                            ""HighlightDate"" TEXT,
                            ""UpcomingEventId"" TEXT,
                            ""IsPublished"" INTEGER NOT NULL DEFAULT 0,
                            ""SortOrder"" INTEGER NOT NULL DEFAULT 0,
                            ""CreatedAt"" TEXT
                          );");

                    if (await context.Events.AnyAsync() && !await context.EventHighlights.AnyAsync())
                    {
                        var ev = await context.Events
                            .OrderByDescending(e => e.Date)
                            .FirstAsync();

                        context.EventHighlights.Add(new EventHighlight
                        {
                            Id = Guid.NewGuid(),
                            EventId = ev.Id,
                            Title = "Opening Night — Recap",
                            Blurb = "A first look back at the night. Demo highlight — edit or remove it in Admin → Highlights.",
                            CoverImageUrl = string.IsNullOrWhiteSpace(ev.ImageUrl)
                                ? "/media/defaults/event.jpg"
                                : ev.ImageUrl,
                            HighlightDate = ev.Date,
                            IsPublished = true,
                            SortOrder = 0,
                            CreatedAt = DateTime.UtcNow
                        });
                        await context.SaveChangesAsync();
                    }
                }
                catch { /* table already exists or non-SQLite provider — safe to ignore in dev */ }
            }

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

            // Dev: seed one published highlight for the sample event so the landing
            // "Previous Moments" section is visible on a freshly-created database.
            if (string.Equals(
                    Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                    "Development", StringComparison.OrdinalIgnoreCase)
                && !await context.EventHighlights.AnyAsync())
            {
                context.EventHighlights.Add(new EventHighlight
                {
                    Id = Guid.NewGuid(),
                    EventId = sampleEvent.Id,
                    Title = "Opening Night — Recap",
                    Blurb = "A first look back at the night. Demo highlight — edit or remove it in Admin → Highlights.",
                    CoverImageUrl = string.IsNullOrWhiteSpace(sampleEvent.ImageUrl)
                        ? "/media/defaults/event.jpg"
                        : sampleEvent.ImageUrl,
                    HighlightDate = sampleEvent.Date,
                    IsPublished = true,
                    SortOrder = 0,
                    CreatedAt = DateTime.UtcNow
                });
                await context.SaveChangesAsync();
            }
        }
    }
}
