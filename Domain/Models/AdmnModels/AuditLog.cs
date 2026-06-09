
namespace DJDiP.Domain.Models.AdmnModels
{
    public class AuditLog
    {
        public Guid Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string Action { get; set; } = string.Empty; // f.eks. "Create", "Update", "Delete"
        public string EntityName { get; set; } = string.Empty; // f.eks. "Event", "DJProfile"
        public string EntityId { get; set; } = string.Empty;   // ID i string for fleksibilitet
        public string UserId { get; set; } = string.Empty;     // Den som utførte handlingen
        public string? Changes { get; set; }                   // Valgfri: Beskrivelse eller JSON-diff
    }
}
