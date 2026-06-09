namespace DJDiP.Domain.Models
{
    public class DJTop10
    {
    public Guid Id { get; set; }
    public Guid DJId { get; set; }
    public DJProfile DJ { get; set; } = null!;

    public Guid SongId { get; set; }
    public Song Song { get; set; } = null!;
    }
}