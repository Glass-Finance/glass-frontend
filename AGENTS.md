# AGENTS.md

Frontend-only Vite 8 + React 19 SPA (`src/main.jsx` → `src/App.jsx`): member app, community-admin dashboard, platform-admin panel, onboarding, and public landing pages. No backend, database, or migrations live here — the app talks to a separate Spring Boot API (`VITE_API_BASE_URL` + `/api/v1`, see `src/api/client.js`).

## Commands

```bash
npm install
cp .env.example .env   # then fill in VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID
npm run dev            # Vite dev server
```

Validate in CI order (`.github/workflows/ci.yml`) before opening a PR:

```bash
npm audit --audit-level=high && npm run format:check && npm run lint && npm run typecheck \
  && npm run test:coverage && npm run audit:endpoints -- --strict && npm run build && npm run verify:pwa
```

Focused test: `npx vitest run src/__tests__/path/to.test.js` (suite runs plain `vitest run`, jsdom). Tests live in `src/__tests__/` mirroring `src/`; mock API modules at the boundary, never require prod credentials.

### Local pace gates (default)

The CI battery above runs in CI on every PR — it is not what you run locally for each task. The default local gate is:

```bash
npx prettier --write <changed files> && npm run lint && npm run typecheck \
  && npx vitest run <tests touching the changed files>   # B: no local e2e unless the task is a UI flow
```

- **A — no full suite locally by default.** Run `npm run test` only when the change is shared/cross-cutting (utils, hooks, components/common, routing) or when explicitly asked; CI is the safety net for everything else.
- **B — no local Playwright** unless the task is specifically a UI flow; CI runs `e2e/`.
- **C — pipeline, don't serialize.** Commit and push as soon as the local gate is green, then let CI run in parallel; poll the check-runs once (~2 min) instead of in a loop. Full `npm run build` only when the change touches `vite.config.js`, PWA (`src/sw.js`), or env/config.

The slow path (full CI battery locally, repeated CI polling, e2e repros for non-UI bugs) is reserved for release cuts or when explicitly requested.

The suite used to be pinned to `--pool=forks --maxWorkers=1`, serialised, which took ~21 min for 148 files. That was never a deliberate decision — it arrived in `51ecd6c` ("chore: add prettier formatting") alongside an unrelated reformat, and no commit or doc explains it. Vitest's default `isolate: true` already gives every file a fresh module registry and jsdom, so serialising bought nothing but wall-clock. The scripts are now plain `vitest run` and let Vitest size the pool itself; don't reintroduce a fixed worker count without measuring memory first, since each forked worker carries its own jsdom.

`testTimeout` is raised to 15s (Vitest's default is 5s) for the tests that pull modules in with `await import(...)` inside the test body — 58 such imports across 20 files, all of which bill module loading against the timeout. This is not slack for slow tests; `communityListConsumers.test.jsx` sat right on the 5s boundary and failed intermittently even serialised.

If you see cross-file state leakage, fix the leaking test before reaching for `isolate: false` — that is where the real flakiness lives.

```bash
npm run audit:endpoints                    # frontend calls vs the backend's real routes (OpenAPI)
npm run audit:endpoints -- --unconnected    # + backend routes nothing calls yet (roadmap view)
npm run audit:endpoints -- --strict         # non-zero exit on drift; CI runs it this way
```

A call to a route the backend doesn't have type-checks, lints, builds and unit-tests clean, so nothing else catches it. Run this after touching anything in `src/api/`, and before claiming an endpoint is wired. `--unconnected` is the roadmap view; the script's `PENDING_BACKEND` list exists for routes whose 404 is deliberately tolerated, and every entry there owes a reason.

## Where things live

- `src/api/` — Axios resource modules. **Components** never call these directly; expose server state via React Query hooks in `src/hooks/`. (Pages may call `src/api/` directly for mutations — a page owns the action. Reads always belong in a hook.) Enforced by `no-restricted-imports` in `eslint.config.js`. See `docs/data-fetching.md`.
- `src/pages/` — route components (`auth/`, `onboarding/`, `dashboard/`, `memberApp/`). All route wiring + lazy loading in `src/App.jsx`.
- `src/routes/` — `ProtectedRoute`, `MemberProtectedRoute`, `MemberDeviceGuard`, `CommunityAdminGuard`, `PlatformAdminRoute`. Read these before touching routing. Guards are UX/access-routing only; backend permissions are authoritative.
- `src/services/` — auth payload builders + thin endpoint wrappers (`authPayloads.js`, `authService.js`). Build auth payloads with the builders; don't hand-roll request shapes.
- `src/store/AuthContext.jsx` — session source of truth. See `docs/authentication.md`.
- `docs/` — architecture, auth, authorization, payments, account/phone/KYC flows, community record book, data-fetching, error-handling, testing strategy, PWA, Cloudinary, landing drift, ADRs and runbooks. The index is `docs/README.md`. Check the relevant file before inventing a pattern.
- **`docs/design-system.md` — the design source of truth** (colours, radii, button roles/sizes/states), extracted from the Figma file "Glass Design By AQ". Check it before choosing any colour, radius or button classes; it lists the banned values too. It is the only copy — there is no `DESIGN-SYSTEM.md` at the repo root or the workspace root, and there never was.
- **Sign-in accepts an email or phone number (one identifier field); phone is added later in Settings (copy = Add, not Verify)** — `docs/account-verification.md`.
- **KYC (Smile ID)** — `docs/kyc.md`.
- `docs/team-conventions.md` — human team working agreements (PR flow, ownership of coverage floors / ADRs / AGENTS.md, e2e mocking preferences, how to avoid parallel-infra collisions). Read when coordinating with other contributors.

## Rules agents violate most

- **Do not touch the session system without cause.** Single-flight refresh, cross-tab refresh lease, session-epoch invalidation, and rotation-reuse protection are load-bearing (`AuthContext.jsx`, `src/api/client.js`). A logout that wins a race must never be undone by an in-flight refresh.
- **Roles are exact backend codes, not keywords.** Platform admin shell ⟺ `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `COMPLIANCE_ADMIN` (`isPlatformAdminRole`). Community dashboard ⟺ `owned === true` or `COMMUNITY_OWNER`/`COMMUNITY_ADMIN` (`isCommunityAdmin`). There is no `MANAGER` role. Unknown codes fail closed. Verified against the backend in `docs/authentication.md`.
- **Registration contract quirks (backend-verified):** `POST /auth/register` has no `confirmPassword` field; duplicate email returns **400**, never 409; `phoneRegion` is optional (defaults to `NG` server-side); `POST /auth/google` accepts only `{ clientToken }`, so Google sign-in during an invite flow falls back to manual acceptance on `/member/invites`. Never transmit the `?token=` invite value.
- **Two repos, two deploys:** this repo → `app.glasspay.app`; `glass-waitlist-v1` → `glasspay.app` (marketing). Landing components here are the source of truth but do **not** auto-sync — re-port changes or flag the drift in the PR. Cross-domain navigation goes through `goToApp()` (`src/utils/deviceRedirect.js`), never raw `navigate()`.
- **Payments:** verify endpoint is async (queues a job, returns current DB status, often `INITIATED`) — poll, don't treat the first response as final; a premature `FAILED` can later correct to `SUCCESSFUL`. Payment-status interpretation belongs in the centralized status module; don't scatter new literals. See `docs/payments.md` and `docs/decisions/ADR-004-payment-idempotency.md`.
- **Inline `<script>` edits in `index.html`** invalidate a `sha256-` entry in `vercel.json`: run `npm run build`, then `node scripts/compute-csp-hashes.mjs`, and swap in the hash. Google Identity Services hashes come from live CSP reports, not that script — don't remove them.
- **Input focus uses a border colour change, not a focus ring.** Preserve semantic error/success focus colours where explicitly required. Canonical example: `src/components/ui/TextInput.jsx` (`focus:border-brand`). Don't add `focus:ring-*`, `focus-within:ring-*`, or a focus background fill — the brand-coloured ring reads as a second edge outside the border. For a borderless composite control (search box, chip container) use `focus-within:border-brand`, adding a resting `border border-transparent` first if the element has no border so focus doesn't shift layout. Form controls are the documented exception to the global `:focus-visible` outline in `src/index.css` (unlayered, so it outranks both utilities and the `@layer base` safety net for `border-color`); buttons and links keep that outline.
- **Every form control needs an accessible name.** jsx-a11y cannot catch a control with no label (its rule checks the other direction), so `npm run check:input-labels` gates it and runs in CI. Prefer the shared `TextInput`'s `label` prop, which renders a bound `<label htmlFor>`; otherwise bind a `<label htmlFor="…">` to an `id`, or give the control an `aria-label`. A placeholder is not an accessible name. See `docs/testing-strategy.md`.
- **JS-only app code** (`allowJs`, `checkJs: false`); Tailwind v4 CSS-first theme in `src/index.css` (no `tailwind.config.js`); fonts via `@fontsource` imports in `main.jsx`, never CSS `@import`.
- **Colour, radius and buttons come from `docs/design-system.md`** (extracted from Figma "Glass Design By AQ"). Never introduce a hex that isn't listed there — especially not `#2547d0`, `#2535c3`, `#7c3aed`, `#4f46e5`, `#dc2626` or the six invented navies. Radius is 4px (`rounded-g-1`) at every state; radius 4/8/12/16 is the whole scale. Buttons go through `ui/Button` (`variant` × `size`), not raw `<button>` with bespoke classes — a raw `<button>` needs a reason. This is enforced by `no-restricted-syntax` in `eslint.config.js`: a new file that reaches for a raw `<button>` fails lint. The files still carrying one are listed in `RAW_BUTTON_DEBT` in that config; remove a file from that list when you migrate it to `ui/Button`.

## Workflow

Short-lived `feature/*`, `fix/*`, `chore/*` or `refactor/*` branch → PR into `main` with the repo PR template (summary, test plan, checklist, screenshots for UI). Conventional-commit subjects. Never commit directly to `main`; keep dependency updates in their own PRs.

**Commit messages carry no AI co-author trailers.** No `Co-Authored-By:` line for an assistant, model or agent — credit the human author only. This is a project decision, not a default to be overridden per-commit. History rewritten before this rule landed still has trailers on a handful of commits; those are left alone deliberately, because stripping them means force-pushing shared `main` and rewriting a colleague's commit for no change to any code. Don't repeat that.
