# Glasspay — Community Finance Platform

Glasspay is a community finance platform. Communities (schools, cooperatives, associations, clubs) collect and track dues, payment plans, and settlements; their members pay and manage their own obligations through a mobile-first app.

This repository is the **frontend**: a Vite + React SPA covering the member app, community-admin dashboard, platform admin panel, onboarding, and public landing pages. It is deployed at **app.glasspay.app** and talks to a separate Spring Boot backend API.

---

## Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Framework  | React 19, React Router 7 (SPA)                          |
| Build      | Vite 8 (Rolldown)                                       |
| Styling    | Tailwind CSS 4 (CSS-first, no config file)              |
| State      | TanStack React Query 5                                  |
| HTTP       | Axios (interceptor-based auth refresh)                  |
| Fonts      | Fontsource (Inter, DM Sans, Playfair Display, Urbanist) |
| Charts     | Phosphor Icons, Lucide Icons                            |
| Testing    | Vitest + Testing Library (unit), Playwright (E2E)       |
| Monitoring | Sentry (optional, env-gated)                            |
| Images     | Cloudinary                                              |
| KYC        | Smile ID biometric verification                         |
| Chat       | Crisp                                                   |

---

## Getting Started

```bash
npm install
cp .env.example .env   # fill in required values
npm run dev            # starts on http://localhost:3000
```

### Environment Variables

| Variable                          | Required            | Purpose                                                                                |
| --------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`               | **Yes**             | Backend origin (e.g. `https://api.glasspay.app`). `/api/v1` is appended automatically. |
| `VITE_CLOUDINARY_CLOUD_NAME`      | **Yes**             | Cloudinary cloud name. Build fails without it.                                         |
| `VITE_TEST_MODE`                  | **Yes**             | `"true"` or `"false"` — fail-closed money-mode switch.                                 |
| `VITE_GOOGLE_CLIENT_ID`           | Google sign-in only | OAuth 2.0 Web client ID.                                                               |
| `VITE_APP_URL`                    | No                  | Public app origin (defaults to `window.location.origin`).                              |
| `VITE_CRISP_WEBSITE_ID`           | No                  | Crisp chat widget ID (disables chat if unset).                                         |
| `VITE_SENTRY_DSN`                 | Prod: yes           | Sentry error reporting.                                                                |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`  | No                  | 0–1, defaults to `0.1`.                                                                |
| `VITE_FLAGS`                      | No                  | JSON feature flags (e.g. `{"paymentsDisabled":true}`).                                 |
| `VITE_SMILE_ENV` / `VITE_SMILE_*` | No                  | Smile ID KYC browser SDK config.                                                       |

---

## Scripts

| Command                      | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `npm run dev`                | Start Vite dev server                                 |
| `npm run build`              | Production build (runs env guard first)               |
| `npm run preview`            | Serve the production build locally                    |
| `npm run lint`               | ESLint                                                |
| `npm run format`             | Prettier write                                        |
| `npm run format:check`       | Prettier check                                        |
| `npm run typecheck`          | TypeScript check                                      |
| `npm run test`               | Vitest (single run)                                   |
| `npm run test:watch`         | Vitest (watch mode)                                   |
| `npm run test:coverage`      | Vitest with coverage thresholds                       |
| `npm run test:e2e`           | Playwright E2E                                        |
| `npm run audit:endpoints`    | Frontend calls vs backend OpenAPI                     |
| `npm run check:landing-sync` | Diff shared landing components against marketing repo |
| `npm run probe:idempotency`  | Live double-charge probe (needs credentials)          |

---

## Project Structure

```
src/
├── api/            # Axios modules, one per backend resource
├── components/     # Shared UI (dashboard, marketing, common)
├── hooks/          # React Query hooks wrapping api/
├── layouts/        # Route-level layout shells
├── pages/          # Route components
│   ├── auth/           # Sign in / sign up / verification
│   ├── onboarding/     # Owner onboarding
│   ├── dashboard/      # Community-admin + platform admin
│   ├── memberApp/      # Member-facing mobile-first app
│   └── ...
├── routes/         # Route guards (auth, device, role)
├── services/       # Auth payload builders + thin wrappers
├── store/          # AuthContext (session source of truth)
├── utils/          # Shared helpers
└── __tests__/      # Vitest tests mirroring src/
```

---

## Architecture Overview

### Two-Repo Setup

| Repo                         | Deploys to         | Purpose                                    |
| ---------------------------- | ------------------ | ------------------------------------------ |
| `glass-waitlist` (this repo) | `app.glasspay.app` | The product — auth, dashboards, member app |
| `glass-waitlist-v1`          | `glasspay.app`     | Marketing site only                        |

Landing components in this repo are the **source of truth** but do not auto-sync to the marketing repo. Cross-domain navigation goes through `goToApp()` (`src/utils/deviceRedirect.js`), never raw `navigate()`.

### Authorization Model

- **Platform roles:** `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `COMPLIANCE_ADMIN` grant platform-wide admin access.
- **Community roles:** `COMMUNITY_OWNER`, `COMMUNITY_ADMIN` grant community management access. `TREASURER`, `COLLECTIONS_OFFICER`, `VIEWER`, `COMMUNITY_MEMBER` do not.
- **Guards** (`src/routes/`) are UX/access-routing only. The **backend is the authority** for permissions.

### Session System

Token refresh is single-flight with cross-tab lease coordination (`src/api/refreshCoordinator.js`). A logout that wins a race is never undone by an in-flight refresh. See `docs/authentication.md`.

---

## Domain Glossary

| Term              | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| **Community**     | Top-level entity (school, cooperative, association).                |
| **Member**        | A user belonging to a community who owes/pays money.                |
| **Admin / Owner** | A member with management rights over a community.                   |
| **Payment plan**  | A recurring or one-time due set up for members.                     |
| **Obligation**    | One instance of a member owing against a plan.                      |
| **Payment link**  | The underlying payable object created from a plan.                  |
| **Transaction**   | A record of money moving (completed, failed, pending).              |
| **Authorisation** | A saved card with auto-charge consent.                              |
| **Settlement**    | Payout of collected funds to a community's bank account.            |
| **KYC**           | Identity verification (Smile ID) required for community management. |

---

## Contributing

1. Create a short-lived `feature/` or `fix/` branch from `main`.
2. Run the full validation suite before opening a PR:

   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
   ```

3. Open a PR into `main` using the repo template (summary, test plan, checklist).
4. Use [Conventional Commits](https://www.conventionalcommits.org/) style subjects.
5. Never commit directly to `main`.

---

## Documentation

Detailed docs live in [`docs/`](docs/):

- [`docs/authentication.md`](docs/authentication.md) — Session lifecycle, refresh flow, backend contracts
- [`docs/authorization.md`](docs/authorization.md) — Authorization model
- [`docs/kyc.md`](docs/kyc.md) — Smile ID KYC integration
- [`docs/payments.md`](docs/payments.md) — Payment flow, idempotency
- [`docs/account-verification.md`](docs/account-verification.md) — Account/phone verification
- [`docs/testing-strategy.md`](docs/testing-strategy.md) — Testing approach
- [`docs/architecture.md`](docs/architecture.md) — Architecture overview
- [`docs/error-handling.md`](docs/error-handling.md) — Error handling patterns
- [`docs/data-fetching.md`](docs/data-fetching.md) — React Query data fetching patterns
