using DJDiP.Application.Interfaces;

namespace DJDiP.Application.Services;

public class FileUploadService : IFileUploadService
{
    private readonly string _uploadPath;
    private readonly string _baseUrl;
    private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
    private readonly string[] _allowedMediaExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov", ".avi", ".mkv" };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB

    // Magic bytes for file type validation
    private static readonly Dictionary<string, byte[][]> _fileSignatures = new()
    {
        { ".jpg", new[] { new byte[] { 0xFF, 0xD8, 0xFF } } },
        { ".jpeg", new[] { new byte[] { 0xFF, 0xD8, 0xFF } } },
        { ".png", new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } } },
        { ".gif", new[] { new byte[] { 0x47, 0x49, 0x46, 0x38 } } },
        { ".webp", new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } } },
        { ".mp4", new[] { new byte[] { 0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70 }, new byte[] { 0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70 }, new byte[] { 0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70 } } },
        { ".webm", new[] { new byte[] { 0x1A, 0x45, 0xDF, 0xA3 } } },
        { ".mov", new[] { new byte[] { 0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70 } } },
        { ".avi", new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } } },
        { ".mkv", new[] { new byte[] { 0x1A, 0x45, 0xDF, 0xA3 } } },
    };

    public FileUploadService(string uploadPath, string baseUrl)
    {
        _uploadPath = Path.GetFullPath(uploadPath);
        _baseUrl = baseUrl;

        if (!Directory.Exists(_uploadPath))
        {
            Directory.CreateDirectory(_uploadPath);
        }
    }

    private string GetSafeTargetPath(string? folder)
    {
        if (string.IsNullOrWhiteSpace(folder))
            return _uploadPath;

        // Sanitize folder name — allow only alphanumeric, hyphens, underscores
        var sanitized = System.Text.RegularExpressions.Regex.Replace(folder, @"[^a-zA-Z0-9_\-]", "");
        if (string.IsNullOrEmpty(sanitized))
            return _uploadPath;

        var targetPath = Path.GetFullPath(Path.Combine(_uploadPath, sanitized));

        // Ensure the resolved path is still within uploads directory
        if (!targetPath.StartsWith(_uploadPath, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid upload folder.");

        if (!Directory.Exists(targetPath))
            Directory.CreateDirectory(targetPath);

        return targetPath;
    }

    private bool ValidateFileContent(Stream fileStream, string extension)
    {
        if (!_fileSignatures.TryGetValue(extension.ToLowerInvariant(), out var signatures))
            return false;

        var headerBytes = new byte[8];
        var originalPosition = fileStream.Position;
        var bytesRead = fileStream.Read(headerBytes, 0, headerBytes.Length);
        fileStream.Position = originalPosition;

        if (bytesRead < 3)
            return false;

        return signatures.Any(sig =>
            sig.Length <= bytesRead &&
            headerBytes.Take(sig.Length).SequenceEqual(sig));
    }

    public async Task<string> UploadImageAsync(Stream fileStream, string fileName, string? folder = null)
    {
        if (!IsValidImageFile(fileName))
            throw new InvalidOperationException("Invalid file type. Only image files are allowed.");

        var extension = GetFileExtension(fileName);

        if (!ValidateFileContent(fileStream, extension))
            throw new InvalidOperationException("File content does not match its extension.");

        var uniqueFileName = $"{Guid.NewGuid()}{extension}";
        var targetPath = GetSafeTargetPath(folder);
        var filePath = Path.Combine(targetPath, uniqueFileName);

        using (var fileStreamOut = new FileStream(filePath, FileMode.Create))
        {
            await fileStream.CopyToAsync(fileStreamOut);
        }

        var sanitizedFolder = string.IsNullOrWhiteSpace(folder) ? null
            : System.Text.RegularExpressions.Regex.Replace(folder, @"[^a-zA-Z0-9_\-]", "");
        var relativePath = sanitizedFolder != null
            ? $"/uploads/{sanitizedFolder}/{uniqueFileName}"
            : $"/uploads/{uniqueFileName}";

        return $"{_baseUrl}{relativePath}";
    }

    public async Task<string> UploadMediaAsync(Stream fileStream, string fileName, string? folder = null)
    {
        if (!IsValidMediaFile(fileName))
            throw new InvalidOperationException("Invalid file type. Allowed: jpg, jpeg, png, gif, webp, mp4, webm, mov, avi, mkv.");

        var extension = GetFileExtension(fileName);

        if (!ValidateFileContent(fileStream, extension))
            throw new InvalidOperationException("File content does not match its extension.");

        var uniqueFileName = $"{Guid.NewGuid()}{extension}";
        var targetPath = GetSafeTargetPath(folder);
        var filePath = Path.Combine(targetPath, uniqueFileName);

        using (var fileStreamOut = new FileStream(filePath, FileMode.Create))
        {
            await fileStream.CopyToAsync(fileStreamOut);
        }

        var sanitizedFolder = string.IsNullOrWhiteSpace(folder) ? null
            : System.Text.RegularExpressions.Regex.Replace(folder, @"[^a-zA-Z0-9_\-]", "");
        var relativePath = sanitizedFolder != null
            ? $"/uploads/{sanitizedFolder}/{uniqueFileName}"
            : $"/uploads/{uniqueFileName}";

        return $"{_baseUrl}{relativePath}";
    }

    public Task<bool> DeleteImageAsync(string imageUrl)
    {
        try
        {
            var uri = new Uri(imageUrl);
            var relativePath = uri.AbsolutePath.TrimStart('/');

            // Only allow deletion from uploads directory
            if (!relativePath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                return Task.FromResult(false);

            var filePath = Path.GetFullPath(
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativePath));

            var uploadsRoot = Path.GetFullPath(
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads"));

            // Ensure resolved path is within uploads directory
            if (!filePath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
                return Task.FromResult(false);

            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                return Task.FromResult(true);
            }

            return Task.FromResult(false);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }

    public bool IsValidImageFile(string fileName)
    {
        var extension = GetFileExtension(fileName).ToLowerInvariant();
        return _allowedExtensions.Contains(extension);
    }

    public bool IsValidMediaFile(string fileName)
    {
        var extension = GetFileExtension(fileName).ToLowerInvariant();
        return _allowedMediaExtensions.Contains(extension);
    }

    public string GetFileExtension(string fileName)
    {
        return Path.GetExtension(fileName).ToLowerInvariant();
    }
}
