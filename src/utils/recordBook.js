// Community record book — domain vocabulary and the import job lifecycle.
//
// Mirrors the shape of src/utils/paymentStatus.js and src/utils/kycStatus.js:
// every status literal, terminal-state predicate and display string lives here
// rather than being re-spelled by each caller. The backend's own integration
// guide states the lifecycle explicitly, and it is a state machine with
// per-state permitted actions — re-deriving that in a component is how a
// commit button ends up enabled in COMMIT_QUEUED.
//
// Contract: docs/new/community-record-book-frontend-api.md in glass-backend
// ("Lifecycle and enabled actions", "Issue and evidence schemas").

// ── Record vocabulary ─────────────────────────────────────────────────────────

export const RECORD_SOURCES = ["MANUAL", "FILE_IMPORT", "PLATFORM"];
export const RECORD_TYPES = ["MEMBER_PAYMENT", "EXPENSE", "OTHER"];
export const RECORD_DIRECTIONS = ["INFLOW", "OUTFLOW"];

// Per-row review outcome. SKIPPED is an explicit exclusion the user chose, not
// a validation verdict, so it is tracked separately from VALID/INVALID.
export const REVIEW_STATUSES = ["VALID", "INVALID", "REVIEW_REQUIRED", "SKIPPED"];

// PLATFORM records are read-only projections of platform transactions: the
// backend rejects edits and deletes on them, so the UI must not offer either.
export function isRecordEditable(record) {
  if (!record) return false;
  return record.source !== "PLATFORM";
}

// ── Import job lifecycle ──────────────────────────────────────────────────────

export const IMPORT_JOB_STATUSES = [
  "QUEUED",
  "READING_FILE",
  "INFERRING_MAPPING",
  "APPLYING_MAPPING",
  "ASSISTING_ROWS",
  "READY_FOR_REVIEW",
  "COMMIT_QUEUED",
  "COMMITTED",
  "FAILED",
  "DISCARDED",
];

// The four worker phases. They are progress, not progress-percentage: the
// backend explicitly warns that worker sequences can repeat across retries,
// so a UI must never render "40% done" from position in this list. The job's
// own `timeline[].sequence` is the only monotonic progress signal.
const PROCESSING_STATUSES = new Set([
  "READING_FILE",
  "INFERRING_MAPPING",
  "APPLYING_MAPPING",
  "ASSISTING_ROWS",
]);

// Terminal means "will not change on its own". FAILED is deliberately NOT
// here: it is a resting state a retry or rerun can leave, and COMMIT_QUEUED is
// not here because a commit that fails validation returns the job to
// READY_FOR_REVIEW.
const TERMINAL_STATUSES = new Set(["COMMITTED", "DISCARDED"]);

export function isImportJobTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

export function isImportJobProcessing(status) {
  return PROCESSING_STATUSES.has(status);
}

// Still moving on its own, with no further request needed.
export function isImportJobInFlight(status) {
  return status === "QUEUED" || PROCESSING_STATUSES.has(status) || status === "COMMIT_QUEUED";
}

// The one state in which a human acts on rows. Everything else either has not
// produced rows yet, has them committed, or has thrown them away.
export function isReviewOpen(status) {
  return status === "READY_FOR_REVIEW";
}

export function isImportJobFailed(status) {
  return status === "FAILED";
}

// ── Failure codes ─────────────────────────────────────────────────────────────

// Raised when validation blocks a commit. The job reopens READY_FOR_REVIEW
// with updated row issues — it has NOT failed permanently, and the user's next
// move is to correct or skip the blocking rows and request commit again.
export const COMMIT_BLOCKED_CODE = "IMPORT_COMMIT_BLOCKED";

// Raised when the queue retried a technical commit failure five times over
// ~4 minutes and gave up. Also reopens READY_FOR_REVIEW; the underlying
// technical problem needs resolving before another commit request.
export const COMMIT_RETRIES_EXHAUSTED_CODE = "IMPORT_COMMIT_RETRIES_EXHAUSTED";

export function isCommitFailureCode(code) {
  return code === COMMIT_BLOCKED_CODE || code === COMMIT_RETRIES_EXHAUSTED_CODE;
}

// ── Enabled actions ───────────────────────────────────────────────────────────

// The permitted-action table from the backend guide, as data rather than as a
// component's private knowledge. `retryable` is a server-supplied field on a
// FAILED job and is NOT implied by the status — a failure the backend will not
// re-attempt must not show a Retry button just because it says FAILED.
export function importJobActions(status, retryable = false) {
  return {
    // Row edits, manual additions, skips, acceptances and bulk patches.
    editRows: isReviewOpen(status),
    commit: isReviewOpen(status),
    // Allowed only from QUEUED / READY_FOR_REVIEW / FAILED — explicitly not
    // while processing, and not while a commit is in flight.
    discard: status === "QUEUED" || isReviewOpen(status) || status === "FAILED",
    rerun: status === "FAILED" || isReviewOpen(status),
    retry: status === "FAILED" && retryable === true,
  };
}

// ── Display ───────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  QUEUED: "Queued",
  READING_FILE: "Reading file",
  INFERRING_MAPPING: "Reading the layout",
  APPLYING_MAPPING: "Mapping columns",
  ASSISTING_ROWS: "Assisting rows",
  READY_FOR_REVIEW: "Ready for review",
  COMMIT_QUEUED: "Committing",
  COMMITTED: "Committed",
  FAILED: "Failed",
  DISCARDED: "Discarded",
};

export function importJobStatusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "Unknown";
}

const REVIEW_LABELS = {
  VALID: "Valid",
  INVALID: "Invalid",
  REVIEW_REQUIRED: "Needs review",
  SKIPPED: "Skipped",
};

export function reviewStatusLabel(status) {
  return REVIEW_LABELS[status] ?? status ?? "Unknown";
}

// ── AI usage ──────────────────────────────────────────────────────────────────

export const AI_USAGE_MODES = ["LIMITED", "UNLIMITED", "DISABLED"];
export const AI_USAGE_PERIODS = ["DAILY", "WEEKLY", "MONTHLY"];

// UNLIMITED returns null allowance and null remaining rather than a large
// number. Rendering that null as 0 would tell the user they have nothing left,
// so it has to read as "Unlimited".
export function aiAllowanceLabel(mode, remainingUnits) {
  if (mode === "UNLIMITED") return "Unlimited";
  if (mode === "DISABLED") return "Disabled";
  if (remainingUnits === null || remainingUnits === undefined) return "—";
  return String(remainingUnits);
}
