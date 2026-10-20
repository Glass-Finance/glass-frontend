# Data Fetching

## Current architecture

API modules under `src/api/` expose Axios request functions. React Query hooks under `src/hooks/` call those functions and define query keys, enabled conditions, mutations, and invalidation. Components consume hook state rather than calling Axios directly in render logic.

The shared Axios client adds the API base path, JSON headers, timeout, access-token authorization, refresh handling, and session-expiry behavior. Query caches are cleared when a user logs in or logs out so one user's cached data is not reused by another session.

## Conventions

Use a resource-specific API wrapper, then a React Query hook for component-facing server state. Keep query keys stable and include identifiers that scope the data, such as community or resource IDs. Invalidate the smallest affected query families after mutations. Treat loading, empty, error, and success states as separate UI states.

**Where the API boundary sits, precisely.**

- **Components never import `src/api/`.** Server state reaches a component through a hook in `src/hooks/`, and the hook owns the cache, the dedupe and the refetch. This is enforced: `eslint.config.js` raises `no-restricted-imports` for `src/components/**`.
- **Pages may call `src/api/` directly for mutations.** A page owns an action ("create this community", "delete that obligation"), and calling the API module for it is the intended shape. Reads still belong in a hook — a page that renders a list should read it through one.
- **Hooks may call `src/api/` freely.** That is their job.

## Proposed/future architecture

A shared query-key factory and typed API contract would reduce key drift and make cache invalidation easier to audit. This is future work; application code remains JavaScript/JSX for this sprint, with one deliberate exception: `src/utils/format.ts` is TypeScript (a `.ts` file is always type-checked, and its branded types make a minor-unit/major-unit mix-up a compile error).
