// Record-book interpretation stays here: display labels never grant permission
// or bypass the backend's validation/consent checks. Amounts are major units.
export const RECORD_TYPES = {
  MEMBER_PAYMENT: "Member payment",
  EXPENSE: "Expense",
  OTHER: "Other",
};
export const DIRECTIONS = { INFLOW: "Money in", OUTFLOW: "Money out" };
export const RECORD_SOURCES = { PLATFORM: "Glass", MANUAL: "Manual", FILE_IMPORT: "Spreadsheet" };
export const REVIEW_LABELS = {
  VALID: "Ready",
  INVALID: "Needs correction",
  REVIEW_REQUIRED: "Needs confirmation",
  SKIPPED: "Skipped",
};
export const JOB_LABELS = {
  QUEUED: "Waiting to start",
  READING_FILE: "Reading spreadsheet",
  INFERRING_MAPPING: "Identifying columns",
  APPLYING_MAPPING: "Preparing records",
  ASSISTING_ROWS: "Checking unclear values",
  READY_FOR_REVIEW: "Ready for review",
  COMMIT_QUEUED: "Saving records",
  COMMITTED: "Completed",
  FAILED: "Processing failed",
  DISCARDED: "Discarded",
};
export const RECORD_FIELDS = [
  "recordType",
  "direction",
  "occurredOn",
  "amount",
  "currency",
  "memberId",
  "payerName",
  "payerReference",
  "description",
  "categoryLabel",
  "externalReference",
];
export const OPTIONAL_FIELDS = [
  "memberId",
  "payerName",
  "payerReference",
  "description",
  "categoryLabel",
  "externalReference",
];
export const ISSUE_LABELS = {
  REQUIRED: "A required value is missing.",
  FUTURE_DATE: "Use today or an earlier date.",
  INVALID_AMOUNT: "Enter a positive amount.",
  INVALID_CURRENCY: "Check the currency code.",
  EXACT_DUPLICATE: "This looks like a record already included.",
  POSSIBLE_DUPLICATE: "Check whether this record has already been included.",
  MEMBER_MATCH_CONFLICT:
    "The payer details point to different members. Choose a member or leave unlinked.",
  MEMBER_MATCH_AMBIGUOUS: "More than one member matches. Choose a member or leave unlinked.",
  ASSISTANCE_ACCEPTANCE_REQUIRED:
    "Compare the interpreted values with the source, then accept or correct them.",
  DEFAULT_CURRENCY: "The community currency was used because the source had none.",
  INVALID_SOURCE_CURRENCY: "The source currency could not be recognized.",
  MISSING_SOURCE_FACT:
    "A required fact is missing from the spreadsheet. Fill it in or skip this row.",
  AMBIGUOUS_DATE: "Check the day and month against the source.",
  AMOUNT_PAIR_CONFLICT: "The source has conflicting incoming and outgoing amounts.",
  DIRECTION_SIGN_CONFLICT: "Check the amount's direction against the source.",
  INVALID_AMOUNT_PRECISION_OR_CURRENCY: "Check the currency and number of decimal places.",
  MISSING_DATE_CONVENTION: "The spreadsheet date format is unclear. Enter the correct date.",
  MISSING_AMOUNT_CONVENTION: "The spreadsheet number format is unclear. Enter the correct amount.",
  FORMULA_CACHE_USED: "The saved spreadsheet formula result was used. No formula was executed.",
  MULTIPLE_EXTRACT_MATCHES: "More than one source value matched. Check the interpreted value.",
  INTERPRETATION_FAILED: "This value could not be interpreted. Correct it or skip the row.",
};
export function jobActions(job) {
  const status = job?.status;
  return {
    edit: status === "READY_FOR_REVIEW",
    commit: status === "READY_FOR_REVIEW",
    discard: ["QUEUED", "READY_FOR_REVIEW", "FAILED"].includes(status),
    retry: status === "FAILED" && job?.retryable === true,
    rerun: ["READY_FOR_REVIEW", "FAILED"].includes(status),
  };
}
export function jobPollInterval(job) {
  if (job?.status === "READY_FOR_REVIEW") return 30000;
  return [
    "QUEUED",
    "READING_FILE",
    "INFERRING_MAPPING",
    "APPLYING_MAPPING",
    "ASSISTING_ROWS",
    "COMMIT_QUEUED",
  ].includes(job?.status)
    ? 10000
    : false;
}
export function formatRecordAmount(amount, currency = "NGN") {
  if (amount == null || amount === "") return "Amount missing";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}
export function formatRecordDate(date) {
  if (!date) return "Date missing";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function jobLabel(job) {
  const date = job?.createdAt
    ? new Date(job.createdAt).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date unavailable";
  return `${job?.fileFormat || "Spreadsheet"} import · ${date} · ${String(job?.id || "").slice(0, 6)}`;
}
export function makeRecordPatch(original, values) {
  const result = {};
  for (const field of RECORD_FIELDS) {
    if (!Object.hasOwn(values, field)) continue;
    let value = values[field];
    if (value === "") value = null;
    if (field === "amount" && value !== "" && value != null) value = Number(value);
    if ((original?.[field] ?? null) !== (value ?? null)) result[field] = value;
  }
  // A non-null member link defaults omitted payer snapshots on the server.
  // Preserve fields the form explicitly supplied, even when null matched the
  // old snapshot, so clearing an autofill is never silently undone.
  if (result.memberId != null) {
    for (const field of ["payerName", "payerReference"]) {
      if (Object.hasOwn(values, field)) result[field] = values[field] === "" ? null : values[field];
    }
  }
  return result;
}
export function validateRecord(values, allowIncomplete = false) {
  const errors = {};
  const required = ["recordType", "direction", "occurredOn", "amount", "currency"];
  if (!allowIncomplete)
    for (const field of required)
      if (!String(values[field] ?? "").trim()) errors[field] = "This field is required.";
  if (values.recordType && !Object.hasOwn(RECORD_TYPES, values.recordType))
    errors.recordType = "Choose a record type.";
  if (values.direction && !Object.hasOwn(DIRECTIONS, values.direction))
    errors.direction = "Choose money in or money out.";
  if (values.occurredOn) {
    const date = String(values.occurredOn);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date > new Date().toISOString().slice(0, 10)
    )
      errors.occurredOn = "Use a valid date no later than today (UTC).";
  }
  let digits = 2;
  if (values.currency) {
    try {
      if (!/^[A-Z]{3}$/.test(values.currency)) throw new Error("currency");
      if (Intl.supportedValuesOf && !Intl.supportedValuesOf("currency").includes(values.currency))
        throw new Error("currency");
      digits =
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: values.currency,
        }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      errors.currency = "Enter a supported three-letter currency code.";
    }
  }
  if (values.amount !== "" && values.amount != null) {
    const text = String(values.amount);
    const amount = Number(text);
    if (
      !/^\d+(?:\.\d+)?$/.test(text) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (text.split(".")[1]?.length ?? 0) > digits
    )
      errors.amount = `Enter a positive amount with at most ${digits} decimal places.`;
    else {
      // Compare decimal strings with integer minor units to avoid a rounding
      // tolerance that would silently accept an altered amount.
      const [whole, fraction = ""] = text.split(".");
      const minor = BigInt(whole + fraction.padEnd(digits, "0"));
      const serialized = JSON.stringify(amount);
      const normalized = text
        .replace(/^0+(?=\d)/, "")
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "");
      if (minor > BigInt(Number.MAX_SAFE_INTEGER) || serialized !== normalized)
        errors.amount = "This amount is too large to represent safely.";
    }
  }
  return errors;
}
export function toggleRowSelection(ids, id) {
  return ids.includes(id)
    ? ids.filter((value) => value !== id)
    : ids.length < 500
      ? [...ids, id]
      : ids;
}
export function recordCounts(job) {
  const totals = job?.reviewTotals ?? {};
  return {
    ready: totals.VALID ?? 0,
    invalid: totals.INVALID ?? 0,
    review: totals.REVIEW_REQUIRED ?? 0,
    skipped: totals.SKIPPED ?? 0,
    included: (totals.VALID ?? 0) + (totals.INVALID ?? 0) + (totals.REVIEW_REQUIRED ?? 0),
  };
}
export function errorDescription(error) {
  const code = error?.response?.data?.message;
  if (code === "AI_QUOTA_EXCEEDED")
    return "Your community has used its available AI imports. Check the allowance and reset time before trying again.";
  if (code === "AI_FEATURE_NOT_AVAILABLE")
    return "AI imports are not enabled for this community. Contact a platform administrator.";
  if (code === "AI_QUOTA_UNAVAILABLE")
    return "AI import usage is temporarily unavailable. Check the import history before trying again.";
  return (
    error?.response?.data?.description ||
    (error?.response?.data?.message !== "error" ? error?.response?.data?.message : null) ||
    (!error?.response ? error?.message : null) ||
    "We couldn't complete this action. Please try again."
  );
}
