namespace DJDiP.Domain.Models
{
    public class EventDJ
{
    public Guid EventId { get; set; }
    public Event Event { get; set; } = null!;

    public Guid DJId { get; set; }
    public DJProfile DJ { get; set; } = null!;
}

}