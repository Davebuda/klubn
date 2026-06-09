namespace Application.DTO.PromotionCodeDTO
{
public class PromotionCodeDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal DiscountPercentage { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; }
}
}