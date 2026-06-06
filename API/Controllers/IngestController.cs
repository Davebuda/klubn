using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using DJDiP.Domain.Models;
using DJDiP.Infrastructure.Persistance;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DJDiP.API.Controllers;

// n8n Social Sync ingest endpoints. Auth is a shared x-n8n-secret header (NOT JWT).
[ApiController]
[Route("api/ingest")]
public class IngestController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public IngestController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    private bool SecretValid()
    {
        var expected = _config["N8N_SECRET"];
        if (string.IsNullOrEmpty(expected)) return false;
        var provided = Request.Headers["x-n8n-secret"].ToString();
        if (string.IsNullOrEmpty(provided)) return false;
        var a = Encoding.UTF8.GetBytes(provided);
        var b = Encoding.UTF8.GetBytes(expected);
        if (a.Length != b.Length) return false;
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    public class VenueDto
    {
        public string? name { get; set; }
        public string? address { get; set; }
        public string? city { get; set; }
        public string? country { get; set; }
    }

    public class EventIngestDto
    {
        public string? title { get; set; }
        public string? date { get; set; }
        public VenueDto? venue { get; set; }
        public decimal? price { get; set; }
        public string? description { get; set; }
        public string? imageUrl { get; set; }
        public string? ticketingUrl { get; set; }
        public string? status { get; set; }
        [JsonPropertyName("source_post_id")] public string? SourcePostId { get; set; }
        [JsonPropertyName("source_platform")] public string? SourcePlatform { get; set; }
    }

    public class MixIngestDto
    {
        public string? title { get; set; }
        public string? url { get; set; }
        public string? mixUrl { get; set; }
        public string? source { get; set; }
        public string? mixType { get; set; }
        public string? thumbnailUrl { get; set; }
        public string? description { get; set; }
        public string? duration { get; set; }
        public string? publishedAt { get; set; }
        [JsonPropertyName("source_post_id")] public string? SourcePostId { get; set; }
        [JsonPropertyName("source_platform")] public string? SourcePlatform { get; set; }
    }

    public class GalleryIngestDto
    {
        public string? title { get; set; }
        public string? mediaUrl { get; set; }
        public string? mediaType { get; set; } // "image" or "video", default "image"
        public string? thumbnailUrl { get; set; }
        public string? description { get; set; }
        [JsonPropertyName("source_post_id")] public string? SourcePostId { get; set; }
        [JsonPropertyName("source_platform")] public string? SourcePlatform { get; set; }
    }

    [HttpPost("events")]
    public async Task<IActionResult> IngestEvent([FromBody] EventIngestDto body)
    {
        if (!SecretValid()) return Unauthorized(new { error = "Unauthorized" });
        if (body == null || string.IsNullOrWhiteSpace(body.title) || string.IsNullOrWhiteSpace(body.SourcePostId))
            return BadRequest(new { error = "title and source_post_id are required" });

        if (await _db.Events.AnyAsync(e => e.SourcePostId == body.SourcePostId))
            return Ok(new { created = false });

        var venueName = body.venue?.name?.Trim();
        if (string.IsNullOrWhiteSpace(venueName)) venueName = "Unknown Venue";
        var venue = await _db.Venues.FirstOrDefaultAsync(v => v.Name == venueName);
        if (venue == null)
        {
            venue = new Venue
            {
                Id = Guid.NewGuid(),
                Name = venueName,
                Description = string.Empty,
                Address = body.venue?.address ?? string.Empty,
                City = body.venue?.city ?? "Oslo",
                Country = body.venue?.country ?? "Norway",
                ContactEmail = string.Empty,
            };
            await _db.Venues.AddAsync(venue);
        }

        var date = DateTime.TryParse(body.date, out var d) ? d.ToUniversalTime() : DateTime.UtcNow;

        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Title = body.title!,
            Date = date,
            VenueId = venue.Id,
            Price = body.price ?? 0m,
            Description = body.description ?? string.Empty,
            ImageUrl = body.imageUrl,
            TicketingUrl = body.ticketingUrl,
            Status = string.IsNullOrWhiteSpace(body.status) ? "Published" : body.status!,
            SourcePostId = body.SourcePostId,
            SourcePlatform = body.SourcePlatform,
        };
        try
        {
            await _db.Events.AddAsync(ev);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Ok(new { created = false }); // unique-index race on SourcePostId
        }
        return Created($"/api/ingest/events/{ev.Id}", new { created = true, id = ev.Id });
    }

    [HttpPost("mixes")]
    public async Task<IActionResult> IngestMix([FromBody] MixIngestDto body)
    {
        if (!SecretValid()) return Unauthorized(new { error = "Unauthorized" });
        if (body == null || string.IsNullOrWhiteSpace(body.title) || string.IsNullOrWhiteSpace(body.SourcePostId))
            return BadRequest(new { error = "title and source_post_id are required" });

        if (await _db.DJMixes.AnyAsync(m => m.SourcePostId == body.SourcePostId))
            return Ok(new { created = false });

        var mixUrl = !string.IsNullOrWhiteSpace(body.mixUrl) ? body.mixUrl! : (body.url ?? string.Empty);
        var mix = new DJMix
        {
            Id = Guid.NewGuid(),
            Title = body.title!,
            Description = body.description,
            MixUrl = mixUrl,
            ThumbnailUrl = body.thumbnailUrl,
            MixType = body.mixType ?? body.source,
            Source = body.source,
            Duration = body.duration,
            SourcePostId = body.SourcePostId,
            SourcePlatform = body.SourcePlatform,
            CreatedAt = DateTime.UtcNow,
        };
        try
        {
            await _db.DJMixes.AddAsync(mix);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Ok(new { created = false });
        }
        return Created($"/api/ingest/mixes/{mix.Id}", new { created = true, id = mix.Id });
    }

    [HttpPost("gallery")]
    public async Task<IActionResult> IngestGallery([FromBody] GalleryIngestDto body)
    {
        if (!SecretValid()) return Unauthorized(new { error = "Unauthorized" });
        if (body == null || string.IsNullOrWhiteSpace(body.mediaUrl) || string.IsNullOrWhiteSpace(body.SourcePostId))
            return BadRequest(new { error = "mediaUrl and source_post_id are required" });

        if (await _db.GalleryMedia.AnyAsync(g => g.SourcePostId == body.SourcePostId))
            return Ok(new { created = false });

        var media = new GalleryMedia
        {
            Id = Guid.NewGuid(),
            Title = body.title ?? string.Empty,
            Description = body.description,
            MediaUrl = body.mediaUrl!,
            MediaType = string.IsNullOrWhiteSpace(body.mediaType) ? "image" : body.mediaType!,
            ThumbnailUrl = body.thumbnailUrl,
            IsApproved = false, // stays out of the public approvedOnly:true query until an admin approves
            SourcePostId = body.SourcePostId,
            SourcePlatform = body.SourcePlatform,
            UploadedAt = DateTime.UtcNow,
        };
        try
        {
            await _db.GalleryMedia.AddAsync(media);
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Ok(new { created = false }); // unique-index race on SourcePostId
        }
        return Created($"/api/ingest/gallery/{media.Id}", new { created = true, id = media.Id });
    }
}
