"""Shared E2E harness for the KlubN checkout layer (design: docs/design/checkout-orchestration.md).

Versioned successor to the throwaway klubn_e2e_sandbox.py / klubn_e2e_webhook.py probes.
Standard library only (urllib + sqlite3) — no third-party deps, runnable anywhere Python 3.9+ is.

Every script drives the LIVE backend over its real surfaces (GraphQL /graphql, REST
/api/checkout/*, signed webhook /api/webhooks/payments/sandbox) and then asserts against
DB TRUTH by reading the SQLite file directly. The harness exposes:

  cfg()                       -> Config (BASE_URL, DB path, sandbox secret, seeded event id)
  gql(query, vars, token)     -> dict        (HotChocolate; 500-with-body is parsed, see gotcha)
  rest(method, path, body, token) -> (status, dict|text)
  webhook(provider, body, sig)-> status      (signs by default; pass sig=... to forge/tamper)
  sign(body_bytes)            -> hex HMAC-SHA256 over the raw body (the Sandbox scheme)
  db()                        -> sqlite3.Connection (row access)
  Ledger                      -> PASS/FAIL accumulator with .check()/.done()
  register_user(prefix)       -> (token, user_id, email)
  seed_ticket_type(...)       -> ticket type id (direct INSERT — admin tier CRUD doesn't exist)
  seed_promo(...)             -> promo code id (direct INSERT — there is NO admin promo CRUD)
  uniq(prefix)                -> collision-proof name/code suffix per run

Config via env:
  E2E_BASE_URL  (default http://localhost:5102)
  E2E_DB        (default <repo-root>/DJDIP_e2e.db, resolved relative to THIS file)
  E2E_SANDBOX_SECRET (default "sandbox-webhook-secret" — must match Sandbox__WebhookSecret)
  E2E_EVENT_ID  (optional; default = the single seeded "KlubN Opening Night" event)

DB hygiene: scripts INSERT their own rows with uuid-suffixed names/codes, so re-runs never
collide. Rows are left in the disposable dev DB on purpose (cheap, and aids post-mortem).
"""
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass

# ---- enum int values (mirror Domain/Models — persisted as ints) ----------------
# TicketTypeStatus
TT_DRAFT, TT_ONSALE, TT_PAUSED, TT_SOLDOUT, TT_CLOSED = 0, 1, 2, 3, 4
# PromoKind
PROMO_PERCENT, PROMO_FIXED = 0, 1
# PromoRedemptionStatus
RED_RESERVED, RED_CONSUMED, RED_RELEASED = 0, 1, 2
# OrderStatus
ORD_PENDING, ORD_CANCELLED, ORD_RESERVED, ORD_PAID, ORD_FULFILLED, ORD_EXPIRED, ORD_REFUNDED = 0, 2, 3, 4, 5, 6, 7
# PaymentStatus
PAY_FAILED, PAY_CREATED, PAY_AUTHORIZED, PAY_CAPTURED, PAY_ABORTED, PAY_EXPIRED = 2, 4, 5, 6, 8, 9
# TicketHoldStatus
HOLD_ACTIVE, HOLD_COMMITTED, HOLD_RELEASED, HOLD_EXPIRED = 0, 1, 2, 3


@dataclass
class Config:
    base_url: str
    db_path: str
    sandbox_secret: bytes
    event_id: str


_CFG: Config | None = None


def _resolve_db_default() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    # scripts/e2e/_harness.py -> repo root is two levels up.
    return os.path.normpath(os.path.join(here, "..", "..", "DJDIP_e2e.db"))


def cfg() -> Config:
    global _CFG
    if _CFG is not None:
        return _CFG
    base = os.environ.get("E2E_BASE_URL", "http://localhost:5102").rstrip("/")
    db = os.environ.get("E2E_DB") or _resolve_db_default()
    db = os.path.abspath(db)
    secret = os.environ.get("E2E_SANDBOX_SECRET", "sandbox-webhook-secret").encode()
    if not os.path.exists(db):
        print(f"FATAL: DB not found at {db}. Start the backend against this DB first "
              f"(see scripts/e2e/README.md).", file=sys.stderr)
        sys.exit(2)
    event_id = os.environ.get("E2E_EVENT_ID") or _default_event_id(db)
    _CFG = Config(base, db, secret, event_id)
    return _CFG


def _default_event_id(db_path: str) -> str:
    con = sqlite3.connect(db_path)
    try:
        row = con.execute("SELECT Id FROM Events ORDER BY Date DESC LIMIT 1").fetchone()
        if not row:
            print("FATAL: no seeded Event in the DB; cannot derive E2E_EVENT_ID.", file=sys.stderr)
            sys.exit(2)
        return row[0]
    finally:
        con.close()


# ---- HTTP helpers --------------------------------------------------------------

def gql(query: str, variables: dict | None = None, token: str | None = None) -> dict:
    """POST a GraphQL op. HotChocolate 13 returns 500 with a GraphQL error body on a
    non-null field resolving null / a thrown GraphQLException — parse that body too."""
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(cfg().base_url + "/graphql", data=body,
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return json.loads(raw)
        except Exception:
            return {"errors": [{"message": f"HTTP {e.code}: {raw[:300]!r}"}]}


def rest(method: str, path: str, body: dict | None = None, token: str | None = None):
    """Returns (status_code, parsed_body). Body parsed as JSON when possible, else text."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(cfg().base_url + path, data=data, headers=headers, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, _parse(r.read())
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read())


def _parse(raw: bytes):
    try:
        return json.loads(raw)
    except Exception:
        return raw.decode(errors="replace")


def sign(body_bytes: bytes) -> str:
    """Hex HMAC-SHA256 over the raw body — the Sandbox provider's signature scheme."""
    return hmac.new(cfg().sandbox_secret, body_bytes, hashlib.sha256).hexdigest()


def webhook(provider: str, body: dict | bytes, sig: str | None = None) -> int:
    """POST a webhook to /api/webhooks/payments/{provider}. By default signs the raw body
    with the sandbox secret; pass sig=<str> to forge/tamper, or sig=False to omit it."""
    raw = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode()
    url = f"{cfg().base_url}/api/webhooks/payments/{provider}"
    req = urllib.request.Request(url, data=raw, headers={"Content-Type": "application/json"})
    if sig is False:
        pass  # explicitly omit signature header
    else:
        req.add_header("X-Sandbox-Signature", sig if sig is not None else sign(raw))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


# ---- DB ------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    con = sqlite3.connect(cfg().db_path, timeout=30)
    con.row_factory = sqlite3.Row
    return con


# ---- PASS/FAIL ledger ----------------------------------------------------------

class Ledger:
    def __init__(self, title: str):
        self.title = title
        self.passed: list[str] = []
        self.failed: list[str] = []
        print(f"\n=== {title} ===")
        print(f"    base={cfg().base_url}  db={cfg().db_path}")

    def check(self, name: str, cond: bool, detail: str = "") -> bool:
        (self.passed if cond else self.failed).append(name)
        mark = "  PASS  " if cond else "  FAIL  "
        print(mark + name + (f"  -- {detail}" if detail else ""))
        return bool(cond)

    def fatal(self, name: str, detail: str = ""):
        self.check(name, False, detail)
        self.done()

    def done(self) -> int:
        print(f"\nRESULT [{self.title}]: {len(self.passed)} passed, {len(self.failed)} failed")
        if self.failed:
            print("FAILED:", self.failed)
            sys.exit(1)
        sys.exit(0)


# ---- seeding & fixtures --------------------------------------------------------

def uniq(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def register_user(prefix: str = "e2e"):
    """Register a fresh user, return (access_token, user_id, email).

    WS3C: terms acceptance is now REQUIRED at signup (server-enforced), so every register
    must send acceptTerms:true. marketingOptIn:false is sent explicitly (separate consent)."""
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@test.local"
    r = gql("""mutation($i: RegisterInput!) {
      register(input: $i) { accessToken user { id email } } }""",
            {"i": {"fullName": "E2E Tester", "email": email, "password": "E2e!TestPass123",
                   "acceptTerms": True, "marketingOptIn": False}})
    data = (r.get("data") or {}).get("register") or {}
    tok = data.get("accessToken")
    if not tok:
        raise RuntimeError(f"register failed: {json.dumps(r)[:400]}")
    return tok, data["user"]["id"], email


def seed_ticket_type(*, event_id: str, name: str, price_minor: int, capacity: int,
                     vat_rate: str = "0.12", admit_count: int = 1, min_per_order: int = 1,
                     max_per_order: int = 10, status: int = TT_ONSALE, is_hidden: bool = False,
                     quantity_sold: int = 0, quantity_held: int = 0, sort_order: int = 0,
                     currency: str = "NOK") -> str:
    """Direct-INSERT a TicketType (there is no admin tier-CRUD mutation). Returns the id
    (UPPERCASE, matching how EF/SQLite stores Guids in this DB)."""
    tid = str(uuid.uuid4()).upper()
    con = db()
    try:
        con.execute(
            """INSERT INTO TicketTypes
               (Id,EventId,Name,Description,PriceMinor,VATRate,Currency,Capacity,QuantitySold,
                QuantityHeld,AdmitCount,MinPerOrder,MaxPerOrder,SalesStart,SalesEnd,Status,SortOrder,IsHidden)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,?)""",
            (tid, event_id, name, None, price_minor, vat_rate, currency, capacity, quantity_sold,
             quantity_held, admit_count, min_per_order, max_per_order, status, sort_order,
             1 if is_hidden else 0))
        con.commit()
    finally:
        con.close()
    return tid


def seed_promo(*, code: str, kind: int = PROMO_PERCENT, discount_pct: str = "0",
               amount_minor: int = 0, valid_from: str | None = None,
               valid_until: str = "2099-01-01 00:00:00", max_redemptions: int | None = None,
               max_per_user: int | None = None, event_id: str | None = None,
               unlocks_hidden: bool = False, is_active: bool = True,
               usage_count: int = 0, ticket_type_ids: list[str] | None = None) -> str:
    """Direct-INSERT a PromotionCode (+ optional PromoCodeTicketTypes scope rows). There is
    NO admin promo CRUD — direct DB seeding is the sanctioned E2E approach (README documents
    this). Code is stored UPPERCASE (the service normalizes lookups to uppercase)."""
    pid = str(uuid.uuid4()).upper()
    code_norm = code.strip().upper()
    con = db()
    try:
        con.execute(
            """INSERT INTO PromotionCodes
               (Id,Code,DiscountPercentage,ValidUntil,UsageCount,Kind,AmountMinor,ValidFrom,
                MaxRedemptions,MaxRedemptionsPerUser,EventId,UnlocksHiddenTypes,IsActive)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, code_norm, discount_pct, valid_until, usage_count, kind, amount_minor,
             valid_from, max_redemptions, max_per_user, event_id,
             1 if unlocks_hidden else 0, 1 if is_active else 0))
        for ttid in (ticket_type_ids or []):
            con.execute("INSERT INTO PromoCodeTicketTypes (PromoCodeId,TicketTypeId) VALUES (?,?)",
                        (pid, ttid))
        con.commit()
    finally:
        con.close()
    return pid


# ---- small DB read helpers used across scripts ---------------------------------

def order_by_ref(ref: str):
    con = db()
    try:
        return con.execute("SELECT * FROM Orders WHERE Reference = ?", (ref,)).fetchone()
    finally:
        con.close()


def order_id_by_ref(ref: str):
    row = order_by_ref(ref)
    return row["Id"] if row else None


def holds_for_ref(ref: str):
    con = db()
    try:
        return con.execute(
            "SELECT th.* FROM TicketHolds th JOIN Orders o ON th.OrderId = o.Id "
            "WHERE o.Reference = ?", (ref,)).fetchall()
    finally:
        con.close()


def payments_by_ref_prefix(ref: str):
    """All Payment rows whose ProviderReference is ref or ref-rN (the multi-attempt scheme)."""
    con = db()
    try:
        return con.execute(
            "SELECT * FROM Payments WHERE ProviderReference = ? OR ProviderReference LIKE ? "
            "ORDER BY AttemptNo", (ref, ref + "-r%")).fetchall()
    finally:
        con.close()


def tickets_for_ref(ref: str):
    con = db()
    try:
        return con.execute(
            """SELECT t.* FROM Tickets t
               JOIN OrderItems oi ON t.OrderItemId = oi.Id
               JOIN Orders o ON oi.OrderId = o.Id
               WHERE o.Reference = ?""", (ref,)).fetchall()
    finally:
        con.close()


def tt_counters(ticket_type_id: str):
    con = db()
    try:
        row = con.execute(
            "SELECT QuantitySold, QuantityHeld, Capacity FROM TicketTypes WHERE Id = ?",
            (ticket_type_id,)).fetchone()
        return (row["QuantitySold"], row["QuantityHeld"], row["Capacity"]) if row else (None, None, None)
    finally:
        con.close()
