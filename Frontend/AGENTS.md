# Frontend — KlubN SPA

Vite + React 18 + TypeScript single-page app (no SSR). Talks GraphQL to the .NET backend via Apollo
Client. Package name: `klubn`.

## Commands
- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — `tsc -b && vite build` (type-check then bundle)
- `npm run lint` — ESLint
- `npm run preview` — preview the production build

## Structure (`src/`)
| Path | What |
|---|---|
| `apollo-client.ts` | Apollo Client setup (links, auth, error handling) |
| `graphql/queries.ts` | **All** GraphQL operations live here (single file, no codegen) |
| `pages/` | Route components — incl. `pages/admin/`, `pages/dj/`, `pages/organizer/`, `pages/portal/` |
| `components/` | Shared UI — incl. `components/auth/` (route guards), `components/admin/`, `components/dj/`, `components/common/`, `components/layouts/` |
| `context/` | React Context: `AuthContext.tsx`, `SiteSettingsContext.tsx` |
| `stores/` | Zustand stores — only `cartStore.ts` today |
| `hooks/`, `utils/`, `assets/` | Hooks, helpers, static assets |
| `main.tsx`, `App.tsx` | Entry + route tree |

## State management
- **Auth & site settings → React Context** (`context/AuthContext.tsx`, `SiteSettingsContext.tsx`), NOT Zustand.
- **Cart → Zustand** (`stores/cartStore.ts`). That's currently the only Zustand store.
- **Server state → Apollo Client cache** (GraphQL). Don't duplicate server data into Zustand/Context.
- When adding shared client state, follow the split: ephemeral cross-component UI state → a new Zustand store; auth/session/identity → Context.

## Routing (`App.tsx`)
`react-router-dom` v6. Four guarded areas, each with its own guard + layout:
- **Public** (`<Layout>`): `/`, `/events`, `/events/:id`, `/djs`, `/djs/:id`, `/gallery`, `/mixes`, `/playlists`, `/contact`, auth pages. Some nested routes wrap in `<ProtectedRoute>` (logged-in users: `/dashboard`, `/tickets`, `/orders`, `/upload`, `/dj-enroll`, `/organizer-apply`).
- **`/dj-dashboard/*`** → `<DJRoute>` + `<DJLayout>`
- **`/admin/*`** → `<AdminRoute>` + `<AdminLayout>`
- **`/portal/*`** → `<PortalRoute>` + `<PortalLayout>`
- **`/organizer-dashboard/*`** → `<OrganizerLayout>`

Guards are in `components/auth/` (`ProtectedRoute`, `AdminRoute`, `PortalRoute`, `DJRoute`). When adding a role-gated page, wrap it in the matching guard.

## Apollo / GraphQL (`apollo-client.ts`)
- Endpoint: `import.meta.env.VITE_API_URL ?? 'http://localhost:5000/graphql'`.
- **Auth link:** reads `localStorage.getItem('accessToken')`, sends `Authorization: Bearer <token>`.
- **Error link:** on a GraphQL error message `"Authentication required."`, clears `accessToken`/`refreshToken`/`user` from localStorage and redirects to `/login?expired=1`.
- ⚠️ **Custom fetch wrapper (`graphqlFetch`) — don't remove it.** HotChocolate 13 returns **HTTP 500 when a non-null field resolves null** (GraphQL-over-HTTP spec). Apollo would treat that as a network error and skip `graphQLErrors`. The wrapper rewrites a 500 whose body is a valid GraphQL error payload to **200** so Apollo parses it normally. Removing it breaks error handling for a class of backend responses.
- All queries/mutations go in `graphql/queries.ts` — add new operations there, not inline in components.

## Conventions
Based on `App.tsx`, `apollo-client.ts`, the `pages/` + `components/` trees.
- **Default exports for page/route components** (e.g. `export default App`, every `pages/*` import in `App.tsx` is a default import) — match this in `pages/`.
- Pages are `PascalCase*Page.tsx`; admin/dj/organizer/portal variants live in their respective subfolders.
- TypeScript strict; no `any` without a comment (see `Frontend/.claude/rules/project.md`).
- Tailwind utility-first; Framer Motion for animation; Heroicons + lucide-react for icons; `react-helmet-async` for per-page `<title>`/meta.
- Auth tokens live in `localStorage` under `accessToken` / `refreshToken` / `user`.

## Env (build-time, baked into the bundle — never secrets)
- `VITE_API_URL` — GraphQL HTTP endpoint
- `VITE_WS_URL` — GraphQL WS endpoint
- `VITE_UPLOAD_API_URL` — REST upload endpoint (`/api/upload`)

## Deploy
Built as static assets, served behind Traefik (see root `docker-compose.yml` `frontend` service + `Frontend/nginx.conf`). Build args inject the `VITE_*` URLs at image-build time. `vercel.json` / `staticwebapp.config.json` exist for alternative static hosts.

## Dependencies (from `package.json`)
React 18.2 · `@apollo/client` 3.9 · `graphql` 16.8 · `react-router-dom` 6.20 · `zustand` 4.4 ·
`framer-motion` 12 · `@heroicons/react` 2 · `lucide-react` · `react-helmet-async` 3 ·
`@stripe/react-stripe-js` 2.8 / `@stripe/stripe-js` 2.4 · Tailwind 3.4 · Vite 4 · TypeScript 5.2.
