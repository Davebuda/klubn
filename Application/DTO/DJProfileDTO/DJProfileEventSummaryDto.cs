namespace DJDiP.Application.DTO.DJProfileDTO
{
    public class DJProfileEventSummaryDto
    {
        public Guid EventId { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string VenueName { get; set; } = string.Empty;
        public string? City { get; set; }
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
    }
}
