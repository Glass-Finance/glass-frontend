// Pure request builders for manual record writes.
//
// Split out of RecordFormModal.jsx because react-refresh/only-export-components
// rejects a module that exports both a component and plain functions — and
// because these are worth testing directly, with no component, no backend and
// no browser in the way.
//
// PATCH SEMANTICS ARE THE WHOLE POINT. The backend's rule is: omission
// preserves, an explicit null CLEARS, and `{}` clears nothing. A form that
// always sends every field cannot express "leave this alone" versus "wipe this"
// — it collapses them, and wiping a field the user never touched is silent data
// loss. So buildPatch sends only what actually changed, with an explicit null
// for a field the user emptied that previously held a value.

export const RECORD_CURRENCIES = ["NGN"];

// Optional text fields. All are editable on PATCH, and all clear to null rather
// than to "".
export const OPTIONAL_FIELDS = [
  { key: "payerName", label: "Payer name" },
  { key: "payerReference", label: "Payer reference" },
  { key: "description", label: "Description" },
  { key: "categoryLabel", label: "Category" },
  { key: "externalReference", label: "External reference" },
];

export const EMPTY_FORM = {
  recordType: "MEMBER_PAYMENT",
  direction: "INFLOW",
  occurredOn: "",
  amount: "",
  currency: "NGN",
  payerName: "",
  payerReference: "",
  description: "",
  categoryLabel: "",
  externalReference: "",
};

export function seedForm(record) {
  if (!record) return { ...EMPTY_FORM };
  return {
    recordType: record.recordType ?? EMPTY_FORM.recordType,
    direction: record.direction ?? EMPTY_FORM.direction,
    occurredOn: record.occurredOn ?? "",
    amount: record.amount != null ? String(record.amount) : "",
    currency: record.currency ?? EMPTY_FORM.currency,
    payerName: record.payerName ?? "",
    payerReference: record.payerReference ?? "",
    description: record.description ?? "",
    categoryLabel: record.categoryLabel ?? "",
    externalReference: record.externalReference ?? "",
  };
}

export function buildPatch(record, form) {
  const patch = {};
  for (const field of ["recordType", "direction", "occurredOn", "currency"]) {
    if (form[field] !== record[field]) patch[field] = form[field];
  }

  const nextAmount = Number(form.amount);
  // An unparseable amount is left out rather than sent: JSON.stringify(NaN) is
  // `null`, which the backend reads as "clear this field" — silent data loss
  // where a validation error belongs.
  if (Number.isFinite(nextAmount) && nextAmount !== record.amount) patch.amount = nextAmount;

  for (const { key } of OPTIONAL_FIELDS) {
    const before = record[key] ?? null;
    const after = form[key].trim();
    if (after === "") {
      // Only send null when there was something there; null-for-null is a
      // no-op that still looks like an edit.
      if (before !== null) patch[key] = null;
    } else if (after !== before) {
      patch[key] = after;
    }
  }
  return patch;
}

export function buildCreate(form) {
  const payload = {
    recordType: form.recordType,
    direction: form.direction,
    occurredOn: form.occurredOn,
    amount: Number(form.amount),
    currency: form.currency,
  };
  for (const { key } of OPTIONAL_FIELDS) {
    const value = form[key].trim();
    if (value) payload[key] = value;
  }
  // duplicateAccepted is deliberately absent. It is CONSENT, not a validation
  // bypass: the caller adds it only after the backend returns 409 and the user
  // acknowledges the duplicate. A plain create must never carry it.
  return payload;
}

export function validateForm(form) {
  const errors = {};
  if (!form.occurredOn) errors.occurredOn = "Pick the date this happened.";
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter an amount greater than zero.";
  }
  return errors;
}
