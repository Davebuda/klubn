namespace Application.DTO.PromotionCodeDTO
{

public class CreatePromotionCodeDto
{
    public string Code { get; set; } = string.Empty;
    public decimal DiscountPercentage { get; set; }
    public DateTime ExpiresAt { get; set; }
}
}