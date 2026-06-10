Framework: ASP.NET Core .NET 10 (backend) + Vite/React 18 SPA (frontend)
Type: DJ/nightlife event-discovery + ticketing platform (KlubN, Norway, klubn.no)
What exists:
  - Events, Venues, DJs, Gallery (n8n social ingest), Playlists, Reviews, Gamification
  - Ticketing primitives: Event(single Price), Ticket(VAT-compliant, QR, transfer, refund), Order, OrderItem, Payment, PriceRule, PromotionCode
  - GraphQL (HotChocolate 13, schema inline in Program.cs), repo+UnitOfWork pattern
  - Norwegian VAT (12%) + consumer-rights fields already on Ticket (migration NorwegianTicketingStandards)
Data model gaps (for this task):
  - No TicketType/tier entity — Event.Price is a single number
  - OrderItem has no ticket-type ref (can't express "2 VIP + 4 GA")
  - No per-tier inventory/capacity, no checkout hold/reservation (oversell risk)
  - Payment has no Vipps fields, no payment state machine
  - No payment provider wired (no Stripe/Vipps code today)
Recent focus: n8n ingest idempotency (EventKey), gallery provenance
Stack: .NET 10, HotChocolate 13.9.7, EF Core 9 (SQLite dev / Postgres 16 prod), JWT, Serilog, MailKit; React/Apollo/Zustand/Tailwind; Docker+Traefik
Run mode: fast (focused: Vipps API + multi-tier ticketing patterns)
