# Landing drift: what `check:landing-sync` reports, and what to do about it

`npm run check:landing-sync` compares every file present in **both** this repo and
`glass-waitlist-v1` under a shared path and requires them to be byte-identical. This file
records what it currently reports, because the answer is not "nothing to do" — the check
exits `1` on purpose.

Two buckets, and the difference matters:

- **Allowlisted** (13 files) — permanently different by design. Listed in
  `INTENTIONALLY_DIVERGENT` in `scripts/check-landing-sync.mjs`, each with its reason. Do not
  "fix" these by copying; they are correct as they are.
- **Real drift** (20 files) — genuine unported changes or missed migrations. These fail the
  check on purpose.

Measured against both repos' `origin/main` on 2026-10-19.

## Bucket A — real drift, grouped by cause

### A1. Design-token migration not ported (9 files)

The app replaced raw hex with `var(--color-*)` tokens. The marketing site still carries the
pre-migration hex. This matters beyond tidiness: the marketing repo's own
`docs/design-system.md` bans off-palette hex values, so these files currently violate the
spec they are supposed to follow.

| File                                                      | app tokens | v1 tokens | app hex | v1 hex |
| --------------------------------------------------------- | ---------- | --------- | ------- | ------ |
| `organizations/dashboard-overlay/TopBar.jsx`              | 19         | 0         | 1       | 20     |
| `organizations/dashboard-overlay/StatsRow.jsx`            | 18         | 0         | 2       | 20     |
| `organizations/dashboard-overlay/RecentActivityPanel.jsx` | 15         | 0         | 3       | 18     |
| `organizations/dashboard-overlay/PaymentPlansPanel.jsx`   | 13         | 0         | 2       | 15     |
| `organizations/dashboard-overlay/NavRail.jsx`             | 10         | 0         | 0       | 10     |
| `organizations/dashboard-overlay/SidebarNav.jsx`          | 10         | 0         | 3       | 13     |
| `organizations/dashboard-overlay/DashboardOverlay.jsx`    | 8          | 0         | 3       | 6      |
| `organizations/dashboard-overlay/constants.js`            | 4          | 0         | 1       | 5      |
| `members/MembersProblem.jsx`                              | 5          | 0         | 17      | 31     |

**Direction: app → marketing site.** The marketing site cannot resolve these tokens until it
defines them in `src/index.css`, so treat this as one piece of work: add the token set, then
port. `StatsRow`/`TopBar` also carry `#9ca3af`, a Tailwind gray that is not on the sanctioned
palette.

### A2. `CloudImage` migration not ported (6 files)

The app moved from hand-built `{ src, srcSet }` objects (`cldUrl` + a width ladder at every
call site) to a `<CloudImage publicId width>` component. The marketing site is pre-migration
and still calls `cldUrl`/`cldSrcSet` inline.

- `src/lib/cloudinary.js` — still exports the `blur` option the app removed, and lacks the
  app's `widthsFor()` / `WIDTH_STEPS` exports.
- `src/components/common/CloudImage.jsx` — still the old blurred-placeholder version; the app
  dropped the placeholder fetch and crossfade.
- `src/components/common/BrandedSpinner.jsx`
- `src/components/legal/LegalPageLayout.jsx`
- `src/components/organizations/OurSolution.jsx`
- `src/components/members/MembersSolution.jsx`

**Direction: app → marketing site.** Note `CloudAspectImage.jsx` is app-only and a port will
need it too (it is not currently a shared path, so the checker does not see it).

### A3. Smaller unported changes (5 files)

| File                                              | What is behind                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/Button.jsx`                    | Missing the `sm-tight` size (app added it 2026-10-12 for the dashboard button-sizing sweep). v1 documents "five sizes" where the app documents six. **Decide first:** `sm-tight` is documented as being for dashboard/page-header CTAs; the marketing site has page-level CTAs, so it may be wanted — but it is a design decision, not a mechanical port. |
| `src/components/organizations/ProblemSection.jsx` | v1 carries 149 raw hex vs the app's 144, plus the marketing-only keyboard affordances on the step list. Port the token changes; **keep** the `tabIndex`/`onKeyDown` (the app has no such affordance).                                                                                                                                                     |
| `src/components/common/SolutionSection.jsx`       | v1 has 6 raw hex vs the app's 3 — pre-migration leftovers.                                                                                                                                                                                                                                                                                                |
| `src/components/common/CTASection.jsx`            | Doc-comment drift only (the app added a header describing `buttonHoverVariant`).                                                                                                                                                                                                                                                                          |
| `src/components/ui/VariableProximity.jsx`         | Doc-comment drift only (the app added an explanatory comment above the rAF loop).                                                                                                                                                                                                                                                                         |

## Bucket B — allowlisted, do not "fix"

| File                                                                                  | Why it can never match                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel.json`                                                                         | Marketing redirects `/sign-in`, `/invite`… to `app.glasspay.app` and carries a report-only CSP; the app carries the endpoint-audit rewrite and the enforcing CSP with hashes.               |
| `eslint.config.js`                                                                    | `react-refresh` 0.4.x vs 0.5.x — the option names differ, so a byte-copy fails schema validation. The app also has the `pendo` global and a Node-tooling override the marketing repo lacks. |
| `src/utils/deviceRedirect.js`                                                         | `APP_ORIGIN` falls back to `window.location.origin` here (single-domain dev, invite links resolve) and is pinned to `https://app.glasspay.app` there.                                       |
| `src/utils/monitoring.js`                                                             | `@sentry/core` 10.x vs 11.x. The v11 `dataCollection` block carries three keys v10 silently drops, so the marketing copy ports only the five its SDK applies.                               |
| `src/pages/legal/{PrivacyPolicy,TermsOfService,RefundPolicy,AcceptableUsePolicy}.jsx` | Marketing needs per-route canonical/OG metadata (`useSeoMeta`); the app only sets a title (`usePageTitle`).                                                                                 |
| `src/components/members/MembersCTA.jsx`                                               | `goToApp()` cross-origin hop (+ `isRedirecting`) vs in-app `navigate()`.                                                                                                                    |
| `src/components/members/MembersHero.jsx`                                              | Marketing runs its own `PhoneHeroDemo`; the app uses `CloudAspectImage` + `mobileRequiredPath()`.                                                                                           |
| `src/components/members/MembersHowItWorks.jsx`                                        | Marketing renders `members/MembersHowItWorksSection`; the app renders the shared `howItWorks/HowItWorksSection`.                                                                            |
| `src/components/organizations/GetStarted.jsx`                                         | Same split — `organizations/OrganizationHowItWorks` vs `howItWorks/HowItWorksSection`.                                                                                                      |
| `src/components/organizations/Hero.jsx`                                               | Forced by layout: `Reveal.jsx` sits at `components/Reveal.jsx` in marketing and `components/organizations/Reveal.jsx` here, so the import path must differ.                                 |

## Known gap: `docs/design-system.md` is not checked

It is deliberately **not** in the script's `SHARED_ROOTS`. It is an adapted fork, not a
mirror: the app carries a §9.7 for dashboard settings rows that do not exist on the marketing
site, which is why the footer watermark is §9.7 there and §9.8 here. A byte-identity rule
could never pass for it. It is covered by a warning block inside the document instead — so it
has no automated guard at all, and its drift is invisible to this check. Worth a periodic
manual read if the marketing site keeps diverging.

## Suggested order

1. **A1 + A2 together** — define the `--color-*` tokens in the marketing `src/index.css`, then
   port the token migration and the `CloudImage` migration. Both are prerequisites for
   clearing the bulk of the list.
2. **A3 comment-only files** (`CTASection`, `VariableProximity`) — trivial, clear the noise.
3. **`Button.jsx` `sm-tight`** — get a design decision first; it is not a mechanical port.
4. **Re-run `npm run check:landing-sync`** with the sibling checked out next to this repo. It
   will still exit 1 until all of the above is ported; that is the intended signal.
