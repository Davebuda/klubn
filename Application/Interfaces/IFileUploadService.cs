namespace DJDiP.Application.Interfaces;

public interface IFileUploadService
{
    Task<string> UploadImageAsync(Stream fileStream, string fileName, string? folder = null);
    Task<string> UploadMediaAsync(Stream fileStream, string fileName, string? folder = null);
    Task<bool> DeleteImageAsync(string imageUrl);
    bool IsValidImageFile(string fileName);
    bool IsValidMediaFile(string fileName);
    string GetFileExtension(string fileName);
}
