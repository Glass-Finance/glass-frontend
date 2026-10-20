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

## Proposed/future direction

Consider moving refresh-token handling to an `HttpOnly`, `Secure`, `SameSite` cookie managed by the backend, keeping access tokens out of persistent browser storage where feasible. This requires coordinated backend and deployment changes and must be threat-modeled before implementation. Do not change storage as part of documentation-only foundation work.
