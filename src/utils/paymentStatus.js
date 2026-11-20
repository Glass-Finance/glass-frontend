// Payment/transaction/obligation status semantics.
//
// Every backend status literal the frontend interprets, in one place. These
// are pure classifiers (status -> boolean): they never fetch, never mutate,
// and depend on nothing. Data-shaping normalization (e.g. SUCCESSFUL -> PAID)
// stays in `src/hooks/payments/shape.js`; display labels stay with their
// components.
//
// Each set mirrors exactly what the call sites checked before consolidation:
//   - Transactions collect/count as paid on SUCCESS, SUCCESSFUL, or PAID.
//   - The verify endpoint's own success vocabulary is SUCCESS/SUCCESSFUL —
//     PAID is an obligation status and never appears there.
//   - Obligations read as paid on PAID or SUCCESSFUL. The backend obligation
//     enum is PAID/DUE/OVERDUE/WAIVED (see src/api/payments.js), so the
//     SUCCESSFUL arm only ever fires defensively.
//   - Failure is FAILED everywhere it is checked; overdue is OVERDUE.
// Plan-lifecycle statuses (ACTIVE/EXPIRED/DELETED), export-job states,
// payout-account verification, and notification-type tables are different
// axes and deliberately live elsewhere.
//
// All predicates accept raw or shaped statuses in any case. Case folding is
// intentional, not invented: the backend emits uppercase enums, the shaping
// layer uppercases defensively, and the large majority of call sites already
// normalized before comparing — no backend-supported input distinguishes
// the two behaviors.
const upperStatus = (status) => (status ?? "").toUpperCase();

const SUCCESS_STATUSES = new Set(["SUCCESS", "SUCCESSFUL", "PAID"]);
const VERIFICATION_SUCCESS_STATUSES = new Set(["SUCCESS", "SUCCESSFUL"]);
const PAID_OBLIGATION_STATUSES = new Set(["PAID", "SUCCESSFUL"]);
const FAILED_STATUSES = new Set(["FAILED"]);
const OVERDUE_OBLIGATION_STATUSES = new Set(["OVERDUE"]);

export function isSuccessfulStatus(status) {
  return SUCCESS_STATUSES.has(upperStatus(status));
}

export function isVerificationSuccessStatus(status) {
  return VERIFICATION_SUCCESS_STATUSES.has(upperStatus(status));
}

export function isPaidObligationStatus(status) {
  return PAID_OBLIGATION_STATUSES.has(upperStatus(status));
}

export function isFailedStatus(status) {
  return FAILED_STATUSES.has(upperStatus(status));
}

export function isOverdueObligationStatus(status) {
  return OVERDUE_OBLIGATION_STATUSES.has(upperStatus(status));
}
