# Testing Strategy

## Current baseline

Vitest runs in a jsdom environment through `vite.config.js`. Testing Library is used for React components. Existing tests cover pure utilities, payment and recurring-schedule logic, React Query hooks, authentication-related pages, payment pages, admin components, route guards, session/expiry behavior, and selected member and community-admin flows.

Tests are colocated under `src/__tests__/` and use `*.test.js` or `*.test.jsx`. The suite is primarily unit and component-level; it does not replace manual verification against the real backend because this repository has no local backend or sandbox.

## Type checking

`npm run typecheck` runs two passes: the original `tsc --noEmit` over `src`, plus `tsconfig.check.json` which enables `checkJs` for `src/utils`, `src/api`, and `src/lib` (the pure-logic core). When a directory is type-clean, widen the `include` in `tsconfig.check.json` to cover the next slice of the app.

## Accessibility lint

ESLint runs `eslint-plugin-jsx-a11y` recommended rules. Five rules with large pre-existing backlogs are currently disabled (`label-has-associated-control`, `click-events-have-key-events`, `no-static-element-interactions`, `no-autofocus`, `no-noninteractive-element-interactions` — 195 findings at time of writing). Re-enable them incrementally as the backlog is fixed; every other a11y rule is error-level.

## Coverage

`npm run test:coverage` runs Vitest with the v8 provider over `src/**/*.{js,jsx}`. Test files (`src/__tests__/**`), entry points (`src/main.jsx`, `src/App.jsx`), and dev-only pages (`src/pages/dev/**`) are excluded. Reports are written to `coverage/` in `text`, `text-summary`, `html`, `lcov`, and `json-summary` formats — the summaries for quick reading, `html` for local drill-down, `lcov` for badges/future CI reporting.

Baseline after the testing sprints (measured on the merged suite): **statements 32.11%, branches 29.69%, functions 26.56%, lines 33.04%** — up from the pre-sprint baseline of 19.82% statements / 17.01% branches / 14.59% functions / 20.19% lines.

Thresholds (`vite.config.js` → `test.coverage.thresholds`) are regression gates, enforced on every `test:coverage` run:

| Scope          | Statements | Functions | Lines | Branches |
| -------------- | ---------- | --------- | ----- | -------- |
| Global         | ≥ 19%      | ≥ 14%     | ≥ 19% | ≥ 16%    |
| `src/utils/**` | ≥ 49%      | ≥ 43%     | ≥ 48% | ≥ 53%    |
| `src/api/**`   | ≥ 50%      | ≥ 27%     | ≥ 50% | ≥ 50%    |

Floors are intentionally modest relative to the current baseline — raise them when adding tests, never lower them to make CI green.

## Expectations

Add focused tests for changed pure logic, hook behavior, route guards, and user-visible error or loading states. Mock API modules at the boundary. Keep tests deterministic and independent of real credentials or production services. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`, and `npm run build` before opening a PR.

## Browser verification

Manually verify responsive layouts, keyboard interaction, authentication, and payment flows against an appropriate test environment. Vitest and Testing Library provide automated unit, component, and integration coverage; they do not establish that a deployed backend or provider flow works.

## Gaps for later sprints

- Same `idempotencyKey` twice → one real charge end-to-end. Client send/reuse is unit-tested in `paymentIdempotencyContract.test.js` and `PaymentSummary.test.jsx`; the live probe is `npm run probe:idempotency` and needs a real token — see `scripts/probe-payment-idempotency.mjs`.
- Broader route-guard coverage, API error-state coverage, auth refresh behavior.
- Re-enable the five disabled jsx-a11y rules as their backlog clears.
- Widen `tsconfig.check.json` `include` beyond utils/api/lib.
