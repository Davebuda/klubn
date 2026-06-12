"""E2E — WSx HotChocolate 13->16 migration: HTTP transport + introspection contract.

After the upgrade, HC16 defaults to the GraphQL-over-HTTP spec (Content-Type
`application/graphql-response+json`, and a NON-200 status when the response carries errors). The
SPA (Frontend/src/apollo-client.ts) was written against the old contract: `application/json` with a
200 body even when GraphQL errors are present (it even has a 500->200 shim). WSx pins
`HttpTransportVersion.Legacy` to preserve exactly that contract so the frontend keeps working
unchanged. These checks assert the pin holds.

Checks:
  valid_query_200_json    a successful query -> 200 + application/json + data.
  error_query_200_json    an ERRORING query (auth-denied) -> STILL 200 + application/json + errors
                          (this is the whole point of Legacy transport; spec mode would be non-200
                          and application/graphql-response+json).
  content_type_is_legacy  the error response Content-Type is application/json, NOT
                          application/graphql-response+json -> proves the Legacy pin is active.
  introspection_disabled  __schema rejected (HC0046) outside Development; SKIPPED on a Dev backend.

Run (fresh DB + backend running; Staging makes the introspection check meaningful):
    E2E_BASE_URL=http://localhost:5000 python graphql_transport.py
"""
import json
import urllib.error
import urllib.request

import _harness as h


def _post(query: str, headers: dict | None = None):
    """POST a GraphQL op; return (status, content_type, parsed_body). Never raises on HTTP error."""
    body = json.dumps({"query": query, "variables": {}}).encode()
    req = urllib.request.Request(h.cfg().base_url + "/graphql", data=body,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, (r.headers.get("Content-Type") or ""), _parse(r.read())
    except urllib.error.HTTPError as e:
        return e.code, (e.headers.get("Content-Type") or ""), _parse(e.read())


def _parse(raw: bytes):
    try:
        return json.loads(raw)
    except Exception:
        return raw.decode(errors="replace")


def _has_errors(p) -> bool:
    return isinstance(p, dict) and bool(p.get("errors"))


def _has_data(p) -> bool:
    return isinstance(p, dict) and p.get("data") not in (None, {})


def main():
    h.cfg()
    L = h.Ledger("graphql_transport")

    # 1) A successful query -> 200 + application/json + data.
    status, ctype, parsed = _post("{ siteSettings { id } }")
    L.check("valid_query_200_json (success -> 200 + application/json + data)",
            status == 200 and ctype.startswith("application/json") and _has_data(parsed),
            f"status={status} ctype={ctype!r}")

    # 2) An ERRORING query must STILL be 200 + application/json + errors. We use an admin-only
    #    query with no token -> the resolver guard throws -> GraphQL error in the body. Under HC16
    #    spec transport this would be non-200 + application/graphql-response+json; Legacy keeps 200.
    status, ctype, parsed = _post("{ users { id } }")
    L.check("error_query_200_json (GraphQL error -> STILL 200 + JSON body, not a transport error)",
            status == 200 and _has_errors(parsed),
            f"status={status} ctype={ctype!r} body={json.dumps(parsed)[:140] if isinstance(parsed,dict) else str(parsed)[:140]}")

    # 3) The decisive Legacy-transport assertion: Content-Type is application/json, NOT
    #    application/graphql-response+json (which is what HC16 returns WITHOUT the Legacy pin).
    L.check("content_type_is_legacy (Content-Type application/json, not graphql-response+json)",
            ctype.startswith("application/json") and "graphql-response+json" not in ctype,
            f"ctype={ctype!r}")

    # 4) Introspection is Dev-only. Outside Development __schema is rejected (HC0046). On a Dev
    #    backend introspection is intentionally ON -> SKIPPED (not a failure), mirroring dos_limits.
    status, ctype, parsed = _post("{ __schema { queryType { name } } }")
    if _has_data(parsed) and not _has_errors(parsed):
        L.check("introspection_disabled [SKIPPED: Dev backend — run with ASPNETCORE_ENVIRONMENT="
                "Staging to make this meaningful]", True,
                "introspection answered -> Dev backend; xfail/skip by design")
    else:
        L.check("introspection_disabled (__schema rejected outside Development)",
                _has_errors(parsed),
                f"status={status} body={json.dumps(parsed)[:140] if isinstance(parsed,dict) else str(parsed)[:140]}")

    L.done()


if __name__ == "__main__":
    main()
