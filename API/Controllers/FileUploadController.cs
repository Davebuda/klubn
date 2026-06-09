using DJDiP.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace DJDiP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FileUploadController : ControllerBase
{
    private readonly IFileUploadService _fileUploadService;

    public FileUploadController(IFileUploadService fileUploadService)
    {
        _fileUploadService = fileUploadService;
    }

    [HttpPost("image")]
    [Authorize] // Allow any authenticated user
    public async Task<IActionResult> UploadImage([FromForm] IFormFile file, [FromForm] string? folder = null)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file uploaded" });
            }

            if (file.Length > 5 * 1024 * 1024) // 5MB limit
            {
                return BadRequest(new { error = "File size exceeds 5MB limit" });
            }

            if (!_fileUploadService.IsValidImageFile(file.FileName))
            {
                return BadRequest(new { error = "Invalid file type. Only images are allowed (jpg, jpeg, png, gif, webp)" });
            }

            using var stream = file.OpenReadStream();
            var imageUrl = await _fileUploadService.UploadImageAsync(stream, file.FileName, folder);

            return Ok(new { url = imageUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("media")]
    [Authorize]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50MB
    public async Task<IActionResult> UploadMedia([FromForm] IFormFile file, [FromForm] string? folder = null)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file uploaded" });
            }

            if (file.Length > 50 * 1024 * 1024)
            {
                return BadRequest(new { error = "File size exceeds 50MB limit" });
            }

            if (!_fileUploadService.IsValidMediaFile(file.FileName))
            {
                return BadRequest(new { error = "Invalid file type. Allowed: jpg, jpeg, png, gif, webp, mp4, webm, mov, avi, mkv" });
            }

            using var stream = file.OpenReadStream();
            var mediaUrl = await _fileUploadService.UploadMediaAsync(stream, file.FileName, folder);

            return Ok(new { url = mediaUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("image")]
    [Authorize] // Allow any authenticated user
    public async Task<IActionResult> DeleteImage([FromQuery] string imageUrl)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                return BadRequest(new { error = "Image URL is required" });
            }

            var deleted = await _fileUploadService.DeleteImageAsync(imageUrl);

            if (deleted)
            {
                return Ok(new { message = "Image deleted successfully" });
            }

            return NotFound(new { error = "Image not found" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
