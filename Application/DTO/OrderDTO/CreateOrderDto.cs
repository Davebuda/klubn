namespace Application.DTO.OrderDTO
{
public class CreateOrderDto
{
    public string UserId { get; set; }
    public List<Guid> EventIds { get; set; } = new();
    public string? PromotionCode { get; set; } // brukes for å hente rabatt
}
}