namespace DJDiP.Domain.Models
{
    // Promo code v2 (checkout-orchestration design §3.1). The table + the
    // Payment.PromotionCodeId FK already existed; the v1 stub was 5 dormant fields.
    // Money is in minor units (øre) as long; decimal stays only on DiscountPercentage.
    public class PromotionCode
    {
        public Guid Id { get; set; }

        // UNIQUE, stored uppercase; lookups are case-insensitive (normalize to upper on read/write).
        public string Code { get; set; } = null!;

        public decimal DiscountPercentage { get; set; } // existing; used when Kind=Percent (e.g. 15 = 15%)
        public DateTime ValidUntil { get; set; }         // existing; upper bound of the validity window
        public int UsageCount { get; set; }              // existing; maintained counter (atomic CAS, never COUNT(*))

        // NEW — appended columns, all nullable/defaulted so existing rows stay valid:
        public PromoKind Kind { get; set; } = PromoKind.Percent;   // Percent=0 | FixedAmount=1
        public long AmountMinor { get; set; } = 0;        // used when Kind=FixedAmount (øre)
        public DateTime? ValidFrom { get; set; }          // null = no lower bound
        public int? MaxRedemptions { get; set; }          // null = unlimited
        public int? MaxRedemptionsPerUser { get; set; }   // null = unlimited
        public Guid? EventId { get; set; }                // null = valid for any event
        public bool UnlocksHiddenTypes { get; set; }      // grants visibility/purchasability of IsHidden types in scope
        public bool IsActive { get; set; } = true;        // kill switch

        // empty = applies to all types in scope; otherwise restricts discount/unlock to listed tiers.
        public List<PromoCodeTicketType> TicketTypes { get; set; } = new();
    }

    public enum PromoKind
    {
        Percent = 0,
        FixedAmount = 1
    }

    // Join table — restricts a promo's discount/unlock to the listed ticket tiers.
    // Composite PK (PromoCodeId, TicketTypeId).
    public class PromoCodeTicketType
    {
        public Guid PromoCodeId { get; set; }
        public Guid TicketTypeId { get; set; }
    }

    // Audit + per-user-limit table for promo redemptions (design §3.1).
    // Hold-style usage, mirroring inventory: Reserved at create, Consumed at capture,
    // Released on expiry/failure.
    public class PromoRedemption
    {
        public Guid Id { get; set; }
        public Guid PromoCodeId { get; set; }
        public Guid OrderId { get; set; }                 // UNIQUE — one redemption per order
        public string UserId { get; set; } = null!;
        public PromoRedemptionStatus Status { get; set; } // Reserved=0 | Consumed=1 | Released=2
        public DateTime CreatedAt { get; set; }
    }

    // APPEND-ONLY: persisted data stores these as ints. Never renumber or remove
    // existing members. New states are appended at the end.
    public enum PromoRedemptionStatus
    {
        Reserved = 0,   // usage reserved at create (CAS on PromotionCode.UsageCount)
        Consumed = 1,   // reservation made permanent at capture/issue
        Released = 2     // reservation released on expiry/failure (UsageCount decremented, floor 0)
    }
}
