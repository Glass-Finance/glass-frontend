# ADR-002: Current Browser Auth Storage

- Status: Accepted for current implementation; future improvement proposed
- Date: 2026-09-10

## Context

The current Axios interceptor needs access to tokens for API requests and refresh handling across route changes and reloads.

## Decision

The current implementation stores access and refresh tokens in `localStorage`, alongside a serialized user snapshot. Short-lived flow state uses `sessionStorage`. This ADR documents the implementation; it does not claim that browser storage is the preferred long-term security model.

## Future direction

Evaluate an `HttpOnly`, `Secure`, `SameSite` refresh-token cookie and a short-lived in-memory access token with the backend team. This requires a threat model, CSRF design, migration plan, and coordinated backend changes.

## Addendum: CodeQL `js/clear-text-storage-of-sensitive-data` on `glass_user`

Added 2026-10-01. Triage recorded against CodeQL alert 6 on this repository's
scan.

CodeQL reports the persisted `glass_user` snapshot (`src/store/sessionStorage.js`, `writeStoredUser`) as clear-text storage of sensitive data, because the `/user/me` response can contain `phoneNumber`. The rule id and location are recorded here so the triage is auditable:

- Rule: `js/clear-text-storage-of-sensitive-data` (severity `error`, `security-severity: high`)
- Location: `src/store/sessionStorage.js` — `localStorage.setItem(KEY_USER, JSON.stringify(user))`
- Key: `glass_user`, part of `SESSION_KEYS`

This is an acknowledged design decision, not an accidental storage path:

- The Decision section above already records that a serialized user snapshot is persisted in `localStorage` alongside the tokens, and explicitly does not claim browser storage is the preferred long-term security model.
- `src/store/sessionStorage.js` is the single owner and funnel for session persistence and cleanup. `clearSessionStorage()` is the one path every session-ending route goes through, and it removes every key in `SESSION_KEYS` plus `SESSION_ADJACENT_KEYS`.
- The snapshot exists to support session and profile rehydration, so a reload does not require a second `/user/me` round trip before the shell can render.
- Removing `phoneNumber` from the persisted snapshot would not remove that field from the authenticated application's runtime state or query caches, where the same `/user/me` response is held after login. It would not remove the data from the client, and it would change the established session persistence contract.

The alert is therefore triaged as accepted / by design rather than fixed. This is not a claim that the CodeQL rule is incorrect, and not a claim that `localStorage` is inherently secure — the rule is correctly identifying real persisted PII, and the tradeoff is the one already accepted above. The longer-term direction remains the `HttpOnly` cookie and in-memory access token evaluated with the backend.

Alert 6 on the repository's CodeQL scan is dismissed with this rationale. Dismissal is recorded against the alert so the decision stays visible in the scan history rather than being silently dropped.

## Addendum: cross-account token bleed on a partial auth response

Added 2026-10-20.

`persistSession()` originally wrote a token only when the auth response
carried one, and otherwise **left the previous value in place**. That reads
like a harmless no-op, but `localStorage` outlives the tab and the browser
restart, so the previous account's refresh token survived a second sign-in.
The first 401 then exchanged that stale token for a fresh access token for the
_first_ account and wrote it back — the browser silently acting as the wrong
user, with no rotation-reuse signal because that token was never rotated away.

Every session-bearing auth response shares the backend's `AuthResponse` shape
and carries both tokens (see the OpenAPI document: `/auth/login`,
`/auth/register`, `/auth/verify`, `/auth/google`, `/auth/otp/verify` and both
MFA verify routes), so an absent token means the backend did not issue one.
`persistSession()` now treats an absent field as a **real absence** and clears
it, rather than inheriting whatever was there.

The trade-off is deliberate: if the backend ever stops issuing a refresh token
on some auth route, the user is asked to sign in again when the access token
expires — loud and safe — rather than inheriting another account's session,
which is silent and wrong.

## Addendum: the backend's cookie mode has shipped; the client cannot adopt it yet

Added 2026-11-15.

The API now supports cookie authentication: `cookieAuth: true` on the request
that completes authentication (register, password/Google/OTP login, MFA
completion) returns `HttpOnly` cookies instead of JSON tokens, and protected
writes take an `X-XSRF-TOKEN` header read from the `XSRF-TOKEN` cookie. Bearer
tokens and body-token refresh still work, but the backend's own integration
guide calls the cookie migration **required**, not optional.

The frontend has **not** adopted it, and should not yet. Two facts decide that:

1. **The cookie is host-only.** No `Domain` is set, so it belongs to the API
   host alone.
2. **The app and the API are different hosts.** The app is served from
   `app.glasspay.app` and calls `https://api.glasspay.app/api/v1`. A
   host-only cookie on `api.glasspay.app` is not readable by JavaScript on
   `app.glasspay.app`, so the CSRF header cannot be produced at all.

`SameSite=Lax` does not rescue this: it makes the cookie _sendable_, but it
does not make an API-host cookie _readable_ by a different origin. The
backend's guide says the same thing and points at a same-origin proxy as the
supported arrangement.

Adopting `cookieAuth: true` before that arrangement exists would be worse than
not migrating: the auth response would carry no `accessToken`, the client
would have no bearer token and no readable CSRF cookie, and every protected
request would 401. So the migration stays blocked on a deployment decision
(proxy `/api` on the app's origin, or a `Domain`-scoped cookie agreed with the
API team — and the shared web+mobile backend decision that `team-conventions`
records), not on client code. This ADR's storage decision therefore stands
unchanged for now.
