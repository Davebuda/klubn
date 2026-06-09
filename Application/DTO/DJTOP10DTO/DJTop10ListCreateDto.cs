namespace DJDiP.Application.DTO.DJTop10DTO
{
    public class DJTop10ListCreateDto
    {
        public Guid DJId { get; set; }
        public List<Guid> SongIds { get; set; } = new();
    }
}
