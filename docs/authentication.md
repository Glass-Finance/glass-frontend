# Authentication

## Current behavior

Authentication is coordinated by `AuthContext` and `src/services/authService.js`. Password, passwordless OTP, Google OAuth, registration, email verification, optional phone add/update (post-signup), password reset, and TOTP endpoints are called through the shared Axios client.

**Sign-in product rule (current):** the sign-in UI accepts an **email or phone number** in a single identifier field (password and OTP tabs); `"@"` selects email, anything else is phone-validated. Backend login APIs accept both shapes (`{ email }` XOR `{ phoneNumber }`). Phone is optional at registration and is **added later** in Settings with first-time copy **“Add…”**, not “Verify…” — see [`account-verification.md`](account-verification.md).

Successful sessions store `accessToken`, `refreshToken`, basic user identifiers, and the serialized user snapshot in browser `localStorage`, plus a monotonic session epoch (`glass_session_epoch`). The Axios request interceptor sends the access token as a Bearer token. A `401` response triggers a refresh-token request that is single-flight in-tab (shared promise) and lease-elected cross-tab (one owner per cycle, losers wait for the published result). The lease is an election, not a lock: `localStorage.setItem` and `localStorage.getItem` are not atomic across tabs, so a narrow double-election window remains and two tabs can briefly present the same rotating token. The backend's rotation-reuse protection is what makes that safe — it revokes the whole token family — so the observable effect is a sign-out, never a privilege gain. Refreshes verify the session epoch before applying tokens, so a logout that wins the race is never undone. Failed refresh clears the local session and redirects to the appropriate sign-in route.

A newly persisted session never inherits a token from a previous one: `persistSession()` treats an absent token in an auth response as a real absence and clears it, rather than leaving the previous account's token in place. Every session-bearing auth response carries both tokens, so an absent one means the backend did not issue it.

The context restores a session on startup, clears React Query caches on login/logout, and listens for access-token removal in another browser tab. Short-lived invite, redirect, and verification state uses `sessionStorage` where the relevant flow requires it.

## Verified backend contracts (Sprint 3 full-stack audit)

Request/response shapes below were read from the Spring Boot backend (`AuthController`, `model/request/*`, `AuthServiceImpl`, `UserServiceImpl`, Flyway seed `V2__seed_default_data.sql`), not inferred from the frontend.

### Platform roles

Backend roles are database rows (`core.platform_roles`), not an enum: `USER`, `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `COMPLIANCE_ADMIN`, `SUPPORT_AGENT`, `READ_ONLY_ANALYST`. Backend authorization is **permission-based** (`@PreAuthorize("hasAuthority('…')")`), never role-name-based. Full admin-shell access on the frontend is the exact set `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `COMPLIANCE_ADMIN` (`isPlatformAdminRole`). `SUPPORT_AGENT` and `READ_ONLY_ANALYST` are legitimate platform roles whose frontend destination is deferred product behavior — they route via the standard non-admin fallback today. Frontend guards are UX protection only; backend permissions remain authoritative.

### Community roles

Backend role codes (`core.community_roles`): `COMMUNITY_OWNER`, `COMMUNITY_ADMIN`, `TREASURER`, `COLLECTIONS_OFFICER`, `VIEWER`, `COMMUNITY_MEMBER`. Membership payloads (`memberRole`/`roleCode`) always carry the canonical code; `owned` is computed server-side as `roleCode == COMMUNITY_OWNER`. There is no `MANAGER` role. Frontend matching is exact (`roleKeyword` lookup table); unknown codes fail closed. Dashboard access ⟺ `owned === true` or code ∈ `{COMMUNITY_OWNER, COMMUNITY_ADMIN}` (`isCommunityAdmin`).

### Passwords

`PATCH /api/v1/user/password` requires `{ oldPassword, newPassword, confirmPassword }` — all three, with old-password verification and new/confirm equality enforced server-side. `POST /auth/password/reset` requires `{ identifier, token, newPassword, confirmPassword }` with server-side equality and full refresh-token revocation on success. `POST /auth/register` has **no** `confirmPassword` field.

### Registration and invites

`POST /auth/register` accepts `firstName`, `lastName`, `email`, `password`, optional `phoneNumber` (+ required `phoneConfirmToken` when present), optional `phoneRegion`. The **frontend registration flow does not collect phone** (email-first); an empty phone is the normal case. Phone can be added after sign-in via Settings. It has no `inviteToken`, role, or community fields — extra fields are ignored. Invites are email-bound server-side and accepted via `PATCH /communities/invites/{inviteId}/accept`; `POST /auth/google` accepts only `{ clientToken }`, so Google sign-in during an invite flow falls back to manual acceptance on `/member/invites`. The `?token=` invite value is kept client-side until the post-auth flow completes and is never transmitted. Duplicate-email registration returns HTTP 400 ("Email is already registered"), never 409.

### Phone region

`phoneRegion` is optional everywhere, must be an ISO 3166-1 two-letter code when present, and defaults to `NG` server-side. E.164 (`+…`) input parses independently of region, so the frontend safely omits it; national-format numbers would be interpreted under the given/default region.

### Verification codes — who sends them, and who reports a failed send

There is no single "send me a code" endpoint, and **which endpoint sends depends on the flow**:

| Flow                   | Endpoint                       | Who asks for it                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration (email)   | `POST /auth/register`          | **The backend.** The code is a side effect of registering — the account has to exist first, so there is nothing to request a code for before that call returns. `POST /auth/register` answers `201` with **no tokens** (the session comes after verification). |
| Registration resend    | `POST /auth/verify/resend`     | The frontend. `401` here means "no account is registered under that email" (the backend uses 401, not 404, so it does not confirm which addresses exist).                                                                                                      |
| Passwordless sign-in   | `POST /auth/otp/request`       | The frontend. Email or SMS depending on which identifier is supplied.                                                                                                                                                                                          |
| Pre-registration phone | `POST /auth/phone/request-otp` | The frontend.                                                                                                                                                                                                                                                  |

The consequence for the UI: on the registration screens the frontend **cannot** know whether the first code was actually dispatched — `POST /auth/register` reports the account, not the mail. So those screens say **“Check Your Email”** rather than asserting a code was sent, and Resend is a first-class action whose own result _is_ reported.

`src/hooks/useOtpSend.js` is the one owner of "ask the backend to send me a code" across the OTP surfaces:

- a failed send is **toasted** and shown inline (it used to be `silent`, so a refusal looked exactly like a slow send);
- a `429` is honoured through its `Retry-After` header — the resend action stays locked for exactly as long as the server asked;
- the screen reports **what actually happened**: “Sending a code to…”, “Enter the 6-digit code sent to…”, or “We couldn't send a code to…”. A failed _resend_ after a code already went out is worded differently from a send that never happened, because the person may already be holding a working code.

**Backend caveat — the auth limiters are per-IP.** Measured against the live API (2026-10-21): `POST /auth/otp/request` allows 3 requests per window per IP, `POST /auth/verify/resend` 5, and `POST /auth/register` draws on the same kind of shared per-IP pool (the 10th call inside a couple of seconds was refused). Each answers `429` with `Retry-After`. A phone on mobile data shares one public IP with every other subscriber behind the same carrier NAT, so a signup can be refused for reasons that have nothing to do with the person tapping. `POST /auth/phone/request-otp` is already keyed **per number** (see its OpenAPI description) — the login/resend/register limiters should be keyed per identifier (email/phone) for the same reason. Until they are, the frontend's job is to make the refusal visible and actionable, which it now does.

A `429` is also the one 4xx that `src/utils/monitoring.js` reports to Sentry: it is a statement about our capacity, not about what the person typed, and a silently rate-limited signup is otherwise invisible in production.

## Proposed/future direction

Consider moving refresh-token handling to an `HttpOnly`, `Secure`, `SameSite` cookie managed by the backend, keeping access tokens out of persistent browser storage where feasible. This requires coordinated backend and deployment changes and must be threat-modeled before implementation. Do not change storage as part of documentation-only foundation work.
