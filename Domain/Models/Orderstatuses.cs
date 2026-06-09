namespace DJDiP.Domain.Models
{
    public enum OrderStatus
    {
        Pending,
        Completed,
        Cancelled
    }

    public enum PaymentStatus
    {
        Pending,
        Completed,
        Failed,
        Refunded
    }
}