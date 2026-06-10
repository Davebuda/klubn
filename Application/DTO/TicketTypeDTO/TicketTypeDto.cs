namespace DJDiP.Application.DTO.TicketTypeDTO
{
    // Read model for a ticket tier. Money fields are minor units (øre) as long.
    public class TicketTypeDto
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public long PriceMinor { get; set; }
        public decimal VATRate { get; set; }
        public string Currency { get; set; } = "NOK";
        public int Capacity { get; set; }
        public int QuantitySold { get; set; }
        public int QuantityHeld { get; set; }
        // Computed convenience: Capacity - QuantitySold - QuantityHeld.
        public int Available { get; set; }
        public int AdmitCount { get; set; }
        public int MinPerOrder { get; set; }
        public int MaxPerOrder { get; set; }
        public DateTime? SalesStart { get; set; }
        public DateTime? SalesEnd { get; set; }
        public string Status { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
}
