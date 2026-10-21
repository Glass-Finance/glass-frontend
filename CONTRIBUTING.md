# Contributing

Working agreements with other contributors (branch/PR flow, who owns coverage floors and ADRs, how to avoid colliding on shared infra) live in [`docs/team-conventions.md`](docs/team-conventions.md).

## Code conventions

- Keep application code in JavaScript/JSX. Use the existing React and Vite patterns; do not introduce TypeScript requirements.
- Use PascalCase for React components, camelCase for functions and variables, and descriptive names for hooks beginning with `use`.
- Keep imports grouped by external packages, internal modules, and relative utilities when practical. Remove unused imports.
- Put backend request functions in `src/api/` and expose server state to components through React Query hooks.
- Handle loading, empty, success, validation, authorization, and request-error states explicitly. Use existing error helpers and notifications rather than exposing raw responses.

## Security

Found something that looks like a vulnerability? Report it privately — see [`SECURITY.md`](SECURITY.md). Please do not open a public issue for it.

When you touch the session system, the role checks, or the CSP, read
[`docs/authentication.md`](docs/authentication.md),
[`docs/authorization.md`](docs/authorization.md) and
[`docs/decisions/ADR-002-auth-storage.md`](docs/decisions/ADR-002-auth-storage.md)
first. Those invariants are load-bearing, and a change that looks like a
simplification is often the thing that breaks them.

## Testing and checks

Add focused Vitest/Testing Library coverage for changed logic and user-visible states. Mock API modules at the boundary; never require production credentials. Touching a payment flow? Extend the E2E coverage in `e2e/` too — it pins same-`idempotencyKey` retry behaviour through the real browser. Before opening a PR, run the same checks CI does, in the same order: `npm audit --audit-level=high`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run audit:endpoints -- --strict`, `npm run build` and `npm run verify:pwa`. If you cloned `glass-waitlist-v1` next to this repo, also run `npm run check:landing-sync` after touching shared landing components.

## Git workflow

Create a short-lived `feature/*`, `fix/*`, `chore/*` or `refactor/*` branch from `main`. Open a pull request into `main` and wait for required CI checks before merging. Do not work directly on `main`. Keep commits small and use imperative conventional-commit subjects such as `feat:`, `fix:`, `chore:`, `ci:`, and `docs:`.

Keep PRs focused, describe the behavior and verification steps, and call out follow-up work or known testing gaps. Use the repository pull request template and preserve the existing Dependabot workflow.
