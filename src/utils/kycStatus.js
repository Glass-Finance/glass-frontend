// KYC account + attempt status semantics.
//
// Every backend KYC status literal the frontend interprets, in one place
// (same pattern as paymentStatus.js). Account status comes from GET /kyc
// (KycStatus); attempt status from attempt/session responses (KycAttemptStatus)
// and shares the overlapping subset of literals. These are pure classifiers
// and display maps — they never fetch, never mutate.
//
// Why centralized:
//   - Account gates (community create/manage) must only treat APPROVED as
//     verified; inventing "verified"/"active" synonyms would diverge from
//     kyc-frontend-integration.md.
//   - Terminal unsuccessful outcomes (REJECTED/ERROR/EXPIRED/REVOKED) are
//     the retry gate for starting a new attempt — scattered string compares
//     would drift when the backend adds a value.
//   - Display labels/Tailwind classes live here so Settings, Home, history,
//     and member status cards cannot disagree on chip copy or colors.
//
// Admin table badges intentionally use platform-admin STATUS_COLORS
// (shared.js), which mirrors the same enum set for the dashboard chrome.
// Reactive block copy + the backend-403 matcher live here too: every
// catch site must recognize and phrase the same KYC rejection identically.
// Each style also carries its Phosphor icon (MIT) so every pill renders
// icon + label from one map — components must not re-pick glyphs.
// Case folding is intentional: backend enums are uppercase; callers may
// pass raw or already-normalized values.
import {
  CircleDashed,
  Clock,
  ClockCountdown,
  Hourglass,
  PlayCircle,
  Prohibit,
  SealCheck,
  Spinner,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

const STYLES = {
  approved: {
    cls: "bg-success-tint text-success-deep",
    text: "Approved",
    dot: "bg-success-deep",
    icon: SealCheck,
  },
  pending: {
    cls: "bg-[#fef9c3] text-warning",
    text: "Pending",
    dot: "bg-warning",
    icon: ClockCountdown,
  },
  inReview: {
    cls: "bg-[#fef9c3] text-warning",
    text: "In review",
    dot: "bg-warning",
    icon: Hourglass,
  },
  rejected: {
    cls: "bg-danger-wash text-danger",
    text: "Rejected",
    dot: "bg-danger",
    icon: XCircle,
  },
  error: {
    cls: "bg-danger-wash text-danger",
    text: "Error",
    dot: "bg-danger",
    icon: WarningCircle,
  },
  expired: {
    cls: "bg-stacked-container text-ink-muted",
    text: "Expired",
    dot: "bg-ink-faint",
    icon: Clock,
  },
  revoked: { cls: "bg-danger-wash text-danger", text: "Revoked", dot: "bg-danger", icon: Prohibit },
  notStarted: {
    cls: "bg-stacked-container text-ink-muted",
    text: "Not started",
    dot: "bg-ink-faint",
    icon: CircleDashed,
  },
  initiated: {
    cls: "bg-[#fef9c3] text-warning",
    text: "In progress",
    dot: "bg-warning",
    icon: PlayCircle,
  },
  processing: {
    cls: "bg-[#fef9c3] text-warning",
    text: "Processing",
    dot: "bg-warning",
    icon: Spinner,
  },
};

const KEYS = {
  NOT_STARTED: "notStarted",
  PENDING: "pending",
  IN_REVIEW: "inReview",
  APPROVED: "approved",
  REJECTED: "rejected",
  ERROR: "error",
  EXPIRED: "expired",
  REVOKED: "revoked",
  INITIATED: "initiated",
  PROCESSING: "processing",
};

export function kycStatusLabel(status) {
  const key = KEYS[String(status ?? "").toUpperCase()];
  return key ? STYLES[key].text : "—";
}

// Account statuses accepted by the user-level bypass. Attempt-only states
// (INITIATED/PROCESSING) are not profile statuses; unknown states fail closed.
const MANUAL_APPROVAL_STATUSES = new Set([
  "NOT_STARTED",
  "PENDING",
  "IN_REVIEW",
  "REJECTED",
  "ERROR",
  "EXPIRED",
  "REVOKED",
]);

export function canManuallyApproveKycStatus(status) {
  return MANUAL_APPROVAL_STATUSES.has(status);
}

export function kycStatusStyle(status) {
  const key = KEYS[String(status ?? "").toUpperCase()];
  const s = key
    ? STYLES[key]
    : {
        cls: "bg-stacked-container text-ink-muted",
        text: "—",
        dot: "bg-ink-faint",
        icon: CircleDashed,
      };
  // `dot` stays part of the contract (badge tests + any dot-painted
  // consumer); `Icon` is the pill's primary mark.
  return { label: s.text, cls: s.cls, dot: s.dot, Icon: s.icon };
}

// Label map for every id type the backend's KycIdType enum has ever held —
// a record persisted before the enum was narrowed must still render a
// friendly label, so this list stays complete and is NOT the picker source.
export const ID_TYPE_OPTIONS = [
  { value: "BVN", label: "BVN" },
  { value: "VOTER_ID", label: "Voter's card" },
  { value: "V_NIN", label: "Virtual NIN" },
  { value: "NIN_SLIP", label: "NIN slip" },
  { value: "NIN_V2", label: "NIN" },
];

// Values the backend accepts when STARTING an attempt (KycIdType is now
// exactly BVN and NIN_V2 — narrowed in the backend's V85 migration). A
// picker offering a retired value produces a server-side rejection, so the
// choice UI must read this list, not ID_TYPE_OPTIONS. Derived from
// ID_TYPE_OPTIONS on purpose: one label source, no second place to update
// when the enum changes.
export const KYC_SUBMITTABLE_ID_TYPES = ["BVN", "NIN_V2"];

export const KYC_SUBMITTABLE_ID_TYPE_OPTIONS = ID_TYPE_OPTIONS.filter((option) =>
  KYC_SUBMITTABLE_ID_TYPES.includes(option.value),
);

export function idTypeLabel(idType) {
  return ID_TYPE_OPTIONS.find((o) => o.value === idType)?.label ?? idType ?? "—";
}

// Exact status classifiers — callers must not re-derive string compares.
function upper(status) {
  return String(status ?? "").toUpperCase();
}

// Account statuses where starting is blocked / nothing to show as "current".
export function isKycApproved(status) {
  return upper(status) === "APPROVED";
}

export function isKycPending(status) {
  return upper(status) === "PENDING";
}

export function isKycInReview(status) {
  return upper(status) === "IN_REVIEW";
}

export function isKycNotStarted(status) {
  return upper(status) === "NOT_STARTED";
}

export function isKycTerminal(status) {
  const s = upper(status);
  return s === "REJECTED" || s === "ERROR" || s === "EXPIRED" || s === "REVOKED";
}

// Statuses where results are still moving through the pipeline (attempt
// submitted, provider processing). Powers the verification modal's live
// narrative + bounded refetch — callers must not re-derive the literal set.
export function isKycInFlight(status) {
  const s = upper(status);
  return s === "PENDING" || s === "INITIATED" || s === "PROCESSING";
}

// Admin list default filter (IN_REVIEW) + full filter set for platform-admin KYC.
export const KYC_STATUS_FILTER_OPTIONS = [
  { value: "IN_REVIEW", label: "In review" },
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ERROR", label: "Error" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REVOKED", label: "Revoked" },
];

export const KYC_DEFAULT_STATUS_FILTER = "IN_REVIEW";

// Admin ID-type filter: ALL sentinel + the shared id-type set.
export const KYC_ID_TYPE_FILTER_OPTIONS = [
  { value: "ALL", label: "All ID types" },
  ...ID_TYPE_OPTIONS,
];

// ── Reactive blocks (backend-enforced) ─────────────────────────────────────
// The backend rejects KYC-gated staff actions with HTTP 403 +
// "Approved KYC is required for community staff participation"
// (GlobalExceptionHandler → ApiResponse description). The client gate
// normally gets there first; this matcher catches what it can't see —
// stale summaries, deep links past the gate, invite acceptances that
// grant a staff role — so the UI shows the shared copy above instead of
// a dead-end error string.
export function isKycRequiredError(err) {
  return (
    err?.response?.status === 403 &&
    /Approved KYC is required/.test(err?.response?.data?.description ?? "")
  );
}

// Whether a community-staff request was refused because this account's
// identity verification isn't approved.
//
// `isKycRequiredError` above is NOT enough on its own here, and the reason is
// worth keeping: it matches the message thrown by
// `requireKycForCommunityStaff` ("Approved KYC is required for community staff
// participation"), which guards the *explicit* staff-action flows. The members
// and groups lists are refused by a different line —
// `requirePermission`'s "Community permission is required: <perm>" — because
// AccessControlService silently DOWNGRADES a COMMUNITY_OWNER/COMMUNITY_ADMIN to
// COMMUNITY_MEMBER permissions when kycStatus isn't APPROVED, and then the
// permission check fails generically. Matching on that message would never fire
// for exactly the pages this exists to explain.
//
// So the signal is the pair, and BOTH halves are load-bearing:
//
//   1. the refusal looks like a community-permission refusal. Without this, any
//      403 on a community page while the account happens to be KYC-incomplete
//      gets blamed on KYC — including the case that matters most for honesty,
//      a user who administers community A opening community B from the ?community=
//      query param. They'd be told "your community role is active" about a
//      community where it isn't. The message check is what separates "the
//      permission you should have is gone" from every other 403.
//   2. this account's KYC status is known and isn't approved. An unknown status
//      (still loading, the summary endpoint failed, or no KYC record) is not
//      evidence of anything: a 403 that lands while /kyc is down says nothing
//      about KYC, and blaming it there sends the user off to verify for no
//      reason.
//
// If the backend ever renames the message this matcher degrades to the generic
// error, which is the safe direction to fail: the user sees the old unhelpful
// error, not a confident wrong explanation. `isKycRequiredError` is still OR'd
// in, so a backend that starts emitting the explicit KYC message on these
// endpoints keeps working without a frontend change.
//
// `exempt` is checked first and short-circuits to false: platform staff and the
// KYC kill switch are, by backend contract, never subject to the downgrade, so
// any 403 they hit on a community page is about something else entirely.
// Telling a platform admin to go verify their identity would be actively
// misleading.
//
// @param {any} err the request error
// @param {string|null} status this account's kycStatus
// @param {{isLoading?: boolean, isError?: boolean, exempt?: boolean}} [gateState] gate state
export function isKycGatedCommunityRequestError(err, status, gateState = {}) {
  if (gateState.exempt) return false;
  if (isKycRequiredError(err)) return true;
  if (err?.response?.status !== 403) return false;
  // Status not settled yet — wait rather than guess.
  if (gateState.isLoading || gateState.isError) return false;
  // No KYC record at all, or already approved: the 403 is about something else.
  if (!status || isKycApproved(status)) return false;
  // Must actually be a community-permission refusal. Verified live: the
  // downgrade surfaces as "Community permission is required: <perm>" (both the
  // members and groups lists report community.members.read). Matched on the
  // prefix, not the whole string, so the permission name can change.
  return /Community permission is required/.test(err?.response?.data?.description ?? "");
}

// One voice for every reactive block site. Admin copy speaks about the
// member being promoted; accept copy speaks to the person accepting.
export const KYC_ADMIN_BLOCK_COPY =
  "This member needs an approved identity verification before they can become an admin. Ask them to verify, then try promoting again.";
export const KYC_ACCEPT_BLOCK_COPY =
  "You need an approved identity verification before you can take an admin role. Verify your identity, then accept this invite again.";

// Completion indicator states — collapses the account enum into the four
// states the member-list badge shows. Returns null when there is nothing
// to show (missing status, or a future literal we don't recognize — fail
// quiet rather than mislabel), so KycStateBadge can ship before the
// backend adds kycStatus to the community-member DTO (docs/kyc.md).
export function kycCompletionState(status) {
  const s = upper(status);
  if (!s) return null;
  if (s === "APPROVED") return "APPROVED";
  if (s === "PENDING" || s === "IN_REVIEW" || s === "INITIATED" || s === "PROCESSING")
    return "IN_REVIEW";
  if (isKycTerminal(s)) return "REJECTED";
  if (s === "NOT_STARTED") return "NOT_STARTED";
  return null;
}
