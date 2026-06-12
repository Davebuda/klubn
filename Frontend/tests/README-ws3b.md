# WS3B browser tests (`ws3b.spec.ts`)

Playwright is **intentionally not** a dependency of this repo (P0-WS3B constraint: no new packages).
`ws3b.spec.ts` is the browser-level proof for the token-storage / CSP / safe-href claims that the
Python e2e (`scripts/e2e/xss_token.py`) and the xUnit URL tests can't make.

## What it asserts
- `Token_RefreshTokenNotReadableFromJs` — after login, `localStorage` and `document.cookie` expose
  no refresh token; the `klubn_rt` cookie exists and is `HttpOnly`.
- `Token_AccessTokenNotPersistedToLocalStorage` — no access token in `localStorage`.
- `Csp_HeaderPresentAndBlocksInlineScript` — the response carries a `script-src 'self'` CSP with no
  `'unsafe-inline'`, and an injected inline `<script>` does not execute.
- `SafeHttpUrl_NeutralizesJavascriptHref` — no `javascript:`/`data:`/`vbscript:` `<a href>` anywhere.
- `LegitimatePages_RenderLinksAfterSanitization` — valid `http(s)` links still render.

## How to run (without adding Playwright to package.json)

The CSP header is only set by the **production nginx** image, not the Vite dev server. Build and
serve the production bundle first:

```pwsh
# 1. Build + serve the production bundle behind the real nginx CSP (port 8080)
docker build -t klubn-fe -f Frontend/Dockerfile Frontend
docker run --rm -p 8080:80 klubn-fe
# (or: cd Frontend && npm run build, then serve dist/ behind an nginx using Frontend/nginx.conf)

# 2. In another shell, run the spec with an ephemeral Playwright (npx, no install into the repo)
cd Frontend
$env:WS3B_BASE_URL="http://localhost:8080"
$env:WS3B_USER_EMAIL="<a real test user email>"      # optional — login tests skip without it
$env:WS3B_USER_PASSWORD="<that user's password>"     # optional
npx --yes @playwright/test@latest test tests/ws3b.spec.ts
```

`npx --yes @playwright/test` runs Playwright from the npx cache without writing it to
`package.json`/`package-lock.json`. If the browser binaries aren't present, run
`npx --yes playwright install chromium` first.

## Env vars
| Var | Default | Meaning |
|---|---|---|
| `WS3B_BASE_URL` | `http://localhost:8080` | The nginx-served frontend (so the CSP header is real). |
| `WS3B_LOGIN_PATH` | `/login` | Login route. |
| `WS3B_USER_EMAIL` / `WS3B_USER_PASSWORD` | (unset) | A real test account. The two token tests **skip** when unset; the CSP + href tests always run. |

## Notes
- The login helper uses generic `input[type=email|password]` + `button[type=submit]` selectors;
  adjust if the login form markup changes.
- `SafeHttpUrl_NeutralizesJavascriptHref` is a render-time invariant sweep (no dangerous href on the
  public pages). To prove neutralization of a *specifically stored* `javascript:` URL, seed a
  mix/song with that value via the DB and point the test at its page.
