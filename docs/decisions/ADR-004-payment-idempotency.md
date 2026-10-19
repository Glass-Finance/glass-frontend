# ADR-004: Payment Idempotency

- Status: Accepted — backend confirmed; client reuses one key per attempt; duplicate-key replay returns the original result and never initializes a second charge
- Date: 2026-09-10
- Updated: 2026-09-23 (backend confirmation of replay behavior)

## Context

Payment initiation can be retried after a timeout or redirect interruption. Duplicate payment creation must not result from a repeated user action or network retry.

## Current decision and behavior

The frontend generates a UUID per active payment attempt and sends it as `idempotencyKey` to the payment initiation endpoint. The same key is reused by the mounted payment flow.

Server-side contract, from the live OpenAPI spec (`/v3/api-docs/springdocDefault`, OAS 3.1):

- `InitializePaymentRequest` (body of `POST /api/v1/payments/pay/payment-links/{paymentLinkIdentifier}`) declares `idempotencyKey` as a **required** string (`minLength: 1`) — requests without it fail validation.
- `TransactionResponse` echoes `idempotencyKey`, so the backend **persists** the key on the transaction record rather than discarding it.

**Backend confirmation (2026-09-23):** a repeated `idempotencyKey` returns the original transaction/initialization result (or a conflict) and does **not** initialize a second charge. This closes the open question from the live-spec review.

## Tooling in this repo

- `npm run probe:idempotency` (`scripts/probe-payment-idempotency.mjs`) — fires the same key twice against the live API and prints PASS/FAIL (needs `GLASSPAY_TOKEN` + `GLASSPAY_PAYMENT_LINK`; does not open checkout, so no money moves).
- `npm run test:e2e` (`e2e/payment-idempotency.spec.js`) — proves the client reuses one key across a fail-and-retry in a real browser.
- `src/__tests__/api/paymentIdempotencyContract.test.js` — pins the OpenAPI required/minLength contract (set `RUN_LIVE_API_DOCS=1` to also re-fetch the live spec).

## Residual follow-up

Run the live probe once against production credentials to capture a concrete PASS artifact for reconciliation/support workflows — the backend answer is confirmed, the probe just proves it end-to-end from this client.
