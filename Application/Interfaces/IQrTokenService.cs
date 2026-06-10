namespace DJDiP.Application.Interfaces
{
    // Self-contained door-scan token payload (design §7): {t,e,a,x}.
    //   t = TicketId, e = EventId, a = AdmitCount, x = expiry (unix seconds, event end).
    // Carries NO personal data (GDPR §8) — only opaque ids + admit count + expiry.
    public sealed record QrTokenData(Guid TicketId, Guid EventId, int AdmitCount, long ExpiresAtEpoch);

    public enum QrVerifyStatus
    {
        Valid = 0,
        BadFormat = 1,   // not "payload.signature" / not base64url / unparseable json
        BadSignature = 2, // HMAC mismatch (tampered or wrong key)
        Expired = 3       // signature OK but past the event-end expiry
    }

    // Verification outcome. Data is populated when the payload parsed (Valid OR Expired),
    // and null for BadFormat / BadSignature where the payload can't be trusted.
    public sealed record QrVerifyResult(QrVerifyStatus Status, QrTokenData? Data)
    {
        public bool IsValid => Status == QrVerifyStatus.Valid;
        public static QrVerifyResult Ok(QrTokenData data) => new(QrVerifyStatus.Valid, data);
        public static QrVerifyResult Expired(QrTokenData data) => new(QrVerifyStatus.Expired, data);
        public static QrVerifyResult Fail(QrVerifyStatus status) => new(status, null);
    }

    // Pure, stateless HMAC-SHA256 token service for the ticket QR code (design §7).
    // PROVIDER-AGNOSTIC: no Vipps/Stripe coupling. Single-use enforcement is a separate
    // DB concern (atomic UPDATE on the Ticket row) handled by the scan resolver; this
    // service only signs (Issue) and verifies (Verify) the self-contained token.
    public interface IQrTokenService
    {
        // Returns "base64url(payloadJson).base64url(hmac)" — encode this in the QR image.
        string Issue(QrTokenData data);

        // Constant-time signature check + expiry check. Never throws on bad input.
        QrVerifyResult Verify(string token);
    }
}
