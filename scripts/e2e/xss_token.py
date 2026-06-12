"""E2E — P0-WS3B XSS -> token-theft breaker.

Drives the LIVE backend and asserts the WS3B guards that don't need a browser:

  ingest_javascript_url_rejected      POST /api/ingest/events with a javascript: imageUrl -> 400
                                      (and a valid https: imageUrl is accepted). Needs the n8n
                                      shared secret; SKIPPED if E2E_N8N_SECRET isn't set.
  profile_nonhttp_url_rejected        submitDjApplication with a javascript: profileImageUrl ->
                                      rejected; a non-http(s) scheme never persists.
  valid_https_url_accepted            the same submitDjApplication with a valid https profile
                                      image URL is accepted (no false positive).
  csrf_refresh_rejected_without_token POST /api/auth/refresh with NO X-CSRF-Token header -> 403.
  refresh_token_not_in_login_body     a login response body carries NO usable refreshToken AND the
                                      Set-Cookie: klubn_rt is HttpOnly (the refresh token is only in
                                      the HttpOnly cookie, never readable by JS).

These reuse the shared harness for config + the Ledger, but talk to the endpoints with urllib
directly where response headers (Set-Cookie) or custom headers (x-n8n-secret / X-CSRF-Token) are
needed — same approach as dos_limits.py.

Run (needs a FRESH SQLite DB + the backend running against it — see scripts/e2e/README.md):

    # to also exercise the ingest leg, start the backend with N8N_SECRET set and pass it here:
    #   $env:N8N_SECRET="e2e-n8n-secret"  (when starting the backend)
    #   E2E_BASE_URL=http://localhost:5102 E2E_N8N_SECRET=e2e-n8n-secret python xss_token.py
"""
import json
import os
import urllib.error
import urllib.request
import uuid

import _harness as h


def _raw(method: str, path: str, body, headers: dict | None = None):
    """POST/GET raw; return (status, parsed_body|text, response_headers_list). Never raises."""
    data = None
    if body is not None:
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode()
    req = urllib.request.Request(
        h.cfg().base_url + path, data=data,
        headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, _parse(r.read()), list(r.headers.items())
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read()), list(e.headers.items())


def _parse(raw: bytes):
    try:
        return json.loads(raw)
    except Exception:
        return raw.decode(errors="replace")


def _set_cookies(headers: list) -> list[str]:
    return [v for (k, v) in headers if k.lower() == "set-cookie"]


# ---- checks --------------------------------------------------------------------

def check_ingest_javascript_url_rejected(L):
    secret = os.environ.get("E2E_N8N_SECRET")
    if not secret:
        L.check("ingest_javascript_url_rejected [SKIPPED: set E2E_N8N_SECRET (== backend "
                "N8N_SECRET) to exercise the ingest leg]", True,
                "no E2E_N8N_SECRET -> ingest auth would 401 before validation; skipped by design")
        return

    hdr = {"x-n8n-secret": secret}

    # A javascript: imageUrl must be rejected with 400 (scheme allowlist), NOT persisted.
    bad = {"title": "XSS " + h.uniq(), "source_post_id": "xss-js-" + uuid.uuid4().hex,
           "imageUrl": "javascript:alert(document.cookie)",
           "venue": {"name": "XSS Venue " + h.uniq()}, "date": "2099-01-01"}
    bad_status, bad_body, _ = _raw("POST", "/api/ingest/events", bad, hdr)
    L.check("ingest_javascript_url_rejected (javascript: imageUrl -> 400)", bad_status == 400,
            f"status={bad_status} body={json.dumps(bad_body)[:160]}")

    # A valid https: imageUrl is accepted (201 Created) — no false positive.
    good = {"title": "OK " + h.uniq(), "source_post_id": "xss-ok-" + uuid.uuid4().hex,
            "imageUrl": "https://example.com/poster.jpg",
            "venue": {"name": "OK Venue " + h.uniq()}, "date": "2099-01-02"}
    good_status, good_body, _ = _raw("POST", "/api/ingest/events", good, hdr)
    L.check("ingest_javascript_url_rejected: valid https imageUrl accepted (201)",
            good_status == 201, f"status={good_status} body={json.dumps(good_body)[:160]}")


def check_profile_nonhttp_url_rejected(L):
    # A freshly-registered user submits a DJ application. A javascript: profileImageUrl must be
    # rejected by the server-side scheme allowlist (ValidateOptionalUrl in the resolver).
    token, uid, _ = h.register_user("xssProfile")
    q = """mutation($i: CreateDJApplicationInput!) {
      submitDJApplication(input: $i) { id } }"""
    # userId is required by the input schema (WS1 keeps the field but derives identity from the JWT
    # and ignores it server-side); supply it + the other required fields so the mutation reaches the
    # URL scheme-allowlist check instead of failing earlier on a missing required field.
    bad_input = {
        "userId": uid, "stageName": "DJ XSS " + h.uniq(), "bio": "test bio", "genre": "House",
        "yearsExperience": 1, "specialties": "x", "influencedBy": "y", "equipmentUsed": "z",
        "socialLinks": "", "coverImageUrl": "", "profileImageUrl": "javascript:alert(1)"
    }
    r = h.gql(q, {"i": bad_input}, token)
    rejected = bool(r.get("errors")) and (r.get("data") or {}).get("submitDJApplication") is None
    msg = (r.get("errors") or [{}])[0].get("message", "")
    L.check("profile_nonhttp_url_rejected (javascript: profileImageUrl -> rejected)", rejected,
            f"msg={msg!r}")


def check_valid_https_url_accepted(L):
    # The SAME mutation with a valid https profileImageUrl must succeed (no false positive). A fresh
    # user is used (one pending application per user), with valid https image URLs.
    token, uid, _ = h.register_user("xssProfileOk")
    q = """mutation($i: CreateDJApplicationInput!) {
      submitDJApplication(input: $i) { id } }"""
    good_input = {
        "userId": uid, "stageName": "DJ OK " + h.uniq(), "bio": "test bio", "genre": "House",
        "yearsExperience": 1, "specialties": "x", "influencedBy": "y", "equipmentUsed": "z",
        "socialLinks": "",
        "profileImageUrl": "https://example.com/me.jpg",
        "coverImageUrl": "https://example.com/cover.jpg"
    }
    r = h.gql(q, {"i": good_input}, token)
    ok = not r.get("errors") and bool((r.get("data") or {}).get("submitDJApplication", {}).get("id"))
    L.check("valid_https_url_accepted (https profileImageUrl accepted)", ok,
            f"body={json.dumps(r)[:200]}")


def check_csrf_refresh_rejected_without_token(L):
    # POST /api/auth/refresh with NO X-CSRF-Token header -> 403 (double-submit guard fires before
    # any token validation). No cookies are sent either, but the CSRF check is first.
    status, body, _ = _raw("POST", "/api/auth/refresh", None, headers={})
    L.check("csrf_refresh_rejected_without_token (refresh w/o X-CSRF-Token -> 403)", status == 403,
            f"status={status} body={json.dumps(body)[:160]}")


def check_refresh_token_not_in_login_body(L):
    # Register (which logs in) and inspect the raw response: the GraphQL body must carry NO usable
    # refreshToken (it's blanked server-side), and the Set-Cookie: klubn_rt must be HttpOnly.
    email = f"xssLogin-{uuid.uuid4().hex[:8]}@test.local"
    reg = ("""mutation($i: RegisterInput!){ register(input:$i){ accessToken refreshToken """
           """user { id email } } }""")
    body = {"query": reg, "variables": {"i": {
        "fullName": "XSS Login", "email": email, "password": "E2e!TestPass123",
        "acceptTerms": True, "marketingOptIn": False}}}  # WS3C: terms acceptance is now required at signup
    status, parsed, headers = _raw("POST", "/graphql", body)

    data = (parsed.get("data") or {}).get("register") if isinstance(parsed, dict) else None
    access = (data or {}).get("accessToken")
    refresh = (data or {}).get("refreshToken")

    # accessToken still present in the body (frozen baseline depends on it).
    L.check("refresh_token_not_in_login_body: accessToken still returned in body",
            bool(access), f"access_present={bool(access)}")

    # refreshToken must be empty/blank in the body (no usable refresh credential exposed to JS).
    L.check("refresh_token_not_in_login_body: body refreshToken is blank (not usable)",
            (refresh is None or refresh == ""), f"refreshToken={refresh!r}")

    # The Set-Cookie for klubn_rt must be HttpOnly.
    cookies = _set_cookies(headers)
    rt = next((c for c in cookies if c.startswith("klubn_rt=")), None)
    httponly = bool(rt) and ("httponly" in rt.lower())
    L.check("refresh_token_not_in_login_body: Set-Cookie klubn_rt is HttpOnly",
            httponly, f"klubn_rt_cookie={rt!r}")


def main():
    h.cfg()
    L = h.Ledger("xss_token")

    check_ingest_javascript_url_rejected(L)
    check_profile_nonhttp_url_rejected(L)
    check_valid_https_url_accepted(L)
    check_csrf_refresh_rejected_without_token(L)
    check_refresh_token_not_in_login_body(L)

    L.done()


if __name__ == "__main__":
    main()
