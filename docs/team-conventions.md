# Team Conventions

Shared working agreements across the frontend (`Glass-Finance/glass-waitlist`) and marketing (`glass-waitlist-v1`) repos. Complements `AGENTS.md` (agent rules), `CONTRIBUTING.md` (PR mechanics), and the ADRs under `decisions/` (architecture law). When any of these disagree with an ADR or `AGENTS.md`, the ADR / `AGENTS.md` wins.

## Git & PRs

- Short-lived `feature/*`, `fix/*`, `chore/*`, `refactor/*` branch → PR into `main`. **No direct pushes to `main`** while someone else has an open PR — check `git log --oneline -5` / open PRs first.
- Conventional-commit subjects: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`, `refactor:`, `style:`. Non-trivial changes get a body explaining **why**, what invariants were preserved, and how it was verified.
- Batch related work into sprint-sized PRs; sync `docs/` at sprint boundaries.
- If a refactor risks eating in-flight edits, branch to preserve them (the `chore/preserve-refactor-edits` pattern) rather than force-resolving over them.
- **Do not rewrite `main` history to tidy cosmetic duplicates.** PR #77 has duplicate merge history in `main` (`e69f886`, `4af6e5c`); both produce the identical tree `dff43c2`, and the later merge introduced no additional content. It is intentionally retained: rewriting would force-push every commit since `d1d9fc3` and disrupt active branches and clones for no functional benefit. Treat it as historical/cosmetic debt, not a defect to fix.

## Architecture (ADR-001..004 — settled)

- **React Query 5** for server state; Axios request functions only in `src/api/`; component-facing state only through `src/hooks/`. Never call Axios from render logic.
- **Layered folders** stay: `api → hooks → services → store → routes → pages / layouts / components / utils`. Domain folders only when ownership is unclear without them.
- **JavaScript/JSX only** — no TypeScript migration (ADR-003). `checkJs` runs on `src/utils`, `src/api`, `src/lib` via `tsconfig.check.json`.
- **Auth storage** is `localStorage` today (ADR-002: current, not preferred). Cookie migration is deferred pending a shared web+mobile backend decision — do not half-implement cookies on the frontend alone.
- **Idempotency**: one UUID per active payment attempt, reused across retries on the same mounted flow (ADR-004, backend-confirmed).

## Code patterns

- **Centralize interpretation** — status literals in `src/utils/paymentStatus.js`, roles in `platformRole` / `communityRole`, auth payloads in `services/authPayloads`, session keys in `store/sessionStorage.js`. Do not scatter new literals or role keywords.
- **Fail-closed auth** — guards require `sessionVerified`; unknown roles fail closed; exact backend role codes only (`SUPER_ADMIN`, `OPERATIONS_ADMIN`, `COMPLIANCE_ADMIN`, `COMMUNITY_OWNER`, `COMMUNITY_ADMIN`). See `AGENTS.md` and `docs/authentication.md`.
- **Session lifecycle is load-bearing** — single-flight refresh, cross-tab refresh lease, session-epoch invalidation. Do not touch without cause (see `AGENTS.md`).
- **React Query cache shapes** — list pages share `content` / `totalElements` / `number` / `size`. Keep shapes aligned; keep `src/__tests__/hooks/*CacheShape.test.jsx` green. Clear cache on login/logout.
- **Pure utils with rationale headers** — long file-level comments explaining why (see `paymentStatus.js`). Behavior-preserving refactors must say so and leave tests unmodified unless assertions change intentionally.
- **Backend is authoritative** — frontend guards are UX routing only (`docs/authorization.md`). Never invent permission policy client-side.

## Docs

- Index lives in `docs/README.md`. Every doc splits **Current behavior** vs **Proposed/future direction** — never blur the two.
- Architecture decisions get an ADR: `Status / Date / Context / Decision / Consequences` (+ follow-ups). Update the Status line when reality changes (e.g. ADR-004 → Accepted).
- Verified backend contracts belong in `docs/authentication.md` / `docs/payments.md`, not folklore.
- `AGENTS.md` is the agent rulebook — read it before any AI-assisted change; update it when conventions change.

## Testing

### Unit / component (Vitest)

- Layout: tests mirror `src/` under `src/__tests__/**` as `*.test.js` / `*.test.jsx`.
- Testing Library for components; mock API modules at the boundary; never require production credentials.
- Integration journeys go in `src/__tests__/integration/`.
- **Consolidate overlapping tests** rather than keeping near-duplicates (idempotency tests live in `PaymentSummary.test.jsx`, not a parallel file).
- Enum/status coverage: predicate-matrix style — every backend literal, case variants, nullish inputs.
- Coverage: `npm run test:coverage` (v8). **Threshold ownership belongs to the testing lead** — raise floors when adding tests; never lower them to green CI; don't raise them in an unrelated PR without agreement.

### E2E (Playwright)

- Specs in `e2e/*.spec.js`; Vitest excludes `e2e/**` (`vite.config.js`).
- Two projects: `desktop-chromium` (admin/public) and `mobile-chromium` / Pixel 7 (member app, `MemberDeviceGuard`). Each test runs in exactly one project via `test.skip(testInfo.project.name !== ...)`.
- Harness: local Vite on `127.0.0.1:4173` with injected public `VITE_*` (including `VITE_TEST_MODE=true`). No real backend, provider, or secrets.
- Preferred mocking: shared `e2e/support.js` catch-all dispatcher (personas, `/api/v1` CORS, Paystack stub, third-party aborts). Inline `page.route` only for endpoint-specific cases; consolidating onto `support.js` is welcome.
- Run: `npm run test:e2e`. CI job is the isolated `e2e` job in `.github/workflows/ci.yml` (not inline in the build job).

## Tooling

- **Prettier** enforced (`npm run format:check` in CI). Format before push.
- **LF line endings only** (`.gitattributes`); `.editorconfig` respected.
- **ESLint** includes `jsx-a11y` recommended minus five debt-listed rules (see `docs/testing-strategy.md`).
- Dependency audit: `npm audit --audit-level=high` in CI; keep it at 0 high+ when possible.

## Parallel work — avoiding collisions

1. Before adding infra (test harness, CI job, lint/coverage stack), check open branches/PRs touching the same files. Two people designing the same layer ~hours apart is how the e2e stack forked once already.
2. If both sides already built something, **merge explicitly and document the resolution in the merge commit** (who won for config files, why) — the `0eaac8a` pattern — so nothing feels silently reverted.
3. UI spacing/typography follows Figma tightly; don't "clean up" modal/button pixels without the design source.
4. Coverage floors, `AGENTS.md`, ADRs, and `docs/testing-strategy.md` are conventionally owned by the testing/architecture lead — propose changes via PR with rationale.

## Quick checklist before a PR

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
# if touching e2e or payments:
npm run test:e2e
# if adding tests:
npm run test:coverage
# if landing components changed and v1 is cloned:
npm run check:landing-sync
```
