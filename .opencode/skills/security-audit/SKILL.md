---
name: Security Audit
description: Read-only security review of the frontend surface — auth and session lifecycle, role handling, secrets and CSP, payment-flow integrity. Produces a findings report and changes nothing. Use when reviewing a change for security risk, or when touching src/store, src/api, auth, roles, payments or vercel.json.
---

# Security Audit

This is a review, not a change. Produce findings and stop. Do not edit files,
install dependencies, modify lockfiles, or contact any live service.

## Three tiers

Every recommendation falls into exactly one tier. State which tier it is in.

### Always do — no exceptions

- Treat the session lifecycle as load-bearing. Single-flight refresh, the
  cross-tab refresh lease, session-epoch invalidation and rotation-reuse
  protection are interdependent; see `src/store/AuthContext.jsx`,
  `src/store/sessionStorage.js`, `src/api/client.js` and
  `src/api/refreshCoordinator.js`. A logout that wins a race must never be
  undone by an in-flight refresh.
- Keep auth storage in `localStorage`. ADR-002 records this as the current,
  not-preferred state, and cookie migration is deferred pending a shared
  web+mobile backend decision. **Do not half-implement cookies on the frontend
  alone.** Flagging the storage mechanism is in scope; migrating it is not.
- Fail closed on roles. Platform-admin shell means `SUPER_ADMIN`,
  `OPERATIONS_ADMIN` or `COMPLIANCE_ADMIN`. Community dashboard means
  `owned === true`, `COMMUNITY_OWNER` or `COMMUNITY_ADMIN`. There is no
  `MANAGER` role, and unknown codes are denied.
- Keep `.env` gitignored and keep credentials out of tests. Tests mock API
  modules at the boundary and must never need a real secret or a production
  host.
- Centralise interpretation. Payment status literals belong in the
  `src/utils/paymentStatus.js` module, role checks in the `platformRole` /
  `communityRole` helpers, session keys in `store/sessionStorage.js`. New
  scattered literals or role keywords are findings.
- Frontend guards are UX routing only. The backend is authoritative for
  permissions; never invent client-side permission policy
  (`docs/authorization.md`).

### Ask first — requires a human decision

- Any change to the session system, even an apparent simplification.
- Reading `.env` values. The permission posture requires approval; use
  `.env.example` when the template is enough.
- Anything that reaches a live backend, payment provider or identity service.
  This repository has no local backend and no sandbox.
- Broadening a CSP hash in `vercel.json`.
- Adding or upgrading a dependency.

### Never

- Never report a finding by fixing it inline. That converts a review into an
  unreviewed change.
- Never weaken a guard to make a flow work.
- Never transmit the `?token=` invite value.
- Never strip a CSP hash to silence a console error.

## Specific surfaces

### Registration and sign-in contracts

Backend-verified; drift here is a real defect:

- `POST /auth/register` has **no** `confirmPassword` field.
- A duplicate email returns **400**, never 409.
- `phoneRegion` is optional and defaults to `NG` server-side.
- `POST /auth/google` accepts only `{ clientToken }`, so Google sign-in during
  an invite flow falls back to manual acceptance on `/member/invites`.
- Sign-in takes one identifier field: email **or** phone. Phone is added later
  in Settings, and the copy there is "Add", not "Verify"
  (`docs/account-verification.md`).

### Secrets, CSP and headers

- `.env` is gitignored; `.env.example` is the template and is safe to read.
- Editing an inline `<script>` in `index.html` invalidates a `sha256-` entry in
  `vercel.json`. The correct sequence is `npm run build`, then
  `node scripts/compute-csp-hashes.mjs`, then swap the hash in.
- Google Identity Services hashes come from live CSP reports, not from that
  script. Do not remove them on the assumption they are stale.
- `vercel.json` headers are a security control. Treat any weakening as
  high severity.

### Payments

- The verify endpoint is asynchronous: it queues a job and returns the current
  database status, often `INITIATED`. The first response is not final.
- A premature `FAILED` can later correct to `SUCCESSFUL`. Polling is
  required; treating a single response as terminal is a bug.
- One idempotency key per active payment attempt, reused across retries on the
  same mounted flow (ADR-004, `docs/decisions/ADR-004-payment-idempotency.md`).
  A new key per retry risks a double charge.
- `npm run probe:idempotency` reaches the live backend. Never run it as part of
  an audit.

### Endpoint drift

Run `npm run audit:endpoints -- --strict`. A call to a route the backend does
not have type-checks, lints, builds and passes unit tests exactly like a real
call, so nothing else reports it. Every entry in the script's
`PENDING_BACKEND` list owes a written reason.

## Common rationalizations

- _"The session code looks redundant, so it is probably safe to simplify."_
  The apparent redundancy is the single-flight and epoch logic. A logout that
  wins a race must not be undone by an in-flight refresh.
- _"localStorage is not a secure place for tokens."_ Correct in the abstract,
  and it is already recorded in ADR-002 as not-preferred with a deliberate
  deferral. Re-raising it as a critical finding on every audit is noise; the
  decision belongs to the backend migration.
- _"The audit passed, so the dependency is safe."_ Package audits only match
  known advisories. They do not detect a newly published malicious package or
  a typosquatted name, and they say nothing about install scripts.
- _"The guard is client-side, so it is not a real control."_ Correct, and
  `docs/authorization.md` already says so. The finding is that the backend must
  enforce it, not that the guard should be removed.
- _"This is only a refactor."_ Refactors move auth and payment code too.
- _"CI is green, so it is secure."_ CI runs format, lint, typecheck, coverage
  gates, a high+ dependency audit and a route audit. None of those is a
  security review.

## Red flags

- New `localStorage` or `sessionStorage` keys outside `sessionStorage.js`.
- A guard whose role comparison uses substring or keyword matching.
- A new payment status string literal outside the central status module.
- Secrets, tokens or real hosts appearing in test files or fixtures.
- A CSP entry removed, or a `sha256-` hash left stale after a script edit.
- An `onError` handler added that duplicates the global mutation toast.
- Any route relying on the client-controlled `?community=` parameter without
  the inner `CommunityAdminGuard`.
- An endpoint added to `PENDING_BACKEND` with no reason recorded.

## Verification

Before delivering a report, confirm that:

- Nothing was edited, installed, or committed.
- No live backend, payment provider or identity service was contacted.
- Each finding cites a file and line, states severity, and explains the risk
  in terms of what an attacker gains — not just what looks untidy.
- Session-system findings were checked against `src/api/client.js` and
  `src/store/AuthContext.jsx` together, not one in isolation, because the
  correctness of each depends on the other.
- Any finding about token storage or cookie migration cites ADR-002 and is
  framed as a deferred architectural decision rather than a defect.
- Findings that turn out to be the documented current state were dropped
  rather than reported as issues.
