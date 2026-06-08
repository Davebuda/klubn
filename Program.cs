using System.Text;
using DJDiP.Application.DTO.DJProfileDTO;
using DJDiP.Application.DTO.DJApplicationDTO;
using DJDiP.Application.DTO.EventDTO;
using DJDiP.Application.DTO.GenreDTO;
using DJDiP.Application.DTO.NewsLetterDTO;
using DJDiP.Application.DTO.VenueDTO;
using DJDiP.Application.DTO.ContactMessageDTO;
using DJDiP.Application.DTO.DJTop10DTO;
using DJDiP.Application.DTO.TicketDTO;
using DJDiP.Application.DTO.TicketTypeDTO;
using DJDiP.Application.DTO.SongDTO;
using DJDiP.Application.DTO.SiteSettingsDTO;
using DJDiP.Application.DTO.PlaylistDTO;
using DJDiP.Application.DTO.MixDTO;
using DJDiP.Application.DTO.GalleryDTO;
using DJDiP.Application.DTO.UserDTO;
using DJDiP.Application.DTO.Auth;
using DJDiP.Application.Interfaces;
using DJDiP.Application.Services;
using DJDiP.Application.Options;
using DJDiP.Infrastructure.Persistance;
using DJDiP.Domain.Models;
using HotChocolate;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using AspNetCoreRateLimit;
using Microsoft.Extensions.Options;
using EventServiceImpl = DJDiP.Application.Services.EventService;
using VenueDetailsDto = DJDiP.Application.DTO.VenueDTO.VenueDto;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/djdip-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("Starting DJ-DiP application");

var builder = WebApplication.CreateBuilder(args);

// Use Serilog for logging
builder.Host.UseSerilog();

builder.Services.Configure<AuthSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<DJDiP.Application.Options.EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<DJDiP.Application.Interfaces.IEmailService, DJDiP.Application.Services.EmailService>();

// Validate JWT key at startup
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "JWT signing key must be at least 32 characters. " +
        "Set Jwt__Key environment variable or Jwt:Key in configuration. " +
        "Generate one with: openssl rand -base64 64");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddAuthorization();

// ========== HEALTH CHECKS ==========
builder.Services.AddHealthChecks();

// ========== RATE LIMITING ==========
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(options =>
{
    options.EnableEndpointRateLimiting = true;
    options.StackBlockedRequests = false;
    options.HttpStatusCode = 429;
    options.RealIpHeader = "X-Real-IP";
    options.ClientIdHeader = "X-ClientId";
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 100
        },
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1h",
            Limit = 1000
        }
    };
});
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();

// ========== HTTP CONTEXT ACCESSOR ==========
builder.Services.AddHttpContextAccessor();

// ========== CORS ==========
var corsOrigins = builder.Configuration["CORS:AllowedOrigins"]?
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? new[] { "http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(corsOrigins)
            .WithHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With")
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .AllowCredentials();
    });
});

// ========== DATABASE ==========
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "";
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase))
        options.UseNpgsql(connectionString);
    else
        options.UseSqlite(connectionString);
});

// ========== REGISTER UNIT OF WORK ==========
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// ========== REGISTER SERVICES ==========
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IEventService, EventServiceImpl>();
builder.Services.AddScoped<IDJService, DJService>();
builder.Services.AddScoped<IGenreService, GenreService>();
builder.Services.AddScoped<IVenueService, VenueService>();
builder.Services.AddScoped<IContactMessageService, ContactMessageService>();
builder.Services.AddScoped<INewsletterService, NewsletterService>();
builder.Services.AddScoped<IDJTop10Service, DJTop10Service>();
builder.Services.AddScoped<IFollowService, FollowService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddScoped<ISongService, SongService>();
builder.Services.AddScoped<IDJApplicationService, DJApplicationService>();
builder.Services.AddScoped<ISiteSettingsService, SiteSettingsService>();
builder.Services.AddScoped<IGalleryMediaService, GalleryMediaService>();
builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<IDJMixService, DJMixService>();
builder.Services.AddHttpClient();

// ========== PAYMENT SEAM (P3 — provider-agnostic) ==========
// Bind Vipps config (plumbing only; real values arrive with P4 TEST creds).
builder.Services.Configure<DJDiP.Infrastructure.Payments.Vipps.VippsOptions>(
    builder.Configuration.GetSection(DJDiP.Infrastructure.Payments.Vipps.VippsOptions.SectionName));
// Stubs keep the DI graph valid until P4 (provider) / P5-P6 (orchestrator).
// P4 replaces the provider with a typed-HttpClient VippsPaymentProvider registered
// by Name ("Vipps") so the P6 webhook can dispatch on the {provider} route segment.
builder.Services.AddScoped<DJDiP.Application.Interfaces.IPaymentProvider,
    DJDiP.Infrastructure.Payments.NotConfiguredPaymentProvider>();
builder.Services.AddScoped<DJDiP.Application.Interfaces.IPaymentOrchestrator,
    DJDiP.Infrastructure.Payments.NotConfiguredPaymentOrchestrator>();
builder.Services.AddScoped<IFileUploadService>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var config = sp.GetRequiredService<IConfiguration>();
    var uploadPath = System.IO.Path.Combine(env.WebRootPath, "uploads");
    var baseUrl = config["AppSettings:BaseUrl"] ?? "http://localhost:5000";
    return new FileUploadService(uploadPath, baseUrl);
});

// ========== CONTROLLERS (for file upload endpoint) ==========
builder.Services.AddControllers();

// ========== GRAPHQL ==========
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddErrorFilter(error =>
    {
        // No exception means it's an intentional GraphQL error — preserve message as-is
        if (error.Exception == null)
            return error;
        // GraphQLException — preserve the intentional message
        if (error.Exception is GraphQLException)
            return error.WithMessage(error.Exception.Message);
        // Unexpected exception — log details, then sanitize in production
        Console.Error.WriteLine($"[GraphQL ERROR] {error.Exception.GetType().Name}: {error.Exception.Message}\n{error.Exception.StackTrace}");
        if (!builder.Environment.IsDevelopment())
            return error.WithMessage("An unexpected error occurred.");
        return error;
    })
    .ModifyRequestOptions(opt =>
    {
        opt.IncludeExceptionDetails = builder.Environment.IsDevelopment();
    })
    .ModifyOptions(o => o.StrictValidation = false);


var app = builder.Build();

// ========== DATABASE INITIALIZATION ==========
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        await DbInitializer.InitializeAsync(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

// ========== MIDDLEWARE ==========
// Security Headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer-when-downgrade");
    context.Response.Headers.Append("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    context.Response.Headers.Remove("Server");
    await next();
});

// Rate limiting (must be before other middleware)
app.UseIpRateLimiting();

app.UseCors("Frontend");

// Serve static files (uploaded images)
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// ========== ROUTES ==========
app.MapControllers(); // Map REST API controllers (file upload)

// Health check endpoint
app.MapHealthChecks("/health");

app.MapGet("/", () => "DJ-DiP API is running! Visit /graphql for GraphQL playground.");

// GraphQL endpoint
app.MapGraphQL("/graphql").WithOptions(new HotChocolate.AspNetCore.GraphQLServerOptions
{
    Tool = { Enable = app.Environment.IsDevelopment() }
});

// Dynamic sitemap
app.MapGet("/sitemap.xml", async (AppDbContext db, HttpContext ctx) =>
{
    var baseUrl = "https://klubn.no";
    var now = DateTime.UtcNow.ToString("yyyy-MM-dd");

    var eventIds = await db.Events
        .Where(e => e.Status == "Published")
        .Select(e => e.Id)
        .ToListAsync();

    var djIds = await db.DJProfiles
        .Select(dj => dj.Id)
        .ToListAsync();

    var sb = new StringBuilder();
    sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

    // Static pages
    foreach (var (loc, freq, pri) in new[]
    {
        ($"{baseUrl}/", "daily", "1.0"),
        ($"{baseUrl}/events", "daily", "0.9"),
        ($"{baseUrl}/djs", "weekly", "0.8"),
        ($"{baseUrl}/gallery", "weekly", "0.7"),
        ($"{baseUrl}/mixes", "weekly", "0.7"),
        ($"{baseUrl}/playlists", "weekly", "0.6"),
        ($"{baseUrl}/contact", "monthly", "0.5"),
    })
    {
        sb.AppendLine($"  <url><loc>{loc}</loc><lastmod>{now}</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>");
    }

    // Dynamic event pages
    foreach (var id in eventIds)
        sb.AppendLine($"  <url><loc>{baseUrl}/events/{id}</loc><lastmod>{now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>");

    // Dynamic DJ profile pages
    foreach (var id in djIds)
        sb.AppendLine($"  <url><loc>{baseUrl}/djs/{id}</loc><lastmod>{now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>");

    sb.AppendLine("</urlset>");

    ctx.Response.ContentType = "application/xml; charset=utf-8";
    await ctx.Response.WriteAsync(sb.ToString());
});

Log.Information("DJ-DiP application started successfully");
app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

public class Query
{
    // Landing page: upcoming events and featured DJs
    public async Task<LandingPageData> Landing(
        [Service] IEventService events,
        [Service] IDJService djs)
    {
        var upcoming = await events.GetAllAsync();
        var djList = await djs.GetAllAsync();
        return new LandingPageData
        {
            Events = upcoming,
            DJs = djList
        };
    }

    // All events
    public async Task<IEnumerable<EventListDto>> Events(
        [Service] IEventService events)
    {
        return await events.GetAllAsync();
    }

    // Event details by id
    public async Task<DetailEventDto?> Event(
        Guid id,
        [Service] IEventService events)
    {
        return await events.GetByIdAsync(id);
    }

    // All DJs (FIXED: dJs not djs)
    public async Task<IEnumerable<DJProfileListItemDto>> DJs(
        [Service] IDJService djs)
    {
        return await djs.GetAllAsync();
    }

    // DJ profile by id
    public async Task<DJProfileDetailDto?> Dj(
        Guid id,
        [Service] IDJService djs)
    {
        return await djs.GetByIdAsync(id);
    }

    // Follow stats helpers
    public async Task<IEnumerable<DJProfileListItemDto>> FollowedDjs(
        string userId,
        [Service] IFollowService followService)
    {
        return await followService.GetFollowedDjsAsync(userId);
    }

    public async Task<int> FollowerCount(
        Guid djId,
        [Service] IFollowService followService)
    {
        return await followService.GetFollowerCountAsync(djId);
    }

    public async Task<bool> IsFollowingDj(
        Guid djId,
        string userId,
        [Service] IFollowService followService)
    {
        return await followService.IsFollowingAsync(userId, djId);
    }

    // DJ Applications
    public async Task<DJApplicationDto?> DjApplication(
        Guid id,
        [Service] IDJApplicationService djApplicationService)
    {
        return await djApplicationService.GetApplicationByIdAsync(id);
    }

    public async Task<DJApplicationDto?> DjApplicationByUser(
        string userId,
        [Service] IDJApplicationService djApplicationService)
    {
        return await djApplicationService.GetApplicationByUserIdAsync(userId);
    }

    public async Task<IEnumerable<DJApplicationDto>> DjApplications(
        [Service] IDJApplicationService djApplicationService)
    {
        return await djApplicationService.GetAllApplicationsAsync();
    }

    public async Task<IEnumerable<DJApplicationDto>> PendingDjApplications(
        [Service] IDJApplicationService djApplicationService)
    {
        return await djApplicationService.GetPendingApplicationsAsync();
    }

    public async Task<bool> HasPendingDjApplication(
        string userId,
        [Service] IDJApplicationService djApplicationService)
    {
        return await djApplicationService.HasPendingApplicationAsync(userId);
    }

    // Tickets
    public async Task<IEnumerable<TicketDto>> TicketsByUser(
        string userId,
        [Service] ITicketService ticketService)
    {
        return await ticketService.GetTicketsByUserIdAsync(userId);
    }

    public async Task<IEnumerable<TicketDto>> TicketsByEvent(
        Guid eventId,
        [Service] ITicketService ticketService)
    {
        return await ticketService.GetTicketsByEventIdAsync(eventId);
    }

    public async Task<TicketDto?> Ticket(
        Guid id,
        [Service] ITicketService ticketService)
    {
        return await ticketService.GetTicketByIdAsync(id);
    }

    // Genres
    public async Task<IEnumerable<GenreDto>> Genres(
        [Service] IGenreService genres)
    {
        return await genres.GetAllAsync();
    }

    // Venues
    public async Task<IEnumerable<VenueDetailsDto>> Venues(
        [Service] IVenueService venues)
    {
        return await venues.GetAllAsync();
    }

    // Venue by id
    public async Task<VenueDetailsDto?> Venue(
        Guid id,
        [Service] IVenueService venues)
    {
        return await venues.GetByIdAsync(id);
    }

    // Contact messages
    public async Task<IEnumerable<ContactMessageReadDto>> ContactMessages(
        [Service] IContactMessageService contactMessageService)
    {
        return await contactMessageService.GetAllAsync();
    }

    // Newsletter subscriptions
    public async Task<IEnumerable<NewsletterDto>> Newsletters(
        [Service] INewsletterService newsletterService)
    {
        return await newsletterService.GetAllAsync();
    }

    // DJ Top 10 lists
    public async Task<IEnumerable<DJTop10ListDto>> DjTop10Lists(
        [Service] IDJTop10Service djTop10Service)
    {
        return await djTop10Service.GetAllAsync();
    }

    // DJ Top 10 entry
    public async Task<DJTop10ReadDto?> DjTop10(
        Guid id,
        [Service] IDJTop10Service djTop10Service)
    {
        return await djTop10Service.GetByIdAsync(id);
    }

    // Songs
    public async Task<IEnumerable<SongDto>> Songs(
        [Service] ISongService songService)
    {
        return await songService.GetAllSongsAsync();
    }

    public async Task<SongDto?> Song(
        Guid id,
        [Service] ISongService songService)
    {
        return await songService.GetSongByIdAsync(id);
    }

    // Site settings
    public async Task<SiteSettingsDto> SiteSettings(
        [Service] ISiteSettingsService siteSettingsService)
    {
        return await siteSettingsService.GetAsync();
    }

    // Gallery Media
    public async Task<IEnumerable<GalleryMediaDto>> GalleryMedia(
        bool? approvedOnly,
        [Service] IGalleryMediaService galleryMediaService)
    {
        return await galleryMediaService.GetAllAsync(approvedOnly ?? true);
    }

    public async Task<IEnumerable<GalleryMediaDto>> FeaturedGalleryMedia(
        [Service] IGalleryMediaService galleryMediaService)
    {
        return await galleryMediaService.GetFeaturedAsync();
    }

    public async Task<GalleryMediaDto?> GalleryMediaItem(
        Guid id,
        [Service] IGalleryMediaService galleryMediaService)
    {
        return await galleryMediaService.GetByIdAsync(id);
    }

    public async Task<IEnumerable<GalleryMediaDto>> GalleryMediaByEvent(
        Guid eventId,
        [Service] IGalleryMediaService galleryMediaService)
    {
        return await galleryMediaService.GetByEventAsync(eventId);
    }

    public async Task<IEnumerable<GalleryMediaDto>> GalleryMediaByUser(
        string userId,
        [Service] IGalleryMediaService galleryMediaService)
    {
        return await galleryMediaService.GetByUserAsync(userId);
    }

    // User profile query
    public async Task<UserDetailsDto?> UserById(
        string userId,
        [Service] IUserService userService)
    {
        return await userService.GetUserByIdAsync(userId);
    }

    // All users (admin). P0-T1: admin-only guard; PasswordHash never projected/exposed.
    public async Task<IEnumerable<AdminUserDto>> Users(
        [Service] IUnitOfWork unitOfWork,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        Mutation.RequireAdmin(httpContextAccessor);
        var users = await unitOfWork.Users.GetAllAsync();
        return users.OrderByDescending(u => u.CreatedAt).Select(u => new AdminUserDto
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsEmailVerified = u.IsEmailVerified,
            Provider = u.Provider,
            ProfilePictureUrl = u.ProfilePictureUrl,
            CreatedAt = u.CreatedAt,
            UpdatedAt = u.UpdatedAt,
            LastLoginAt = u.LastLoginAt
        });
    }

    // Ticket types for an event (P1-T3). Public callers see only sellable
    // (OnSale) tiers; Admin/CoAdmin see all tiers for management. Money is
    // returned in minor units (øre).
    public async Task<IEnumerable<TicketTypeDto>> TicketTypesByEvent(
        Guid eventId,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var role = Mutation.GetCurrentRole(httpContextAccessor);
        var isManager = role == "Admin" || role == "CoAdmin";

        var query = db.TicketTypes.AsNoTracking().Where(tt => tt.EventId == eventId);
        if (!isManager)
            query = query.Where(tt => tt.Status == TicketTypeStatus.OnSale);

        var types = await query
            .OrderBy(tt => tt.SortOrder)
            .ThenBy(tt => tt.PriceMinor)
            .ToListAsync();

        return types.Select(TicketTypeMapper.ToDto);
    }

    // DJ Reviews
    public async Task<IEnumerable<DJReviewDto>> DjReviews(
        Guid djId,
        [Service] IUnitOfWork unitOfWork)
    {
        var reviews = (await unitOfWork.DJReviews.GetAllAsync())
            .Where(r => r.DJId == djId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        var userIds = reviews.Select(r => r.UserId).Distinct();
        var userNames = new Dictionary<string, string>();
        foreach (var userId in userIds)
        {
            var user = await unitOfWork.Users.GetByIdAsync(userId);
            if (user != null) userNames[userId] = user.FullName;
        }

        return reviews.Select(r => new DJReviewDto
        {
            Id = r.Id,
            DJId = r.DJId,
            UserId = r.UserId,
            UserName = userNames.TryGetValue(r.UserId, out var name) ? name : "Anonymous",
            Rating = r.Rating,
            Comment = r.Comment,
            CreatedAt = r.CreatedAt
        });
    }

    // Playlists
    public async Task<IEnumerable<PlaylistDto>> Playlists(
        [Service] IPlaylistService playlistService)
    {
        return await playlistService.GetAllAsync();
    }

    public async Task<PlaylistDto?> Playlist(
        Guid id,
        [Service] IPlaylistService playlistService)
    {
        return await playlistService.GetByIdAsync(id);
    }

    public async Task<IEnumerable<PlaylistDto>> MyDjPlaylists(
        Guid djProfileId,
        [Service] IPlaylistService playlistService)
    {
        return await playlistService.GetByDjProfileIdAsync(djProfileId);
    }

    // Fetch song metadata from Spotify/SoundCloud oEmbed
    public async Task<SongMetadataResult> FetchSongMetadata(
        string url,
        [Service] IHttpClientFactory httpClientFactory)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new GraphQLException("URL is required.");

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(10);

        try
        {
            if (url.Contains("spotify.com", StringComparison.OrdinalIgnoreCase))
            {
                var oembedUrl = $"https://open.spotify.com/oembed?url={Uri.EscapeDataString(url)}";
                var response = await client.GetStringAsync(oembedUrl);
                var json = System.Text.Json.JsonDocument.Parse(response);
                var root = json.RootElement;

                var fullTitle = root.GetProperty("title").GetString() ?? "";
                var thumbnailUrl = root.TryGetProperty("thumbnail_url", out var thumb) ? thumb.GetString() : null;

                // Spotify title format: "Artist - Track Name"
                var parts = fullTitle.Split(" - ", 2);
                var artist = parts.Length > 1 ? parts[0].Trim() : "";
                var title = parts.Length > 1 ? parts[1].Trim() : fullTitle.Trim();

                return new SongMetadataResult
                {
                    Title = title,
                    Artist = artist,
                    CoverImageUrl = thumbnailUrl,
                    SpotifyUrl = url,
                    SoundCloudUrl = null
                };
            }
            else if (url.Contains("soundcloud.com", StringComparison.OrdinalIgnoreCase))
            {
                var oembedUrl = $"https://soundcloud.com/oembed?format=json&url={Uri.EscapeDataString(url)}";
                var response = await client.GetStringAsync(oembedUrl);
                var json = System.Text.Json.JsonDocument.Parse(response);
                var root = json.RootElement;

                var title = root.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                var artist = root.TryGetProperty("author_name", out var a) ? a.GetString() ?? "" : "";
                var thumbnailUrl = root.TryGetProperty("thumbnail_url", out var thumb) ? thumb.GetString() : null;

                return new SongMetadataResult
                {
                    Title = title,
                    Artist = artist,
                    CoverImageUrl = thumbnailUrl,
                    SpotifyUrl = null,
                    SoundCloudUrl = url
                };
            }
            else
            {
                throw new GraphQLException("URL must be a Spotify or SoundCloud link.");
            }
        }
        catch (HttpRequestException)
        {
            throw new GraphQLException("Could not fetch metadata from that URL. Please check the link.");
        }
        catch (System.Text.Json.JsonException)
        {
            throw new GraphQLException("Unexpected response from music service.");
        }
    }

    // DJ Mixes
    public async Task<IEnumerable<DJMixDto>> DjMixes(
        [Service] IDJMixService djMixService)
    {
        return await djMixService.GetAllAsync();
    }

    public async Task<DJMixDto?> DjMix(
        Guid id,
        [Service] IDJMixService djMixService)
    {
        return await djMixService.GetByIdAsync(id);
    }

    // Event Organizer Applications
    public async Task<OrganizerApplicationDto?> OrganizerApplicationByUser(
        string userId,
        [Service] AppDbContext db)
    {
        var app = await db.EventOrganizerApplications
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.SubmittedAt)
            .FirstOrDefaultAsync();
        if (app == null) return null;
        return OrganizerApplicationDto.From(app);
    }

    public async Task<IEnumerable<OrganizerApplicationDto>> OrganizerApplications(
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != "Admin") throw new GraphQLException("Access denied.");
        var apps = await db.EventOrganizerApplications.OrderByDescending(a => a.SubmittedAt).ToListAsync();
        return apps.Select(OrganizerApplicationDto.From);
    }

    // Pending events (organizer-submitted, awaiting admin approval)
    public async Task<IEnumerable<EventListDto>> PendingEvents(
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != "Admin" && role != "CoAdmin") throw new GraphQLException("Access denied.");
        return await db.Events
            .Include(e => e.Venue)
            .Include(e => e.Genres)
            .Where(e => e.Status == "PendingApproval")
            .OrderByDescending(e => e.Date)
            .Select(e => new EventListDto
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Date = e.Date,
                Price = e.Price,
                ImageUrl = e.ImageUrl,
                TicketingUrl = e.TicketingUrl,
                Status = e.Status,
                OrganizerId = e.OrganizerId,
                Genres = e.Genres.Select(g => g.Name).ToList(),
                Venue = new EventVenueDto { Id = e.Venue.Id, Name = e.Venue.Name, City = e.Venue.City }
            })
            .ToListAsync();
    }

    // Organizer's own events (all statuses)
    public async Task<IEnumerable<EventListDto>> MyOrganizerEvents(
        string userId,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var callerUserId = httpContextAccessor.HttpContext?.User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(callerUserId)) throw new GraphQLException("Authentication required.");
        if (role != "Admin" && callerUserId != userId) throw new GraphQLException("Access denied.");
        return await db.Events
            .Include(e => e.Venue)
            .Include(e => e.Genres)
            .Where(e => e.OrganizerId == userId)
            .OrderByDescending(e => e.Date)
            .Select(e => new EventListDto
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                Date = e.Date,
                Price = e.Price,
                ImageUrl = e.ImageUrl,
                TicketingUrl = e.TicketingUrl,
                Status = e.Status,
                StatusReason = e.StatusReason,
                OrganizerId = e.OrganizerId,
                Genres = e.Genres.Select(g => g.Name).ToList(),
                Venue = new EventVenueDto { Id = e.Venue.Id, Name = e.Venue.Name, City = e.Venue.City }
            })
            .ToListAsync();
    }
}

public class SongMetadataResult
{
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? SpotifyUrl { get; set; }
    public string? SoundCloudUrl { get; set; }
}

public class LandingPageData
{
    public IEnumerable<EventListDto> Events { get; set; } = new List<EventListDto>();
    public IEnumerable<DJProfileListItemDto> DJs { get; set; } = new List<DJProfileListItemDto>();
}

public class Mutation
{
    // ========== AUTH HELPERS ==========
    // internal so the Query class (and other resolver types) can reuse the same
    // JWT-claim-based guards. P0-T1/P0-T3: identity is always derived from the
    // authenticated principal, never trusted from client input.
    internal static string RequireAuthentication(IHttpContextAccessor accessor)
    {
        var userId = accessor.HttpContext?.User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(userId))
            throw new GraphQLException("Authentication required.");
        return userId;
    }

    internal static string RequireAdmin(IHttpContextAccessor accessor)
    {
        var userId = RequireAuthentication(accessor);
        var role = accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != "Admin")
            throw new GraphQLException("Access denied. Admin role required.");
        return userId;
    }

    private static string RequireCoAdmin(IHttpContextAccessor accessor)
    {
        var userId = RequireAuthentication(accessor);
        var role = accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != "Admin" && role != "CoAdmin")
            throw new GraphQLException("Access denied. Admin or CoAdmin role required.");
        return userId;
    }

    private static string RequireRole(IHttpContextAccessor accessor, params string[] roles)
    {
        var userId = RequireAuthentication(accessor);
        var role = accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role == null || !roles.Contains(role))
            throw new GraphQLException($"Access denied. Required role: {string.Join(" or ", roles)}.");
        return userId;
    }

    internal static string? GetCurrentRole(IHttpContextAccessor accessor)
    {
        return accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
    }

    private async Task RequireDjProfileOwnerOrManager(
        Guid djProfileId,
        IHttpContextAccessor accessor,
        IUnitOfWork unitOfWork)
    {
        var userId = RequireAuthentication(accessor);
        var role = GetCurrentRole(accessor);
        if (role == "Admin" || role == "CoAdmin") return;

        var djProfile = await unitOfWork.DJProfiles.GetByIdAsync(djProfileId);
        if (djProfile == null)
            throw new GraphQLException("DJ profile not found.");

        if (djProfile.UserId != userId)
            throw new GraphQLException("Access denied. You can only modify your own DJ profile.");
    }

    private async Task RequireDjTop10OwnerOrManager(
        Guid entryId,
        IHttpContextAccessor accessor,
        IUnitOfWork unitOfWork)
    {
        var role = GetCurrentRole(accessor);
        if (role == "Admin" || role == "CoAdmin") return;

        var entry = await unitOfWork.DJTop10s.GetByIdAsync(entryId);
        if (entry == null)
            throw new GraphQLException("Top 10 entry not found.");

        await RequireDjProfileOwnerOrManager(entry.DJId, accessor, unitOfWork);
    }

    private async Task RequireDjMixOwnerOrManager(
        Guid mixId,
        IHttpContextAccessor accessor,
        IUnitOfWork unitOfWork)
    {
        var role = GetCurrentRole(accessor);
        if (role == "Admin" || role == "CoAdmin") return;

        var mix = await unitOfWork.DJMixes.GetByIdAsync(mixId);
        if (mix == null)
            throw new GraphQLException("Mix not found.");

        if (!mix.DJProfileId.HasValue)
            throw new GraphQLException("Access denied. Only admins can modify unassigned mixes.");

        await RequireDjProfileOwnerOrManager(mix.DJProfileId.Value, accessor, unitOfWork);
    }

    private static string RequireOrganizer(IHttpContextAccessor accessor)
    {
        var userId = RequireAuthentication(accessor);
        var role = accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != "EventOrganizer" && role != "Admin")
            throw new GraphQLException("Access denied. Event Organizer role required.");
        return userId;
    }

    // AUTH MUTATIONS
    public async Task<AuthPayload> Register(
        RegisterInput input,
        [Service] IAuthService authService,
        [Service] IEmailService emailService)
    {
        if (string.IsNullOrWhiteSpace(input.FullName))
            throw new GraphQLException("Full name is required.");
        if (string.IsNullOrWhiteSpace(input.Email) || !input.Email.Contains('@'))
            throw new GraphQLException("A valid email address is required.");
        if (string.IsNullOrWhiteSpace(input.Password))
            throw new GraphQLException("Password is required.");

        try
        {
            var result = await authService.RegisterAsync(input.FullName.Trim(), input.Email.Trim().ToLowerInvariant(), input.Password);

            _ = emailService.SendWelcomeEmailAsync(input.Email.Trim(), input.FullName.Trim());

            return result;
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (
            ex.InnerException?.Message.Contains("unique") == true ||
            ex.InnerException?.Message.Contains("duplicate") == true)
        {
            throw new GraphQLException("An account with this email already exists.");
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Registration failed: {ex.Message}");
        }
    }

    public async Task<AuthPayload> Login(
        LoginInput input,
        [Service] IAuthService authService)
    {
        if (string.IsNullOrWhiteSpace(input.Email))
            throw new GraphQLException("Email is required.");
        if (string.IsNullOrWhiteSpace(input.Password))
            throw new GraphQLException("Password is required.");

        try
        {
            return await authService.LoginAsync(input.Email.Trim().ToLowerInvariant(), input.Password);
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Login failed: {ex.Message}");
        }
    }

    // PASSWORD RESET MUTATIONS
    public async Task<bool> ForgotPassword(
        string email,
        [Service] IAuthService authService,
        [Service] IEmailService emailService)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new GraphQLException("A valid email address is required.");

        var result = await authService.GeneratePasswordResetTokenAsync(email.Trim().ToLowerInvariant());

        if (result != null)
        {
            var (token, userEmail, fullName) = result.Value;
            var frontendUrl = Environment.GetEnvironmentVariable("AppSettings__FrontendUrl") ?? "http://localhost:3000";
            var resetLink = $"{frontendUrl}/reset-password?email={Uri.EscapeDataString(userEmail)}&token={Uri.EscapeDataString(token)}";

            try
            {
                await emailService.SendPasswordResetAsync(userEmail, fullName, resetLink);
            }
            catch
            {
                // Swallow to prevent email enumeration — errors are logged inside EmailService
            }
        }

        // Always return true to prevent email enumeration
        return true;
    }

    public async Task<bool> ResetPassword(
        ResetPasswordInput input,
        [Service] IAuthService authService)
    {
        if (string.IsNullOrWhiteSpace(input.Email))
            throw new GraphQLException("Email is required.");
        if (string.IsNullOrWhiteSpace(input.Token))
            throw new GraphQLException("Reset token is required.");
        if (string.IsNullOrWhiteSpace(input.NewPassword))
            throw new GraphQLException("New password is required.");

        try
        {
            return await authService.ResetPasswordAsync(
                input.Email.Trim().ToLowerInvariant(),
                input.Token,
                input.NewPassword);
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
    }

    // EVENT MUTATIONS
    public async Task<Guid> CreateEvent(
        CreateEventInput input,
        [Service] IEventService events,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        if (string.IsNullOrWhiteSpace(input.Title))
            throw new GraphQLException("Event title is required.");

        var dto = new CreateEventDto
        {
            Title = input.Title,
            Date = input.Date,
            VenueId = input.VenueId,
            Price = input.Price,
            Description = input.Description,
            GenreIds = input.GenreIds ?? new List<Guid>(),
            DJIds = input.DjIds ?? new List<Guid>(),
            ImageUrl = input.ImageUrl,
            VideoUrl = input.VideoUrl,
            TicketingUrl = input.TicketingUrl
        };

        try
        {
            return await events.CreateAsync(dto);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to create event: {ex.Message}");
        }
    }

    public async Task<bool> UpdateEvent(
        Guid id,
        UpdateEventInput input,
        [Service] IEventService events,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var dto = new UpdateEventDto
        {
            Id = id,
            Title = input.Title,
            Date = input.Date,
            VenueId = input.VenueId,
            Price = input.Price,
            Description = input.Description,
            GenreIds = input.GenreIds ?? new List<Guid>(),
            DJIds = input.DjIds ?? new List<Guid>(),
            ImageUrl = input.ImageUrl,
            VideoUrl = input.VideoUrl,
            TicketingUrl = input.TicketingUrl
        };

        await events.UpdateAsync(id, dto);
        return true;
    }

    public async Task<bool> DeleteEvent(
        Guid id,
        [Service] IEventService events,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        await events.DeleteAsync(id);
        return true;
    }

    // ORGANIZER EVENT MUTATIONS
    public async Task<Guid> CreateEventAsOrganizer(
        CreateEventInput input,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userId = RequireOrganizer(httpContextAccessor);
        if (string.IsNullOrWhiteSpace(input.Title))
            throw new GraphQLException("Event title is required.");

        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Title = input.Title,
            Date = input.Date,
            VenueId = input.VenueId,
            Price = input.Price,
            Description = input.Description,
            ImageUrl = input.ImageUrl,
            VideoUrl = input.VideoUrl,
            TicketingUrl = input.TicketingUrl,
            OrganizerId = userId,
            Status = "PendingApproval"
        };

        if (input.GenreIds?.Any() == true)
        {
            var genres = await db.Genres.Where(g => input.GenreIds.Contains(g.Id)).ToListAsync();
            ev.Genres = genres;
        }
        if (input.DjIds?.Any() == true)
        {
            ev.EventDJs = input.DjIds.Select(djId => new EventDJ { EventId = ev.Id, DJId = djId }).ToList();
        }

        db.Events.Add(ev);
        await db.SaveChangesAsync();
        return ev.Id;
    }

    public async Task<bool> UpdateEventAsOrganizer(
        Guid id,
        UpdateEventInput input,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userId = RequireOrganizer(httpContextAccessor);
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        var ev = await db.Events.Include(e => e.Genres).Include(e => e.EventDJs)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) throw new GraphQLException("Event not found.");
        if (role != "Admin" && ev.OrganizerId != userId)
            throw new GraphQLException("Access denied. You can only edit your own events.");

        ev.Title = input.Title;
        ev.Date = input.Date;
        ev.VenueId = input.VenueId;
        ev.Price = input.Price;
        ev.Description = input.Description;
        ev.ImageUrl = input.ImageUrl;
        ev.VideoUrl = input.VideoUrl;
        ev.TicketingUrl = input.TicketingUrl;
        ev.Status = "PendingApproval"; // re-submit for approval on edit

        ev.Genres.Clear();
        if (input.GenreIds?.Any() == true)
            ev.Genres = await db.Genres.Where(g => input.GenreIds.Contains(g.Id)).ToListAsync();

        ev.EventDJs.Clear();
        if (input.DjIds?.Any() == true)
            ev.EventDJs = input.DjIds.Select(djId => new EventDJ { EventId = ev.Id, DJId = djId }).ToList();

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteEventAsOrganizer(
        Guid id,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userId = RequireOrganizer(httpContextAccessor);
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var ev = await db.Events.FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) throw new GraphQLException("Event not found.");
        if (role != "Admin" && ev.OrganizerId != userId)
            throw new GraphQLException("Access denied.");
        db.Events.Remove(ev);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ApproveEvent(
        Guid id,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var ev = await db.Events.FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) throw new GraphQLException("Event not found.");
        ev.Status = "Published";
        ev.StatusReason = null;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RejectEvent(
        Guid id,
        string reason,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var ev = await db.Events.FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) throw new GraphQLException("Event not found.");
        ev.Status = "Rejected";
        ev.StatusReason = reason;
        await db.SaveChangesAsync();
        return true;
    }

    // DJ MUTATIONS
    public async Task<Guid> CreateDj(
        CreateDjInput input,
        [Service] IDJService djs,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var adminUserId = RequireCoAdmin(httpContextAccessor);

        // Validate required fields
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(input.StageName)) errors.Add("Stage Name is required.");
        if (string.IsNullOrWhiteSpace(input.Bio)) errors.Add("Short Bio is required.");
        if (string.IsNullOrWhiteSpace(input.Genre)) errors.Add("Genre is required.");
        if (errors.Count > 0)
            throw new GraphQLException(string.Join(" ", errors));

        var resolvedUserId = string.IsNullOrWhiteSpace(input.UserId) ? adminUserId : input.UserId;

        var dto = new CreateDJProfileDto
        {
            StageName = input.StageName,
            FullName = input.FullName,
            Email = input.Email,
            Bio = input.Bio,
            LongBio = input.LongBio,
            Tagline = input.Tagline,
            Genre = input.Genre,
            SocialLinks = input.SocialLinks,
            ProfilePictureUrl = input.ProfilePictureUrl,
            CoverImageUrl = input.CoverImageUrl,
            Specialties = input.Specialties,
            Achievements = input.Achievements,
            YearsExperience = input.YearsExperience,
            InfluencedBy = input.InfluencedBy,
            EquipmentUsed = input.EquipmentUsed,
            UserId = resolvedUserId,
            TopTracks = input.TopTracks
        };

        try
        {
            return await djs.CreateAsync(dto);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (ex.InnerException?.Message.Contains("FK_DJProfiles_ApplicationUsers") == true)
        {
            throw new GraphQLException($"User ID '{resolvedUserId}' does not exist. Leave User ID blank to use your admin account.");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (ex.InnerException?.Message.Contains("unique") == true || ex.InnerException?.Message.Contains("duplicate") == true)
        {
            throw new GraphQLException("A DJ profile with this data already exists.");
        }
    }

    public async Task<bool> UpdateDj(
        Guid id,
        UpdateDjInput input,
        [Service] IDJService djs,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        await RequireDjProfileOwnerOrManager(id, httpContextAccessor, unitOfWork);
        var dto = new UpdateDJProfileDto
        {
            Id = id,
            StageName = input.StageName,
            FullName = input.FullName,
            Bio = input.Bio,
            LongBio = input.LongBio,
            Tagline = input.Tagline,
            Genre = input.Genre,
            SocialLinks = input.SocialLinks,
            ProfilePictureUrl = input.ProfilePictureUrl,
            CoverImageUrl = input.CoverImageUrl,
            Specialties = input.Specialties,
            Achievements = input.Achievements,
            YearsExperience = input.YearsExperience,
            InfluencedBy = input.InfluencedBy,
            EquipmentUsed = input.EquipmentUsed,
            TopTracks = input.TopTracks
        };

        try
        {
            await djs.UpdateAsync(id, dto);
            return true;
        }
        catch (ArgumentException ex)
        {
            throw new GraphQLException(ex.Message);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to update DJ: {ex.Message}");
        }
    }

    public async Task<bool> DeleteDj(
        Guid id,
        [Service] IDJService djs,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        await djs.DeleteAsync(id);
        return true;
    }

    // DJ APPLICATION MUTATIONS
    public async Task<DJApplicationDto> SubmitDJApplication(
        CreateDJApplicationInput input,
        [Service] IDJApplicationService djApplicationService,
        [Service] IUserService userService,
        [Service] IEmailService emailService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAuthentication(httpContextAccessor);
        try
        {
            var dto = new CreateDJApplicationDto
            {
                UserId = input.UserId,
                StageName = input.StageName,
                Bio = input.Bio,
                Genre = input.Genre,
                YearsExperience = input.YearsExperience,
                Specialties = input.Specialties,
                InfluencedBy = input.InfluencedBy,
                EquipmentUsed = input.EquipmentUsed,
                SocialLinks = input.SocialLinks,
                ProfileImageUrl = input.ProfileImageUrl,
                CoverImageUrl = input.CoverImageUrl
            };

            var result = await djApplicationService.SubmitApplicationAsync(dto);

            // Send confirmation email to applicant
            var applicant = await userService.GetUserByIdAsync(input.UserId);
            if (applicant != null)
            {
                _ = emailService.SendDJApplicationSubmittedAsync(
                    applicant.Email, applicant.FullName, input.StageName);
            }

            // Notify admin
            var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "letsgoklubn@gmail.com";
            _ = emailService.SendAdminDJApplicationNotificationAsync(
                adminEmail, applicant?.FullName ?? "Unknown", input.StageName);

            return result;
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
    }

    public async Task<DJApplicationDto> ApproveDJApplication(
        Guid applicationId,
        string reviewedByAdminId,
        [Service] IDJApplicationService djApplicationService,
        [Service] IUserService userService,
        [Service] IEmailService emailService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        try
        {
            var dto = new UpdateApplicationStatusDto
            {
                ApplicationId = applicationId,
                Status = ApplicationStatus.Approved,
                ReviewedByAdminId = reviewedByAdminId
            };

            var result = await djApplicationService.ApproveApplicationAsync(dto);

            // Send approval email
            var applicant = await userService.GetUserByIdAsync(result.UserId);
            if (applicant != null)
            {
                _ = emailService.SendDJApplicationApprovedAsync(
                    applicant.Email, applicant.FullName, result.StageName);
            }

            return result;
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error approving DJ application {ApplicationId}", applicationId);
            throw new GraphQLException("An error occurred processing the application.");
        }
    }

    public async Task<DJApplicationDto> RejectDJApplication(
        Guid applicationId,
        string reviewedByAdminId,
        string? rejectionReason,
        [Service] IDJApplicationService djApplicationService,
        [Service] IUserService userService,
        [Service] IEmailService emailService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        try
        {
            var dto = new UpdateApplicationStatusDto
            {
                ApplicationId = applicationId,
                Status = ApplicationStatus.Rejected,
                ReviewedByAdminId = reviewedByAdminId,
                RejectionReason = rejectionReason
            };

            var result = await djApplicationService.RejectApplicationAsync(dto);

            // Send rejection email
            var applicant = await userService.GetUserByIdAsync(result.UserId);
            if (applicant != null)
            {
                _ = emailService.SendDJApplicationRejectedAsync(
                    applicant.Email, applicant.FullName, result.StageName, rejectionReason);
            }

            return result;
        }
        catch (InvalidOperationException ex)
        {
            throw new GraphQLException(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error rejecting DJ application {ApplicationId}", applicationId);
            throw new GraphQLException("An error occurred processing the application.");
        }
    }

    // ORGANIZER APPLICATION MUTATIONS
    public async Task<OrganizerApplicationDto> SubmitOrganizerApplication(
        CreateOrganizerApplicationInput input,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userId = RequireAuthentication(httpContextAccessor);
        var existing = await db.EventOrganizerApplications
            .Where(a => a.UserId == userId && a.Status == ApplicationStatus.Pending)
            .FirstOrDefaultAsync();
        if (existing != null)
            throw new GraphQLException("You already have a pending organizer application.");

        var app = new EventOrganizerApplication
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            OrganizationName = input.OrganizationName,
            Description = input.Description,
            Website = input.Website,
            SocialLinks = input.SocialLinks,
            Status = ApplicationStatus.Pending,
            SubmittedAt = DateTime.UtcNow
        };
        db.EventOrganizerApplications.Add(app);
        await db.SaveChangesAsync();
        return OrganizerApplicationDto.From(app);
    }

    public async Task<OrganizerApplicationDto> ApproveOrganizerApplication(
        Guid applicationId,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var adminId = RequireAdmin(httpContextAccessor);
        var app = await db.EventOrganizerApplications.FirstOrDefaultAsync(a => a.Id == applicationId);
        if (app == null) throw new GraphQLException("Application not found.");

        app.Status = ApplicationStatus.Approved;
        app.ReviewedAt = DateTime.UtcNow;
        app.ReviewedByAdminId = adminId;

        // Promote user to EventOrganizer role (3)
        var user = await db.ApplicationUsers.FirstOrDefaultAsync(u => u.Id == app.UserId);
        if (user != null) user.Role = 3;

        await db.SaveChangesAsync();
        return OrganizerApplicationDto.From(app);
    }

    public async Task<OrganizerApplicationDto> RejectOrganizerApplication(
        Guid applicationId,
        string? rejectionReason,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var adminId = RequireAdmin(httpContextAccessor);
        var app = await db.EventOrganizerApplications.FirstOrDefaultAsync(a => a.Id == applicationId);
        if (app == null) throw new GraphQLException("Application not found.");

        app.Status = ApplicationStatus.Rejected;
        app.ReviewedAt = DateTime.UtcNow;
        app.ReviewedByAdminId = adminId;
        app.RejectionReason = rejectionReason;

        await db.SaveChangesAsync();
        return OrganizerApplicationDto.From(app);
    }

    // GENRE MUTATIONS
    public async Task<Guid> CreateGenre(
        CreateGenreInput input,
        [Service] IGenreService genres,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        var dto = new CreateGenreDto { Name = input.Name };
        return await genres.CreateAsync(dto);
    }

    public async Task<bool> UpdateGenre(
        Guid id,
        UpdateGenreInput input,
        [Service] IGenreService genres,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        await genres.UpdateAsync(id, new UpdateGenreDto { Name = input.Name });
        return true;
    }

    // VENUE MUTATIONS
    public async Task<Guid> CreateVenue(
        CreateVenueInput input,
        [Service] IVenueService venues,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        if (string.IsNullOrWhiteSpace(input.Name))
            throw new GraphQLException("Venue name is required.");

        var dto = new CreateVenueDto
        {
            Name = input.Name,
            Description = input.Description,
            Address = input.Address,
            City = input.City,
            Country = input.Country,
            Latitude = input.Latitude,
            Longitude = input.Longitude,
            Capacity = input.Capacity,
            ContactEmail = input.ContactEmail,
            PhoneNumber = input.PhoneNumber,
            ImageUrl = input.ImageUrl,
            ImageUrls = input.ImageUrls
        };

        try
        {
            return await venues.CreateAsync(dto);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to create venue: {ex.Message}");
        }
    }

    public async Task<bool> UpdateVenue(
        Guid id,
        UpdateVenueInput input,
        [Service] IVenueService venues,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var dto = new UpdateVenueDto
        {
            Id = id,
            Name = input.Name,
            Description = input.Description,
            Address = input.Address,
            City = input.City,
            Country = input.Country,
            Latitude = input.Latitude,
            Longitude = input.Longitude,
            Capacity = input.Capacity,
            ContactEmail = input.ContactEmail,
            PhoneNumber = input.PhoneNumber,
            ImageUrl = input.ImageUrl,
            ImageUrls = input.ImageUrls
        };

        await venues.UpdateAsync(id, dto);
        return true;
    }

    public async Task<bool> DeleteVenue(
        Guid id,
        [Service] IVenueService venues,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        await venues.DeleteAsync(id);
        return true;
    }

    // CONTACT MESSAGE MUTATIONS
    public async Task<Guid> CreateContactMessage(
        CreateContactMessageInput input,
        [Service] IContactMessageService contactMessages,
        [Service] IUserService userService,
        [Service] IEmailService emailService)
    {
        var dto = new ContactMessageCreateDto
        {
            Message = input.Message,
            UserId = input.UserId
        };

        var result = await contactMessages.CreateAsync(dto);

        // Send emails - look up user for name/email
        var user = await userService.GetUserByIdAsync(input.UserId);
        var senderEmail = user?.Email ?? input.UserId; // UserId may be an email for non-logged-in users
        var senderName = user?.FullName ?? "Website Visitor";

        _ = emailService.SendContactConfirmationAsync(senderEmail, senderName);

        var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "letsgoklubn@gmail.com";
        _ = emailService.SendContactAdminNotificationAsync(adminEmail, senderName, senderEmail, input.Message);

        return result;
    }

    public async Task<bool> DeleteContactMessage(
        Guid id,
        [Service] IContactMessageService contactMessages,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        await contactMessages.DeleteAsync(id);
        return true;
    }

    // NEWSLETTER MUTATIONS
    public async Task<NewsletterDto> SubscribeNewsletter(
        CreateNewsletterInput input,
        [Service] INewsletterService newsletters,
        [Service] IEmailService emailService)
    {
        var dto = new CreateNewsletterDto
        {
            Email = input.Email,
            UserId = input.UserId
        };

        var result = await newsletters.SubscribeAsync(dto);

        _ = emailService.SendNewsletterWelcomeAsync(input.Email);

        return result;
    }

    public async Task<bool> UnsubscribeNewsletter(
        Guid id,
        [Service] INewsletterService newsletters)
    {
        return await newsletters.UnsubscribeAsync(id);
    }

    // DJ TOP 10 MUTATIONS
    public async Task<Guid> CreateDjTop10Entry(
        CreateDjTop10Input input,
        [Service] IDJTop10Service djTop10Service,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        await RequireDjProfileOwnerOrManager(input.DjId, httpContextAccessor, unitOfWork);
        var dto = new DJTop10CreateDto
        {
            DJId = input.DjId,
            SongId = input.SongId
        };

        return await djTop10Service.CreateAsync(dto);
    }

    public async Task<bool> DeleteDjTop10Entry(
        Guid id,
        [Service] IDJTop10Service djTop10Service,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        await RequireDjTop10OwnerOrManager(id, httpContextAccessor, unitOfWork);
        await djTop10Service.DeleteAsync(id);
        return true;
    }

    // SONG MUTATIONS
    public async Task<Guid> CreateSong(
        CreateSongInput input,
        [Service] ISongService songService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        var hasUrl = !string.IsNullOrWhiteSpace(input.SpotifyUrl) || !string.IsNullOrWhiteSpace(input.SoundCloudUrl);
        if (string.IsNullOrWhiteSpace(input.Title) && !hasUrl)
            throw new GraphQLException("Song title is required (or provide a URL).");
        if (string.IsNullOrWhiteSpace(input.Artist) && !hasUrl)
            throw new GraphQLException("Artist is required (or provide a URL).");

        var dto = new CreateSongDto
        {
            Title = input.Title,
            Artist = input.Artist,
            Album = input.Album,
            Genre = input.Genre,
            Duration = input.Duration,
            CoverImageUrl = input.CoverImageUrl,
            SpotifyUrl = input.SpotifyUrl,
            SoundCloudUrl = input.SoundCloudUrl
        };

        try
        {
            return await songService.AddSongAsync(dto);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to create song: {ex.Message}");
        }
    }

    // PLAYLIST MUTATIONS (Admin or owning DJ)
    private async Task RequirePlaylistOwnerOrAdmin(
        Guid playlistId,
        IPlaylistService playlistService,
        IHttpContextAccessor accessor,
        IUnitOfWork unitOfWork)
    {
        var userId = RequireAuthentication(accessor);
        var role = accessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role == "Admin" || role == "CoAdmin") return;

        var playlist = await playlistService.GetByIdAsync(playlistId);
        if (playlist == null) throw new GraphQLException("Playlist not found.");

        if (playlist.DjProfileId == null)
            throw new GraphQLException("Access denied. Only admins can modify admin-created playlists.");

        var djProfiles = await unitOfWork.DJProfiles.GetAllAsync();
        var ownerProfile = djProfiles.FirstOrDefault(d => d.Id == playlist.DjProfileId.Value);
        if (ownerProfile == null || ownerProfile.UserId != userId)
            throw new GraphQLException("Access denied. You can only modify your own playlists.");
    }

    public async Task<Guid> CreatePlaylist(
        CreatePlaylistInput input,
        [Service] IPlaylistService playlistService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        var userId = RequireAuthentication(httpContextAccessor);
        var role = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        if (string.IsNullOrWhiteSpace(input.Title))
            throw new GraphQLException("Playlist title is required.");

        Guid? djProfileId = input.DjProfileId;

        // If DJ (not admin/coadmin), verify they own the DJ profile
        if (role != "Admin" && role != "CoAdmin")
        {
            if (djProfileId == null)
                throw new GraphQLException("DJs must associate playlists with their profile.");

            var djProfiles = await unitOfWork.DJProfiles.GetAllAsync();
            var djProfile = djProfiles.FirstOrDefault(d => d.Id == djProfileId.Value);
            if (djProfile == null || djProfile.UserId != userId)
                throw new GraphQLException("Access denied. You can only create playlists for your own DJ profile.");
        }

        var dto = new CreatePlaylistDto
        {
            Title = input.Title,
            Description = input.Description,
            Genre = input.Genre,
            CoverImageUrl = input.CoverImageUrl,
            Curator = input.Curator,
            PlaylistUrl = input.PlaylistUrl,
            DjProfileId = djProfileId
        };

        return await playlistService.CreateAsync(dto);
    }

    public async Task<bool> UpdatePlaylist(
        Guid id,
        UpdatePlaylistInput input,
        [Service] IPlaylistService playlistService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        await RequirePlaylistOwnerOrAdmin(id, playlistService, httpContextAccessor, unitOfWork);
        var dto = new UpdatePlaylistDto
        {
            Title = input.Title,
            Description = input.Description,
            Genre = input.Genre,
            CoverImageUrl = input.CoverImageUrl,
            Curator = input.Curator,
            PlaylistUrl = input.PlaylistUrl
        };

        await playlistService.UpdateAsync(id, dto);
        return true;
    }

    public async Task<bool> DeletePlaylist(
        Guid id,
        [Service] IPlaylistService playlistService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        await RequirePlaylistOwnerOrAdmin(id, playlistService, httpContextAccessor, unitOfWork);
        await playlistService.DeleteAsync(id);
        return true;
    }

    public async Task<Guid> AddPlaylistSong(
        AddPlaylistSongInput input,
        [Service] IPlaylistService playlistService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        await RequirePlaylistOwnerOrAdmin(input.PlaylistId, playlistService, httpContextAccessor, unitOfWork);
        var dto = new AddPlaylistSongDto
        {
            PlaylistId = input.PlaylistId,
            SongId = input.SongId,
            Position = input.Position
        };

        return await playlistService.AddSongAsync(dto);
    }

    public async Task<bool> RemovePlaylistSong(
        Guid id,
        [Service] IPlaylistService playlistService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        // Need to look up the playlist from the song entry
        var entry = await unitOfWork.PlaylistSongs.GetByIdAsync(id);
        if (entry != null)
            await RequirePlaylistOwnerOrAdmin(entry.PlaylistId, playlistService, httpContextAccessor, unitOfWork);

        await playlistService.RemoveSongAsync(id);
        return true;
    }

    // DJ MIX MUTATIONS (Authenticated DJs or Admin)
    public async Task<Guid> CreateDjMix(
        CreateDJMixInput input,
        [Service] IDJMixService djMixService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        if (string.IsNullOrWhiteSpace(input.Title))
            throw new GraphQLException("Mix title is required.");
        if (string.IsNullOrWhiteSpace(input.MixUrl))
            throw new GraphQLException("Mix URL is required.");

        var role = GetCurrentRole(httpContextAccessor);
        if (role == "DJ")
        {
            if (!input.DjProfileId.HasValue)
                throw new GraphQLException("DJs must associate mixes with their own DJ profile.");

            await RequireDjProfileOwnerOrManager(input.DjProfileId.Value, httpContextAccessor, unitOfWork);
        }

        var dto = new CreateDJMixDto
        {
            Title = input.Title,
            Description = input.Description,
            MixUrl = input.MixUrl,
            ThumbnailUrl = input.ThumbnailUrl,
            Genre = input.Genre,
            MixType = input.MixType,
            DjProfileId = input.DjProfileId
        };

        return await djMixService.CreateAsync(dto);
    }

    public async Task<bool> UpdateDjMix(
        Guid id,
        UpdateDJMixInput input,
        [Service] IDJMixService djMixService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        var role = GetCurrentRole(httpContextAccessor);
        Guid? effectiveDjProfileId = input.DjProfileId;

        if (role == "DJ")
        {
            await RequireDjMixOwnerOrManager(id, httpContextAccessor, unitOfWork);
            if (!effectiveDjProfileId.HasValue)
            {
                var existingMix = await unitOfWork.DJMixes.GetByIdAsync(id);
                effectiveDjProfileId = existingMix?.DJProfileId;
            }

            if (!effectiveDjProfileId.HasValue)
                throw new GraphQLException("DJs must keep mixes associated with their own DJ profile.");

            await RequireDjProfileOwnerOrManager(effectiveDjProfileId.Value, httpContextAccessor, unitOfWork);
        }

        var dto = new CreateDJMixDto
        {
            Title = input.Title,
            Description = input.Description,
            MixUrl = input.MixUrl,
            ThumbnailUrl = input.ThumbnailUrl,
            Genre = input.Genre,
            MixType = input.MixType,
            DjProfileId = effectiveDjProfileId
        };

        await djMixService.UpdateAsync(id, dto);
        return true;
    }

    public async Task<bool> DeleteDjMix(
        Guid id,
        [Service] IDJMixService djMixService,
        [Service] IHttpContextAccessor httpContextAccessor,
        [Service] IUnitOfWork unitOfWork)
    {
        RequireRole(httpContextAccessor, "DJ", "Admin", "CoAdmin");
        await RequireDjMixOwnerOrManager(id, httpContextAccessor, unitOfWork);
        await djMixService.DeleteAsync(id);
        return true;
    }

    // SITE SETTINGS MUTATIONS
    public async Task<SiteSettingsDto> UpdateSiteSettings(
        UpdateSiteSettingsInput input,
        [Service] ISiteSettingsService siteSettingsService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        try
        {
        var dto = new UpdateSiteSettingsDto
        {
            Id = input.Id,
            SiteName = input.SiteName,
            Tagline = input.Tagline,
            LogoUrl = input.LogoUrl,
            FaviconUrl = input.FaviconUrl,
            PrimaryColor = input.PrimaryColor,
            SecondaryColor = input.SecondaryColor,
            AccentColor = input.AccentColor,
            HeroTitle = input.HeroTitle,
            HeroSubtitle = input.HeroSubtitle,
            HeroCtaText = input.HeroCtaText,
            HeroCtaLink = input.HeroCtaLink,
            HeroBackgroundImageUrl = input.HeroBackgroundImageUrl,
            HeroBackgroundVideoUrl = input.HeroBackgroundVideoUrl,
            HeroOverlayOpacity = input.HeroOverlayOpacity,
            HeroGenres = input.HeroGenres,
            HeroLocation = input.HeroLocation,
            HeroVibes = input.HeroVibes,
            BrandHeadline = input.BrandHeadline,
            BrandNarrative = input.BrandNarrative,
            EventsHeading = input.EventsHeading,
            EventsTagline = input.EventsTagline,
            CultureHeading = input.CultureHeading,
            ConceptHeading = input.ConceptHeading,
            LineupHeading = input.LineupHeading,
            GalleryVideoUrl = input.GalleryVideoUrl,
            ContactEmail = input.ContactEmail,
            ContactPhone = input.ContactPhone,
            ContactAddress = input.ContactAddress,
            FacebookUrl = input.FacebookUrl,
            InstagramUrl = input.InstagramUrl,
            TwitterUrl = input.TwitterUrl,
            YouTubeUrl = input.YouTubeUrl,
            TikTokUrl = input.TikTokUrl,
            SoundCloudUrl = input.SoundCloudUrl,
            DefaultEventImageUrl = input.DefaultEventImageUrl,
            DefaultDjImageUrl = input.DefaultDjImageUrl,
            DefaultVenueImageUrl = input.DefaultVenueImageUrl,
            EnableNewsletter = input.EnableNewsletter,
            EnableNotifications = input.EnableNotifications,
            EnableReviews = input.EnableReviews,
            EnableGamification = input.EnableGamification,
            EnableSubscriptions = input.EnableSubscriptions,
            MetaDescription = input.MetaDescription,
            MetaKeywords = input.MetaKeywords,
            FooterText = input.FooterText,
            CopyrightText = input.CopyrightText
        };

        return await siteSettingsService.UpdateAsync(dto);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to save settings: {ex.Message}");
        }
    }

    // GALLERY MEDIA MUTATIONS
    public async Task<Guid> CreateGalleryMedia(
        CreateGalleryMediaInput input,
        [Service] IGalleryMediaService galleryMediaService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new GraphQLException("User must be authenticated to upload media");
        }

        var dto = new CreateGalleryMediaDto
        {
            Title = input.Title,
            Description = input.Description,
            MediaUrl = input.MediaUrl,
            MediaType = input.MediaType,
            ThumbnailUrl = input.ThumbnailUrl,
            EventId = input.EventId,
            Tags = input.Tags
        };

        try
        {
            return await galleryMediaService.CreateAsync(dto, userIdClaim);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to create gallery media: {ex.Message}");
        }
    }

    public async Task<bool> UpdateGalleryMedia(
        Guid id,
        UpdateGalleryMediaInput input,
        [Service] IGalleryMediaService galleryMediaService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var dto = new UpdateGalleryMediaDto
        {
            Title = input.Title,
            Description = input.Description,
            IsApproved = input.IsApproved,
            IsFeatured = input.IsFeatured,
            Tags = input.Tags
        };

        return await galleryMediaService.UpdateAsync(id, dto);
    }

    public async Task<bool> DeleteGalleryMedia(
        Guid id,
        [Service] IGalleryMediaService galleryMediaService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        return await galleryMediaService.DeleteAsync(id);
    }

    public async Task<bool> LikeGalleryMedia(
        Guid id,
        [Service] IGalleryMediaService galleryMediaService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new GraphQLException("User must be authenticated to like media");
        }

        return await galleryMediaService.ToggleLikeAsync(id, userIdClaim);
    }

    // FOLLOW MUTATIONS
    public async Task<bool> FollowDj(
        FollowDjInput input,
        [Service] IFollowService followService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAuthentication(httpContextAccessor);
        await followService.FollowDjAsync(input.UserId, input.DjId);
        return true;
    }

    public async Task<bool> UnfollowDj(
        FollowDjInput input,
        [Service] IFollowService followService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAuthentication(httpContextAccessor);
        await followService.UnfollowDjAsync(input.UserId, input.DjId);
        return true;
    }

    // ========== TICKET MUTATIONS ==========
    // P0-T3 IDENTITY RULE: the acting buyer's id is ALWAYS derived from the JWT
    // principal (RequireAuthentication), never from input.UserId. input.UserId is
    // only honoured where an admin acts on behalf of another user, and only after
    // RequireAdmin has gated the call (see PurchaseTicket below). A forged userId in
    // a mutation variable therefore has no effect for non-admin callers.
    // Public, paid ticket issuance flows through the P5/P6 createTicketOrder + Vipps
    // capture-webhook path — NOT through this mutation.
    public async Task<TicketDto> PurchaseTicket(
        PurchaseTicketInput input,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        // P0-T2: admin-only. Survives solely as an admin comp-ticket tool; the free
        // public issuance bypass is closed. Public buyers use the paid P5/P6 path.
        RequireAdmin(httpContextAccessor);

        if (string.IsNullOrWhiteSpace(input.Email))
            throw new GraphQLException("Email is required to purchase a ticket.");
        if (!input.TermsAccepted)
            throw new GraphQLException("You must accept the terms to purchase a ticket.");
        if (string.IsNullOrWhiteSpace(input.UserId))
            throw new GraphQLException("UserId is required: specify the user this comp ticket is issued to.");

        // Admin-only path: input.UserId is the target recipient (admin acts on behalf of).
        var dto = new CreateTicketDto
        {
            EventId = input.EventId,
            UserId = input.UserId,
            TermsAccepted = input.TermsAccepted,
            Email = input.Email
        };

        try
        {
            return await ticketService.CreateTicketAsync(dto);
        }
        catch (Exception ex) when (ex is not GraphQLException)
        {
            throw new GraphQLException($"Failed to purchase ticket: {ex.Message}");
        }
    }

    public async Task<bool> CheckInTicket(
        Guid ticketId,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireRole(httpContextAccessor, "Admin", "CoAdmin", "DJ");
        return await ticketService.CheckInTicketAsync(ticketId);
    }

    public async Task<TicketDto?> CancelTicket(
        CancelTicketInput input,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAuthentication(httpContextAccessor);
        var dto = new CancelTicketDto
        {
            TicketId = input.TicketId,
            Reason = input.Reason
        };
        return await ticketService.CancelTicketAsync(dto);
    }

    public async Task<TicketDto?> RefundTicket(
        RefundTicketInput input,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        var dto = new RefundTicketDto
        {
            TicketId = input.TicketId,
            PaymentMethod = input.PaymentMethod
        };
        return await ticketService.RefundTicketAsync(dto);
    }

    public async Task<TicketDto?> TransferTicket(
        TransferTicketInput input,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAuthentication(httpContextAccessor);
        var dto = new TransferTicketDto
        {
            TicketId = input.TicketId,
            ToUserId = input.ToUserId,
            ToEmail = input.ToEmail
        };
        return await ticketService.TransferTicketAsync(dto);
    }

    public async Task<bool> InvalidateTicket(
        Guid ticketId,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        return await ticketService.InvalidateTicketAsync(ticketId);
    }

    public async Task<bool> DeleteTicket(
        Guid ticketId,
        [Service] ITicketService ticketService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);
        await ticketService.DeleteAsync(ticketId);
        return true;
    }

    // ========== TICKET TYPE (TIER) MUTATIONS — admin CRUD (P1-T3) ==========
    // Price is the source of truth for checkout; money is always minor units (øre).
    public async Task<TicketTypeDto> CreateTicketType(
        CreateTicketTypeInput input,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);

        var eventExists = await db.Events.AnyAsync(e => e.Id == input.EventId);
        if (!eventExists)
            throw new GraphQLException("Event not found.");
        if (string.IsNullOrWhiteSpace(input.Name))
            throw new GraphQLException("Ticket type name is required.");
        if (input.Capacity < 0)
            throw new GraphQLException("Capacity cannot be negative.");
        if (input.AdmitCount < 1)
            throw new GraphQLException("AdmitCount must be at least 1.");
        if (input.MinPerOrder < 1 || input.MaxPerOrder < input.MinPerOrder)
            throw new GraphQLException("Invalid per-order limits.");

        var tt = new TicketType
        {
            Id = Guid.NewGuid(),
            EventId = input.EventId,
            Name = input.Name,
            Description = input.Description,
            PriceMinor = input.PriceMinor,
            VATRate = input.VATRate ?? 0.12m,
            Currency = string.IsNullOrWhiteSpace(input.Currency) ? "NOK" : input.Currency!,
            Capacity = input.Capacity,
            AdmitCount = input.AdmitCount,
            MinPerOrder = input.MinPerOrder,
            MaxPerOrder = input.MaxPerOrder,
            SalesStart = input.SalesStart,
            SalesEnd = input.SalesEnd,
            Status = input.Status ?? TicketTypeStatus.Draft,
            SortOrder = input.SortOrder
        };

        db.TicketTypes.Add(tt);
        await db.SaveChangesAsync();
        return TicketTypeMapper.ToDto(tt);
    }

    public async Task<TicketTypeDto> UpdateTicketType(
        UpdateTicketTypeInput input,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);

        var tt = await db.TicketTypes.FirstOrDefaultAsync(x => x.Id == input.Id);
        if (tt == null)
            throw new GraphQLException("Ticket type not found.");

        if (input.Name != null) tt.Name = input.Name;
        if (input.Description != null) tt.Description = input.Description;
        if (input.PriceMinor.HasValue) tt.PriceMinor = input.PriceMinor.Value;
        if (input.VATRate.HasValue) tt.VATRate = input.VATRate.Value;
        if (!string.IsNullOrWhiteSpace(input.Currency)) tt.Currency = input.Currency!;
        if (input.Capacity.HasValue)
        {
            if (input.Capacity.Value < tt.QuantitySold + tt.QuantityHeld)
                throw new GraphQLException("Capacity cannot be set below already sold + held quantity.");
            tt.Capacity = input.Capacity.Value;
        }
        if (input.AdmitCount.HasValue)
        {
            if (input.AdmitCount.Value < 1)
                throw new GraphQLException("AdmitCount must be at least 1.");
            tt.AdmitCount = input.AdmitCount.Value;
        }
        if (input.MinPerOrder.HasValue) tt.MinPerOrder = input.MinPerOrder.Value;
        if (input.MaxPerOrder.HasValue) tt.MaxPerOrder = input.MaxPerOrder.Value;
        if (tt.MaxPerOrder < tt.MinPerOrder)
            throw new GraphQLException("MaxPerOrder cannot be less than MinPerOrder.");
        if (input.SalesStart.HasValue) tt.SalesStart = input.SalesStart;
        if (input.SalesEnd.HasValue) tt.SalesEnd = input.SalesEnd;
        if (input.Status.HasValue) tt.Status = input.Status.Value;
        if (input.SortOrder.HasValue) tt.SortOrder = input.SortOrder.Value;

        await db.SaveChangesAsync();
        return TicketTypeMapper.ToDto(tt);
    }

    public async Task<bool> DeleteTicketType(
        Guid id,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireCoAdmin(httpContextAccessor);

        var tt = await db.TicketTypes.FirstOrDefaultAsync(x => x.Id == id);
        if (tt == null)
            throw new GraphQLException("Ticket type not found.");
        if (tt.QuantitySold > 0)
            throw new GraphQLException("Cannot delete a ticket type that has sold tickets.");

        db.TicketTypes.Remove(tt);
        await db.SaveChangesAsync();
        return true;
    }

    // DJ REVIEW MUTATIONS
    public async Task<Guid> CreateDjReview(
        CreateDJReviewInput input,
        [Service] IUnitOfWork unitOfWork,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var userIdClaim = httpContextAccessor.HttpContext?.User.FindFirst("userId")?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new GraphQLException("User must be authenticated to submit a review");
        }

        var review = new DJReview
        {
            Id = Guid.NewGuid(),
            DJId = input.DJId,
            UserId = userIdClaim,
            Rating = Math.Clamp(input.Rating, 1, 5),
            Comment = input.Comment,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await unitOfWork.DJReviews.AddAsync(review);
        await unitOfWork.SaveChangesAsync();
        return review.Id;
    }

    // USER PROFILE MUTATIONS
    public async Task<bool> UpdateUserProfile(
        UpdateUserProfileInput input,
        [Service] IUserService userService,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var callerUserId = RequireAuthentication(httpContextAccessor);
        var role = GetCurrentRole(httpContextAccessor);
        if (role != "Admin" && role != "CoAdmin" && callerUserId != input.Id)
            throw new GraphQLException("Access denied. You can only update your own user profile.");

        var dto = new UpdateUserDto
        {
            Id = input.Id,
            FullName = input.FullName,
            Email = input.Email,
            ProfilePictureUrl = input.ProfilePictureUrl
        };
        await userService.UpdateUserAsync(dto);
        return true;
    }

    public async Task<bool> UpdateUserRole(
        string userId,
        int role,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        if (role < 0 || role > 4)
            throw new GraphQLException("Invalid role value.");
        var user = await db.ApplicationUsers.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new GraphQLException("User not found.");
        user.Role = role;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteUser(
        string userId,
        [Service] AppDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        RequireAdmin(httpContextAccessor);
        var user = await db.ApplicationUsers.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new GraphQLException("User not found.");
        db.ApplicationUsers.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }
}

public class UpdateUserProfileInput
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
}

public class RegisterInput
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginInput
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ResetPasswordInput
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class CreateEventInput
{
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public Guid VenueId { get; set; }
    public decimal Price { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<Guid>? GenreIds { get; set; }
    public List<Guid>? DjIds { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? TicketingUrl { get; set; }
}

public class UpdateEventInput
{
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public Guid VenueId { get; set; }
    public decimal Price { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<Guid>? GenreIds { get; set; }
    public List<Guid>? DjIds { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? TicketingUrl { get; set; }
}

public class CreateDjInput
{
    public string StageName { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string Bio { get; set; } = string.Empty;
    public string? LongBio { get; set; }
    public string? Tagline { get; set; }
    public string Genre { get; set; } = string.Empty;
    public string SocialLinks { get; set; } = string.Empty;
    public string ProfilePictureUrl { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? Specialties { get; set; }
    public string? Achievements { get; set; }
    public int? YearsExperience { get; set; }
    public string? InfluencedBy { get; set; }
    public string? EquipmentUsed { get; set; }
    public string UserId { get; set; } = string.Empty;
    public List<string>? TopTracks { get; set; }
}

public class UpdateDjInput
{
    public string StageName { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Bio { get; set; } = string.Empty;
    public string? LongBio { get; set; }
    public string? Tagline { get; set; }
    public string Genre { get; set; } = string.Empty;
    public string SocialLinks { get; set; } = string.Empty;
    public string ProfilePictureUrl { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? Specialties { get; set; }
    public string? Achievements { get; set; }
    public int? YearsExperience { get; set; }
    public string? InfluencedBy { get; set; }
    public string? EquipmentUsed { get; set; }
    public List<string>? TopTracks { get; set; }
}

public class CreateDJApplicationInput
{
    public string UserId { get; set; } = string.Empty;
    public string StageName { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public string Genre { get; set; } = string.Empty;
    public int YearsExperience { get; set; }
    public string? Specialties { get; set; }
    public string? InfluencedBy { get; set; }
    public string? EquipmentUsed { get; set; }
    public string? SocialLinks { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? CoverImageUrl { get; set; }
}

public class CreateGenreInput
{
    public string Name { get; set; } = string.Empty;
}

public class UpdateGenreInput
{
    public string Name { get; set; } = string.Empty;
}

public class CreateVenueInput
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int Capacity { get; set; }
    public string ContactEmail { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? ImageUrl { get; set; }
    public List<string>? ImageUrls { get; set; }
}

public class UpdateVenueInput : CreateVenueInput
{
}

public class CreateContactMessageInput
{
    public string UserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class CreateNewsletterInput
{
    public string Email { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
}

public class CreateDjTop10Input
{
    public Guid DjId { get; set; }
    public Guid SongId { get; set; }
}

public class FollowDjInput
{
    public Guid DjId { get; set; }
    public string UserId { get; set; } = string.Empty;
}

public class PurchaseTicketInput
{
    public Guid EventId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public bool TermsAccepted { get; set; }
    public string Email { get; set; } = string.Empty;
}

public class CancelTicketInput
{
    public Guid TicketId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class RefundTicketInput
{
    public Guid TicketId { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
}

public class TransferTicketInput
{
    public Guid TicketId { get; set; }
    public string ToUserId { get; set; } = string.Empty;
    public string ToEmail { get; set; } = string.Empty;
}

// ===== Ticket type (tier) admin CRUD inputs (P1-T3) — money in minor units (øre) =====
public class CreateTicketTypeInput
{
    public Guid EventId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long PriceMinor { get; set; }
    public decimal? VATRate { get; set; }
    public string? Currency { get; set; }
    public int Capacity { get; set; }
    public int AdmitCount { get; set; } = 1;
    public int MinPerOrder { get; set; } = 1;
    public int MaxPerOrder { get; set; } = 10;
    public DateTime? SalesStart { get; set; }
    public DateTime? SalesEnd { get; set; }
    public TicketTypeStatus? Status { get; set; }
    public int SortOrder { get; set; }
}

// All fields optional: only supplied fields are patched.
public class UpdateTicketTypeInput
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public long? PriceMinor { get; set; }
    public decimal? VATRate { get; set; }
    public string? Currency { get; set; }
    public int? Capacity { get; set; }
    public int? AdmitCount { get; set; }
    public int? MinPerOrder { get; set; }
    public int? MaxPerOrder { get; set; }
    public DateTime? SalesStart { get; set; }
    public DateTime? SalesEnd { get; set; }
    public TicketTypeStatus? Status { get; set; }
    public int? SortOrder { get; set; }
}

internal static class TicketTypeMapper
{
    public static TicketTypeDto ToDto(TicketType tt) => new()
    {
        Id = tt.Id,
        EventId = tt.EventId,
        Name = tt.Name,
        Description = tt.Description,
        PriceMinor = tt.PriceMinor,
        VATRate = tt.VATRate,
        Currency = tt.Currency,
        Capacity = tt.Capacity,
        QuantitySold = tt.QuantitySold,
        QuantityHeld = tt.QuantityHeld,
        Available = tt.Capacity - tt.QuantitySold - tt.QuantityHeld,
        AdmitCount = tt.AdmitCount,
        MinPerOrder = tt.MinPerOrder,
        MaxPerOrder = tt.MaxPerOrder,
        SalesStart = tt.SalesStart,
        SalesEnd = tt.SalesEnd,
        Status = tt.Status.ToString(),
        SortOrder = tt.SortOrder
    };
}

public class CreateSongInput
{
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string? Album { get; set; }
    public string? Genre { get; set; }
    public int Duration { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? SpotifyUrl { get; set; }
    public string? SoundCloudUrl { get; set; }
}

public class UpdateSiteSettingsInput
{
    public Guid Id { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string LogoUrl { get; set; } = string.Empty;
    public string FaviconUrl { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = string.Empty;
    public string SecondaryColor { get; set; } = string.Empty;
    public string AccentColor { get; set; } = string.Empty;
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public string HeroCtaText { get; set; } = string.Empty;
    public string HeroCtaLink { get; set; } = string.Empty;
    public string HeroBackgroundImageUrl { get; set; } = string.Empty;
    public string HeroBackgroundVideoUrl { get; set; } = string.Empty;
    public double HeroOverlayOpacity { get; set; }
    public string HeroGenres { get; set; } = string.Empty;
    public string HeroLocation { get; set; } = string.Empty;
    public string HeroVibes { get; set; } = string.Empty;
    public string BrandHeadline { get; set; } = string.Empty;
    public string BrandNarrative { get; set; } = string.Empty;
    public string EventsHeading { get; set; } = string.Empty;
    public string EventsTagline { get; set; } = string.Empty;
    public string CultureHeading { get; set; } = string.Empty;
    public string ConceptHeading { get; set; } = string.Empty;
    public string LineupHeading { get; set; } = string.Empty;
    public string GalleryVideoUrl { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string ContactAddress { get; set; } = string.Empty;
    public string FacebookUrl { get; set; } = string.Empty;
    public string InstagramUrl { get; set; } = string.Empty;
    public string TwitterUrl { get; set; } = string.Empty;
    public string YouTubeUrl { get; set; } = string.Empty;
    public string TikTokUrl { get; set; } = string.Empty;
    public string SoundCloudUrl { get; set; } = string.Empty;
    public string DefaultEventImageUrl { get; set; } = string.Empty;
    public string DefaultDjImageUrl { get; set; } = string.Empty;
    public string DefaultVenueImageUrl { get; set; } = string.Empty;
    public bool EnableNewsletter { get; set; }
    public bool EnableNotifications { get; set; }
    public bool EnableReviews { get; set; }
    public bool EnableGamification { get; set; }
    public bool EnableSubscriptions { get; set; }
    public string MetaDescription { get; set; } = string.Empty;
    public string MetaKeywords { get; set; } = string.Empty;
    public string FooterText { get; set; } = string.Empty;
    public string CopyrightText { get; set; } = string.Empty;
}

public class CreateGalleryMediaInput
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MediaUrl { get; set; } = string.Empty;
    public string MediaType { get; set; } = "image";
    public string? ThumbnailUrl { get; set; }
    public Guid? EventId { get; set; }
    public string? Tags { get; set; }
}

public class UpdateGalleryMediaInput
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? IsApproved { get; set; }
    public bool? IsFeatured { get; set; }
    public string? Tags { get; set; }
}

public class CreateDJReviewInput
{
    public Guid DJId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

public class DJReviewDto
{
    public Guid Id { get; set; }
    public Guid DJId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreatePlaylistInput
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Genre { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? Curator { get; set; }
    public string? PlaylistUrl { get; set; }
    public Guid? DjProfileId { get; set; }
}

public class UpdatePlaylistInput
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Genre { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? Curator { get; set; }
    public string? PlaylistUrl { get; set; }
}

public class AddPlaylistSongInput
{
    public Guid PlaylistId { get; set; }
    public Guid SongId { get; set; }
    public int Position { get; set; }
}

public class CreateDJMixInput
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MixUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Genre { get; set; }
    public string? MixType { get; set; }
    public Guid? DjProfileId { get; set; }
}

public class UpdateDJMixInput
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string MixUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Genre { get; set; }
    public string? MixType { get; set; }
    public Guid? DjProfileId { get; set; }
}

public class AdminUserDto
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // P0-T1: PasswordHash removed so it can never be selected into the GraphQL schema.
    public int Role { get; set; }
    public bool IsEmailVerified { get; set; }
    public string? Provider { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class CreateOrganizerApplicationInput
{
    public string UserId { get; set; } = string.Empty;
    public string OrganizationName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Website { get; set; }
    public string? SocialLinks { get; set; }
}

public class OrganizerApplicationDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string OrganizationName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Website { get; set; }
    public string? SocialLinks { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedByAdminId { get; set; }
    public string? RejectionReason { get; set; }

    public static OrganizerApplicationDto From(DJDiP.Domain.Models.EventOrganizerApplication app) => new()
    {
        Id = app.Id,
        UserId = app.UserId,
        OrganizationName = app.OrganizationName,
        Description = app.Description,
        Website = app.Website,
        SocialLinks = app.SocialLinks,
        Status = app.Status.ToString(),
        SubmittedAt = app.SubmittedAt,
        ReviewedAt = app.ReviewedAt,
        ReviewedByAdminId = app.ReviewedByAdminId,
        RejectionReason = app.RejectionReason
    };
}

