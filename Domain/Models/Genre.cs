namespace DJDiP.Domain.Models
{
    public class Genre
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public List<Event> Events { get; set; } = new();

    }
}