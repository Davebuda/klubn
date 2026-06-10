namespace DJDiP.Domain.Models
{
    // APPEND-ONLY: persisted data stores these as ints. Never renumber or remove
    // existing members. New ticketing/Vipps states are appended at the end.
    public enum OrderStatus
    {
        Pending = 0,
        Completed = 1,   // legacy (pre-ticketing); retained for persisted rows
        Cancelled = 2,
        // Ticketing/Vipps lifecycle (P2-T3), appended:
        Reserved = 3,           // Vipps authorized (money reserved), holds stand
        Paid = 4,               // captured
        Fulfilled = 5,          // tickets issued + delivered
        Expired = 6,            // hold expired / timed out before payment
        Refunded = 7,
        PartiallyFulfilled = 8
    }

    // APPEND-ONLY (see note above).
    public enum PaymentStatus
    {
        Pending = 0,     // legacy
        Completed = 1,   // legacy
        Failed = 2,
        Refunded = 3,
        // Ticketing/Vipps lifecycle (P2-T4), appended:
        Created = 4,            // persisted before provider InitiateAsync
        Authorized = 5,
        Captured = 6,
        PartiallyRefunded = 7,
        Aborted = 8,
        Expired = 9,
        Terminated = 10
    }
}
