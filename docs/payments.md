# Payments

## Current behavior

Payment API wrappers live primarily in `src/api/members.js` and `src/api/payments.js`. React Query mutations initiate payment-link payments, then invalidate obligation and transaction queries. Payment pages handle the processor redirect and call the backend verification endpoint using the returned reference. Saved payment authorizations support auto-pay flows.

Payment initiation sends an `idempotencyKey`, amount, obligation information, and payment metadata. Member and admin payment UI components create a UUID for the active payment attempt and reuse it for retries within that mounted flow.

The live OpenAPI spec (`/v3/api-docs/springdocDefault`) confirms the backend **requires** `idempotencyKey` on `InitializePaymentRequest` (`required: ["idempotencyKey"]`) and **persists** it (`TransactionResponse.idempotencyKey`). **Backend confirmed (2026-09-23):** a repeated key returns the original result (or a conflict) and never initializes a second charge — double-charge via retry is not possible end-to-end given the client reuses one key per attempt (see ADR-004).

The browser does not directly implement settlement, ledger, or processor-side authorization. Those behaviors belong to the backend and processor integration.

### Plan terms: amount mode, visibility, audience

A payment plan's terms (`amountMode`, `visibility`, `audience`, `memberIds`) are editable in both plan modals — `CreatePlanModal` (wizard step 2) and `EditPlanModal`. The rules come from the backend **service** (`CollectionPaymentSupport.validatePaymentTypeAmount`), not from `UpsertPaymentLinkRequest`: the DTO marks `amountMode` `@NotNull` and leaves `amount` un-annotated, which misleadingly suggests amount is always optional.

- **`amountMode` is constrained by plan type.** `RECURRING` accepts `FIXED` and nothing else; `ONE_TIME` accepts all four (`FIXED`, `MINIMUM`, `SUGGESTED`, `VARIABLE`). The selector only ever offers the allowed set, and `resolveAmountMode` clamps at submit time for the wizard path that can otherwise carry a stale choice (pick `VARIABLE` on a one-time plan → go Back → switch to Recurring).
- **Amount is required for `FIXED`/`MINIMUM`/`SUGGESTED`, optional for `VARIABLE`.** A blank `VARIABLE` amount is a real state: the service maps a null amount to `0` via `resolvedAmountMinor`. On the edit path the payload sends an explicit `amount: 0` rather than omitting it, because the PATCH handler substitutes the _stored_ amount when `amount` is absent — omitting it would make "clear the amount" a silent no-op.
- A server-configured collection minimum additionally applies to the three non-variable modes. That value lives in backend system config, is deliberately not duplicated client-side, and surfaces as a 400.
- **`audience: SELECTED_MEMBERS` sends `memberIds`**, which are **community-member record ids** (`member.id`), not user ids — the backend resolves them with `findAllByCommunity_IdAndIdIn` and 400s on anything it can't find. A `SELECTED_MEMBERS` plan with an empty selection is blocked client-side: the PATCH path rejects it server-side, but the **create path does not** and would silently produce a plan that bills nobody.
- `visibility: PRIVATE` requires a non-empty audience server-side (`validatePrivateAudience`).
- `audience: GROUP` is **not** offered: it needs the community-groups endpoints, which this app has no surface for, and the backend rejects a GROUP audience with no `groupIds`.
- `shapePlan` in `usePaymentPlans` passes all four through; the edit modal hydrates from them. Omitting a field on PATCH leaves the stored value alone, so the modal re-sends the current terms on every save.

## Residual follow-up

Run `npm run probe:idempotency` once with production credentials to capture a live PASS artifact. Client-side reuse is covered by unit + E2E tests (`e2e/payment-idempotency.spec.js`).
