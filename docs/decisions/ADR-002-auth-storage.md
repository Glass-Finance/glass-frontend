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
