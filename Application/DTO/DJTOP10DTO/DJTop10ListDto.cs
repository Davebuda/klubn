namespace DJDiP.Application.DTO.DJTop10DTO
{
    public class DJTop10ListDto
    {
        public Guid DJId { get; set; }
        public string DJStageName { get; set; } = string.Empty;
        public List<DJTop10ReadDto> Top10Songs { get; set; } = new();
    }
}
