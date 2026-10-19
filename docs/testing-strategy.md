# Testing Strategy

## Current baseline

Vitest runs in a jsdom environment through `vite.config.js`. Testing Library is used for React components. Existing tests cover pure utilities, payment and recurring-schedule logic, React Query hooks, authentication-related pages, payment pages, admin components, route guards, session/expiry behavior, and selected member and community-admin flows.

Tests are colocated under `src/__tests__/` and use `*.test.js` or `*.test.jsx`. The suite is primarily unit and component-level; it does not replace manual verification against the real backend because this repository has no local backend or sandbox.

## Type checking

`npm run typecheck` runs two passes: the original `tsc --noEmit` over `src`, plus `tsconfig.check.json` which enables `checkJs` for `src/utils`, `src/api`, and `src/lib` (the pure-logic core). When a directory is type-clean, widen the `include` in `tsconfig.check.json` to cover the next slice of the app.

## Accessibility lint

ESLint runs `eslint-plugin-jsx-a11y` recommended rules. Five rules with large pre-existing backlogs are currently disabled (`label-has-associated-control`, `click-events-have-key-events`, `no-static-element-interactions`, `no-autofocus`, `no-noninteractive-element-interactions` — 195 findings at time of writing). Re-enable them incrementally as the backlog is fixed; every other a11y rule is error-level.

## Coverage

`npm run test:coverage` runs Vitest with the v8 provider over `src/**/*.{js,jsx}`. Test files (`src/__tests__/**`), entry points (`src/main.jsx`, `src/App.jsx`), and dev-only pages (`src/pages/dev/**`) are excluded; `e2e/**` is excluded from Vitest entirely (Playwright owns it). Reports are written to `coverage/` in `text`, `text-summary`, `html`, `lcov`, and `json-summary` formats — the summaries for quick reading, `html` for local drill-down, `lcov` for badges/future CI reporting.

Baseline after the testing sprints (measured on the merged suite): **statements 32.11%, branches 29.69%, functions 26.56%, lines 33.04%** — up from the pre-sprint baseline of 19.82% statements / 17.01% branches / 14.59% functions / 20.19% lines.

Thresholds (`vite.config.js` → `test.coverage.thresholds`) are regression gates, enforced on every `test:coverage` run:

| Scope          | Statements | Functions | Lines | Branches |
| -------------- | ---------- | --------- | ----- | -------- |
| Global         | ≥ 19%      | ≥ 14%     | ≥ 19% | ≥ 16%    |
| `src/utils/**` | ≥ 49%      | ≥ 43%     | ≥ 48% | ≥ 53%    |
| `src/api/**`   | ≥ 50%      | ≥ 27%     | ≥ 50% | ≥ 50%    |

Floors are intentionally modest relative to the current baseline — raise them when adding tests, never lower them to make CI green.

## Expectations

Add focused tests for changed pure logic, hook behavior, route guards, and user-visible error or loading states. Mock API modules at the boundary. Keep tests deterministic and independent of real credentials or production services. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run test:e2e`, and `npm run build` before opening a PR.

## End-to-end

Playwright lives under `e2e/` (`npm run test:e2e`) as **7 spec files with 14 tests**, all named `*.spec.js`. Everything runs against a locally spawned Vite dev server (`127.0.0.1:4173`, `playwright.config.js` → `webServer`, which injects the public `VITE_*` build env — including `VITE_TEST_MODE=true` as a fail-safe so a stray unmocked payment call can never reach live keys). No test contacts a real backend, a payment provider, or any credential; no secrets are involved.

**Projects.** Two Chromium projects mirror the product's device split:

- `desktop-chromium` (Desktop Chrome) — the admin/dashboard/public surface: `auth.spec.js` (4 tests: sign-in success landing in the platform admin shell with the documented login payload; rejected-credentials pre-auth error copy; logout; session expiry hard-redirect + toast), `admin-mutation.spec.js` (1: suspend-user confirmation modal → exact PATCH body → refetched row), `payment-callback.spec.js` (2: verify settling into SUCCESSFUL and FAILED, asserted admin-side where FAILED is terminal), `landing.spec.js` (2: public landing and `/sign-in` render without a backend), and the two desktop tests in `guards.spec.js` (unauthenticated `/dashboard` → `/sign-in`; desktop hitting a member route → `/member/mobile-required`).
- `mobile-chromium` (Pixel 7) — the member app, which `MemberDeviceGuard` gates to mobile: `payment-initiation.e2e.js` → `payment-initiation.spec.js` (1: seeded member opens a payment link, clicks Make Payment, reaches the provider boundary — asserting the `POST /payments/pay/payment-links/{id}` payload with an idempotency key, against a local stub of the Paystack authorization page), `payment-idempotency.spec.js` (1: a retried failed payment reuses the same `idempotencyKey` on the same mounted Payment Summary), and the mobile test in `guards.spec.js` (unauthenticated `/member/home` → `/member/app-sign-in`).

Each test executes in exactly one project: `guards.spec.js`, `landing.spec.js`, and `payment-idempotency.spec.js` carry `test.skip(testInfo.project.name !== ...)` guards, as do our auth/admin/callback/initiation tests. A correct run therefore reports **14 passed** plus 14 project-scoped skips (each test skipped in the project it doesn't belong to) — never fewer passes than 14, which would indicate a mis-scoped test running nowhere.

**Mocking.** Two complementary, fully local mechanisms:

- `e2e/support.js` — a single catch-all dispatcher (used by the auth/admin/callback/initiation specs): every request whose pathname starts with `/api/v1` is answered right here, whether the app's API base is the absolute `https://api.glasspay.app` or a same-origin `/api/v1` (CORS headers and preflights are handled for the absolute case); the Paystack authorization URL is served a local stub page; our own dev server passes through; everything else outside it (Pendo, Google Identity Services, Sentry, Vercel, Cloudinary) is aborted. Personas seed sessions with a sessionStorage guard so hard navigations (the session-expiry redirect) cannot resurrect cleared tokens, and first-run dashboard tours are suppressed via their localStorage seen-flag (UI preference, not behavior under test).
- Inline `page.route` mocks inside `guards.spec.js`, `landing.spec.js`, and `payment-idempotency.spec.js` — endpoint-specific fixtures plus selective third-party aborts.

**CI.** The dedicated `e2e` job in `.github/workflows/ci.yml` runs in isolation alongside the build job: `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e`, with retries, first-retry traces, an HTML report, and the `playwright-report/` artifact uploaded (7-day retention) on failure. The build job separately gates format, lint, typecheck, the Vitest suite, `npm audit --audit-level=high`, and the production build (which requires `VITE_API_BASE_URL`/`VITE_TEST_MODE` and smoke-checks the shipped bundle).

## Gaps for later sprints

- Same `idempotencyKey` twice → one real charge end-to-end (client send/reuse is unit-tested in `paymentIdempotencyContract.test.js` and pinned in mocked E2E; the live probe is `npm run probe:idempotency` and needs a real token — see `scripts/probe-payment-idempotency.mjs`).
- Broader route-guard coverage, API error-state coverage, auth refresh behavior.
- Re-enable the five disabled jsx-a11y rules as their backlog clears.
- Widen `tsconfig.check.json` `include` beyond utils/api/lib.
- Optionally consolidate the inline `page.route` specs onto the `support.js` dispatcher so one mocking mechanism serves the whole suite.
