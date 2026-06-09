namespace Application.DTO.VenueDTO
{
public class CreateVenueDto
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public string ContactEmail { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
}
}