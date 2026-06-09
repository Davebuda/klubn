namespace DJDiP.Domain.Models
{
    public class DJTop10List
    {
        public Guid DJId { get; set; }
        public string DJStageName { get; set; } = string.Empty;

        public List<DJTop10> Top10Songs { get; set; } = new();
    }
}
