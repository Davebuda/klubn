# src/

Vite + React 18 SPA source. TypeScript strict. Apollo Client → backend GraphQL at `/graphql`.

## Structure
- `pages/` — route components (wired in `App.tsx` via react-router 6)
- `components/` — shared UI (Tailwind 3.4 + Framer Motion; lucide-react/Heroicons icons)
- `graphql/` — gql documents per domain (`ticketing.ts`, `queries.ts`, …)
- `context/` — auth + site settings (React Context)
- `stores/` — Zustand (cart only)
- `hooks/`, `utils/` — shared logic (`utils/money.ts` formats minor units)
- `apollo-client.ts` — DO NOT "fix" the 500→200 fetch wrapper; HotChocolate 13 returns
  HTTP 500 for null-on-non-null and the wrapper compensates deliberately

## Conventions
- Money from the API is minor units (øre) — render via `formatMinor(minor, currency)`
- Auth token comes from the auth context; Apollo attaches it — never read storage directly in components
- New routes: add to `App.tsx` AND give the page `PageSeo` (title/description/canonical)
- Backend payment states: paymentState `Created→Authorized→Captured`, order `Pending→Reserved→Paid→Fulfilled` — match these exactly in UI conditionals
