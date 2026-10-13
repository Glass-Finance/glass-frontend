---
name: Regression Testing
description: Run this repository's validation gates in CI order, interpret failures without weakening a gate, and report results honestly. Use before claiming any change is done, when a test or build fails, or when deciding what to run locally.
---

# Regression Testing

## The CI order

Run these in this order and stop at the first genuine failure. This is the
order `.github/workflows/ci.yml` uses in its build job.

```bash
npm audit --audit-level=high && npm run format:check && npm run lint \
  && npm run typecheck && npm run test:coverage \
  && npm run audit:endpoints -- --strict && npm run build
```

`npm run test:coverage` is not optional. The coverage thresholds live in
`vite.config.js` and `npm run test` alone never evaluates them, so running the
plain suite gates nothing.

The dependency audit runs first in CI and is easy to forget locally; a green
test run says nothing about a high-severity advisory having landed in the
lockfile.

The endpoint audit also runs on every pull request, not conditionally. Its
`--strict` mode fails only on `UNMATCHED` routes — a route the backend does not
have. `PENDING` and `UNCONNECTED` are reported but never fail the build, which
is deliberate so an unlanded backend deploy does not block a frontend change.

`npm run test:e2e` runs in the separate CI `e2e` job, not the build job. Add it
locally when the change touches e2e specs or payments:

```bash
npm run test:e2e
```

A single focused test is `npx vitest run src/__tests__/path/to.test.js`.

## Gates you may not weaken

- **Coverage floors are regression gates, not targets.** They live in
  `vite.config.js` under `test.coverage.thresholds`. Raise them when adding
  tests; never lower one to make CI green. Ownership of the floors belongs to
  the testing lead — propose a change by PR with rationale, never inside an
  unrelated change.
- **Do not reintroduce a serial test pool.** The suite was once pinned to
  `--pool=forks --maxWorkers=1` and took about 21 minutes across 148 files.
  That was accidental, not a decision. Vitest's default `isolate: true`
  already gives every file a fresh module registry and jsdom. Do not pin a
  worker count without measuring memory first, because each forked worker
  carries its own jsdom.
- **`testTimeout` is 15 seconds on purpose.** Forty-seven `await import(...)`
  calls across 17 files sit inside test bodies and all bill module loading
  against the timeout. This is not slack for slow tests.
- **Fix the leaking test, not the isolation setting.** If cross-file state
  leakage appears, `isolate: false` is where the real flakiness hides.
- **Do not disable an ESLint rule to make a gate pass.** Five
  `jsx-a11y` rules are already disabled against a known backlog; adding to
  that list is a separate, agreed decision.

## Build requirements

`npm run build` runs environment guards and refuses to build without
`VITE_API_BASE_URL`, `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_TEST_MODE`. A
missing API base points the app at the wrong backend, and a missing
`VITE_TEST_MODE` has previously shipped a live-money default. Use the values
in `.env.example`; these are public build values, not secrets.

## Test expectations

- Tests live in `src/__tests__/`, mirroring `src/`, named `*.test.js` or
  `*.test.jsx`.
- Mock API modules at the boundary. Never require production credentials.
- Add focused coverage for changed pure logic, hook behaviour, route guards,
  and user-visible error or loading states.
- Consolidate overlapping tests rather than keeping near-duplicates.
- Enum and status coverage uses a predicate matrix: every backend literal,
  case variants, and nullish inputs.
- Keep `src/__tests__/hooks/*CacheShape.test.jsx` green; list pages share
  `content` / `totalElements` / `number` / `size`.

## End-to-end notes

Playwright owns `e2e/**`; Vitest excludes it. Two Chromium projects split the
product: `desktop-chromium` for admin, dashboard and public surfaces, and
`mobile-chromium` on Pixel 7 for the member app gated by `MemberDeviceGuard`.
Each test runs in exactly one project via a
`test.skip(testInfo.project.name !== ...)` guard.

A correct run therefore reports the full expected pass count **plus** one
project-scoped skip per test. Fewer passes than that means a test is scoped to
no project and is running nowhere — that is a real failure, not a green run.

The preferred mocking mechanism is the shared `e2e/support.js` catch-all
dispatcher. Inline `page.route` is acceptable for endpoint-specific cases.

`npm run test:e2e` spawns browsers and is deliberately **not** in the
no-prompt allowlist in `opencode.jsonc`. Same for
`npm run probe:idempotency`, which reaches the live backend and needs a real
token.

## Common rationalizations

- _"The tests pass, so the suite is fine."_ The plain `npm run test` never
  evaluates the coverage thresholds.
- _"I'll lower the floor by a point so CI is green."_ That converts a
  regression gate into a decoration.
- _"This test is flaky, so let me re-run it."_ A test that fails
  intermittently is a defect. `communityListConsumers.test.jsx` sat on the
  timeout boundary and failed intermittently until it was fixed properly.
- _"Serialising the suite will make it pass."_ That change cost roughly 21
  minutes and bought nothing.
- _"I'll bump the timeout to 60s."_ The 15 seconds is a real requirement, not a
  number to raise when a test is slow.
- _"Format is unrelated to this change."_ It is a blocking CI gate, and the
  working tree may contain someone else's edits. Run `prettier --write` on the
  specific paths changed, never across the tree.
- _"The endpoint audit is advisory."_ CI runs it with `--strict` and it fails
  the build on drift.

## Red flags

- A coverage threshold edited in the same change that touches application code.
- `--maxWorkers`, `--no-isolate` or `isolate: false` added to a test script.
- `testTimeout` raised in `vite.config.js`.
- A new `.skip`, `.only` or `xit` introduced to get past a failure.
- An ESLint rule moved into the disabled list.
- A new test that reads a real credential, host or network endpoint.
- Reporting a partial suite as a pass because the failures "look unrelated".
- `npm audit fix` or `npm install` run as part of a verification pass.

## Verification

Before reporting results, confirm that:

- Every gate in the CI order ran, or the one that was skipped is named with a
  reason.
- The first failure is reported as a failure, with the exact command and the
  failing assertion.
- No threshold, timeout, pool setting or lint rule was changed to obtain a
  pass.
- The working tree contains no changes from the verification run itself.
- Anything left failing is stated plainly, with the exact error, rather than
  described as passing or passing "for the most part".
