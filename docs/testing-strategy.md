# Testing Strategy

## Current baseline

Vitest runs in a jsdom environment through `vite.config.js`. Testing Library is used for React components. Existing tests cover pure utilities, payment and recurring-schedule logic, React Query hooks, authentication-related pages, payment pages, admin components, route guards, session/expiry behavior, and selected member and community-admin flows.

Tests are colocated under `src/__tests__/` and use `*.test.js` or `*.test.jsx`. The suite is primarily unit and component-level; it does not replace manual verification against the real backend because this repository has no local backend or sandbox.

**Unit suite:** 199 test files, 1923 tests (2026-10-21).

## Type checking

`npm run typecheck` runs two passes: the original `tsc --noEmit` over `src`, plus `tsconfig.check.json` which enables `checkJs` for `src/utils`, `src/api`, and `src/lib` (the pure-logic core). When a directory is type-clean, widen the `include` in `tsconfig.check.json` to cover the next slice of the app.

The next slice is **`src/hooks`** — the hooks are the most type-shaped code in the repo and the highest-value thing to check. It is not included yet, and the reason is measured rather than assumed: adding `src/hooks/**/*.js` to the `include` currently produces **192 type errors across ~40 files** (2026-10-20). Most of them are the same shape — an API payload destructured out of an untyped default (`const { paymentLinkId } = raw ?? {}`) collapses to `{}` in TypeScript, so every property access on it errors. Fixing them means adding JSDoc types to the API layer and the hook signatures, which touches the session store (`AuthContext.jsx`, `services/authPayloads.js`, `services/authService.js`) among others. That is its own change, with its own review, and it does not belong in a change that is about something else.

Two settings in `tsconfig.check.json` are also deliberately relaxed relative to the base config: `noImplicitAny: false` and `noUncheckedIndexedAccess: false`. They were added to let the first slice pass and are still there. They should come off as part of the same work as the widening — they undo two of the strictest settings `tsconfig.json` turns on.

The one TypeScript file in the codebase, `src/utils/format.ts`, is fully type-checked by the base `tsc --noEmit` pass (a `.ts` file is always checked, `checkJs` only governs `.js`). It is linted through Babel's TypeScript preset rather than `typescript-eslint`, because `typescript-eslint` refuses to load against TypeScript 7 — the version this repo runs — and its supported range stops below TS 7.

## Accessibility lint

ESLint runs `eslint-plugin-jsx-a11y` recommended rules. Five rules with large pre-existing backlogs are currently disabled (`label-has-associated-control`, `click-events-have-key-events`, `no-static-element-interactions`, `no-autofocus`, `no-noninteractive-element-interactions`) — **174 findings across 71 files**, measured 2026-10-21 (down from 224 across 76 files on 2026-10-20: binding the remaining `<label htmlFor>` to their controls cleared 50 of the 94 `label-has-associated-control` findings). Re-enable them incrementally as the backlog is fixed; every other a11y rule is error-level.

**Re-measuring the counts.** These numbers drift, and two hand-maintained copies of a count is how they drift unnoticed. To get the current figures, write a temporary config that re-enables the five rules over the base config and count the JSON output:

```js
// eslint.a11y-audit.config.js
import base from "./eslint.config.js";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...base,
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
    },
  },
]);
```

```bash
npx eslint . --config eslint.a11y-audit.config.js -f json -o a11y.json
```

Update the numbers here and in the comment in `eslint.config.js` in the same commit.

## Input accessible names

`npm run check:input-labels` fails the build if any form control in the app has no accessible name. It runs in CI as its own step, before lint.

**Why it exists when jsx-a11y already runs.** jsx-a11y cannot catch this direction of the problem. Its `label-has-associated-control` rule checks that a `<label>` **has** a control; it says nothing about a control **having** a label. Its `control-has-associated-label` rule applies only to custom components, so a native `<input>` with no name passes lint cleanly. A placeholder is not an accessible name — it disappears on focus and is not reliably announced.

**What it measured.** Before this check existed, **80 controls across 33 files** had no accessible name: 69 raw `<input>` elements and 11 `<TextInput>` call sites. The raw inputs were mostly fields whose visible `<label>` was a sibling element with no `htmlFor`, so the label was visually attached but programmatically orphaned — a screen reader announced "edit text, blank" for every one of them.

**How it decides.** A control is named when it has an `aria-label`, an `aria-labelledby` pointing at an id that exists, an `id` matched by a `<label htmlFor>` (including the shared `<Label>` component in `components/auth/FormFields.jsx`), or is wrapped inside a `<label>`. The scanner reads the JSX source directly; `scripts/scan-input-labels.mjs` and its test (`src/__tests__/config/inputLabelScanner.test.js`) are the implementation.

**How to add a named field.** The shared `TextInput` owns the association, so prefer its `label` prop:

```jsx
// Visible label, rendered by TextInput itself.
<TextInput label="Amount" type="number" />

// Label already on screen elsewhere in the layout: bind it explicitly.
<label htmlFor="group-name">Name</label>
<TextInput id="group-name" />
```

`TextInput` generates a selector-safe id when the caller passes none, so a field can never end up without one. For a raw `<input>`, give it an `aria-label` (placeholder-only fields such as search boxes) or bind a `<label htmlFor>` to it.

## Coverage

`npm run test:coverage` runs Vitest with the v8 provider over `src/**/*.{js,jsx}`. Test files (`src/__tests__/**`), entry points (`src/main.jsx`, `src/App.jsx`), and dev-only pages (`src/pages/dev/**`) are excluded; `e2e/**` is excluded from Vitest entirely (Playwright owns it). Reports are written to `coverage/` in `text`, `text-summary`, `html`, `lcov`, and `json-summary` formats — the summaries for quick reading, `html` for local drill-down, `lcov` for badges/future CI reporting.

Baseline, measured on the suite as it stands (2026-10-20): **statements 48.64%, branches 49.46%, functions 43.57%, lines 49.72%** — with `src/utils/**` at 65.00 / 72.12 / 71.32 / 64.47 and `src/api/**` at 77.86 / 82.52 / 45.75 / 84.58 (statements / branches / functions / lines).

The figures previously recorded here (32.11% statements and so on) were measured during the original testing sprints and had been overtaken by the suite without the baseline being re-taken. Regenerate them from `coverage/coverage-summary.json` after any run that moves the numbers materially.

Thresholds (`vite.config.js` → `test.coverage.thresholds`) are regression gates, enforced on every `test:coverage` run:

| Scope          | Statements | Functions | Lines | Branches |
| -------------- | ---------- | --------- | ----- | -------- |
| Global         | ≥ 47%      | ≥ 42%     | ≥ 48% | ≥ 47%    |
| `src/utils/**` | ≥ 63%      | ≥ 69%     | ≥ 62% | ≥ 70%    |
| `src/api/**`   | ≥ 76%      | ≥ 44%     | ≥ 82% | ≥ 80%    |

The floors were raised on 2026-10-20. They had been set when the suite's measured coverage was around 20%, and by then the suite was at 48.6% statements — so a 19% floor had been gating almost nothing for a long time. The current floors sit about two points below the measured values, which leaves room for ordinary fluctuation while still failing if coverage is allowed to slide.

Raise them when adding tests, never lower them to make CI green.

## Expectations

Add focused tests for changed pure logic, hook behavior, route guards, and user-visible error or loading states. Mock API modules at the boundary. Keep tests deterministic and independent of real credentials or production services. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, `npm run test:e2e`, and `npm run build` before opening a PR.

## End-to-end

Playwright lives under `e2e/` (`npm run test:e2e`) as **9 spec files with 72 tests** (measured 2026-10-20), all named `*.spec.js`. Everything runs against a locally spawned Vite dev server (`127.0.0.1:4173`, `playwright.config.js` → `webServer`, which injects the public `VITE_*` build env — including `VITE_TEST_MODE=true` as a fail-safe so a stray unmocked payment call can never reach live keys). No test contacts a real backend, a payment provider, or any credential; no secrets are involved.

**Counts.** `npx playwright test --list` reports the authoritative numbers — it lists every test against both projects, so the total is double the number that actually run:

```bash
npx playwright test --list
```

| Spec file                         | Listed tests            |
| --------------------------------- | ----------------------- |
| `record-book.spec.js`             | 38                      |
| `auth.spec.js`                    | 8                       |
| `admin-mobile-responsive.spec.js` | 6                       |
| `guards.spec.js`                  | 6                       |
| `landing.spec.js`                 | 4                       |
| `payment-callback.spec.js`        | 4                       |
| `admin-mutation.spec.js`          | 2                       |
| `payment-idempotency.spec.js`     | 2                       |
| `payment-initiation.spec.js`      | 2                       |
| **Total**                         | **72** (36 per project) |

**Projects.** Two Chromium projects mirror the product's device split:

- `desktop-chromium` (Desktop Chrome) — the admin/dashboard/public surface: `auth.spec.js` (sign-in success landing in the platform admin shell with the documented login payload; rejected-credentials pre-auth error copy; logout; session expiry hard-redirect + toast), `admin-mutation.spec.js` (suspend-user confirmation modal → exact PATCH body → refetched row), `payment-callback.spec.js` (verify settling into SUCCESSFUL and FAILED, asserted admin-side where FAILED is terminal), `landing.spec.js` (public landing and `/sign-in` render without a backend), `admin-mobile-responsive.spec.js` (the admin surface at mobile widths), and the desktop half of `guards.spec.js` (unauthenticated `/dashboard` → `/sign-in`; desktop hitting a member route → `/member/mobile-required`).
- `mobile-chromium` (Pixel 7) — the member app, which `MemberDeviceGuard` gates to mobile: `payment-initiation.spec.js` (seeded member opens a payment link, clicks Make Payment, reaches the provider boundary — asserting the `POST /payments/pay/payment-links/{id}` payload with an idempotency key, against a local stub of the Paystack authorization page), `payment-idempotency.spec.js` (a retried failed payment reuses the same `idempotencyKey` on the same mounted Payment Summary), the mobile half of `guards.spec.js` (unauthenticated `/member/home` → `/member/app-sign-in`), and `record-book.spec.js` (the community record book, its responsive layout and its AI-usage settings).

Each test executes in exactly one project: the specs carry `test.skip(testInfo.project.name !== ...)` guards. A correct run therefore reports **36 passed** plus 36 project-scoped skips (each test skipped in the project it doesn't belong to) — never fewer passes than 36, which would indicate a mis-scoped test running nowhere.

**Mocking.** Two complementary, fully local mechanisms:

- `e2e/support.js` — a single catch-all dispatcher (used by the auth/admin/callback/initiation specs): every request whose pathname starts with `/api/v1` is answered right here, whether the app's API base is the absolute `https://api.glasspay.app` or a same-origin `/api/v1` (CORS headers and preflights are handled for the absolute case); the Paystack authorization URL is served a local stub page; our own dev server passes through; everything else outside it (Pendo, Google Identity Services, Sentry, Vercel, Cloudinary) is aborted. Personas seed sessions with a sessionStorage guard so hard navigations (the session-expiry redirect) cannot resurrect cleared tokens, and first-run dashboard tours are suppressed via their localStorage seen-flag (UI preference, not behavior under test).
- Inline `page.route` mocks inside `guards.spec.js`, `landing.spec.js`, and `payment-idempotency.spec.js` — endpoint-specific fixtures plus selective third-party aborts.

**CI.** The dedicated `e2e` job in `.github/workflows/ci.yml` runs in isolation alongside the build job: `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e`, with retries, first-retry traces, an HTML report, and the `playwright-report/` artifact uploaded (7-day retention) on failure. The build job separately gates format, lint, typecheck, the Vitest suite, `npm audit --audit-level=high`, the production build (which requires `VITE_API_BASE_URL`/`VITE_TEST_MODE` and smoke-checks the shipped bundle), and `npm run verify:pwa` — which executes the built service worker in a mocked `ServiceWorkerGlobalScope` and drives real fetch events through it, so a broken worker fails the pull request instead of production.

## Gaps for later sprints

- Same `idempotencyKey` twice → one real charge end-to-end (client send/reuse is unit-tested in `paymentIdempotencyContract.test.js` and pinned in mocked E2E; the live probe is `npm run probe:idempotency` and needs a real token — see `scripts/probe-payment-idempotency.mjs`).
- Broader route-guard coverage, API error-state coverage, auth refresh behavior.
- Re-enable the five disabled jsx-a11y rules as their backlog clears (224 findings, 76 files — measured 2026-10-20).
- Widen `tsconfig.check.json` `include` to `src/hooks` and drop the `noImplicitAny: false` / `noUncheckedIndexedAccess: false` relaxations. The hooks slice currently costs 192 type errors across ~40 files; see "Type checking" above for what that work involves and why it is its own change.
- Migrate the files still on a raw `<button>` (the `RAW_BUTTON_DEBT` list in `eslint.config.js`) onto `ui/Button`, and drop them from that list as they land. The list is the ratchet: a new file that reaches for a raw `<button>` fails lint today.
- Optionally consolidate the inline `page.route` specs onto the `support.js` dispatcher so one mocking mechanism serves the whole suite.
