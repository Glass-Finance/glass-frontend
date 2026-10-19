import { useState } from "react";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { RECORD_TYPES, RECORD_DIRECTIONS } from "../../../utils/recordBook";
import {
  RECORD_CURRENCIES,
  OPTIONAL_FIELDS,
  seedForm,
  buildPatch,
  buildCreate,
  validateForm,
} from "./recordPatch";

// Manual record create / edit.
//
// The request semantics live in recordPatch.js, not here — see the note there
// on why a PATCH may only carry what actually changed.
//
// The other trap: duplicateAccepted is CONSENT, not a validation bypass. A 409
// means this duplicates a committed record, and the fix is to ask the user. The
// caller handles the 409 and offers the override via onAcceptDuplicate.

function fieldClass() {
  // Border-colour focus change, not a focus ring — see docs/design-system.md.
  return "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-brand";
}

export default function RecordFormModal({
  record,
  onClose,
  onSubmit,
  saving,
  error,
  onAcceptDuplicate,
}) {
  const isEdit = Boolean(record);

  // Seeded in the initialiser rather than synced by an effect; the caller passes
  // a `key` that changes with the record being edited, so switching rows (or to
  // "new") remounts this and reseeds cleanly — no stale values carried over.
  const [form, setForm] = useState(() => seedForm(record));
  const [touched, setTouched] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // occurredOn cannot be later than the current UTC date, so cap the picker
  // rather than letting the user choose a date the server will reject.
  const today = new Date().toISOString().slice(0, 10);

  const errors = validateForm(form);
  const invalid = Boolean(errors.occurredOn || errors.amount);

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSubmit(isEdit ? buildPatch(record, form) : buildCreate(form));
  }

  return (
    <ModalShell
      title={isEdit ? "Edit record" : "New record"}
      subtitle={
        isEdit
          ? "Only changed fields are sent. Emptying a field clears it."
          : "Records are a history of what happened — they don't move money."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="px-5 py-4 flex flex-col gap-4">
        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-type" className="block text-xs font-bold text-gray-700 mb-1.5">
              Type
            </label>
            <select
              id="rec-type"
              value={form.recordType}
              onChange={set("recordType")}
              className={fieldClass()}
            >
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-direction" className="block text-xs font-bold text-gray-700 mb-1.5">
              Direction
            </label>
            <select
              id="rec-direction"
              value={form.direction}
              onChange={set("direction")}
              className={fieldClass()}
            >
              {RECORD_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "INFLOW" ? "Money in" : "Money out"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-amount" className="block text-xs font-bold text-gray-700 mb-1.5">
              Amount
            </label>
            <input
              id="rec-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={form.amount}
              onChange={set("amount")}
              onBlur={() => setTouched(true)}
              placeholder="0.00"
              autoFocus={!isEdit}
              className={fieldClass()}
            />
            {touched && errors.amount ? (
              <p className="text-xs text-danger mt-1">{errors.amount}</p>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">In whole currency units.</p>
            )}
          </div>

          <div>
            <label htmlFor="rec-currency" className="block text-xs font-bold text-gray-700 mb-1.5">
              Currency
            </label>
            <select
              id="rec-currency"
              value={form.currency}
              onChange={set("currency")}
              className={fieldClass()}
            >
              {RECORD_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="rec-date" className="block text-xs font-bold text-gray-700 mb-1.5">
            Date
          </label>
          <input
            id="rec-date"
            type="date"
            max={today}
            value={form.occurredOn}
            onChange={set("occurredOn")}
            onBlur={() => setTouched(true)}
            className={fieldClass()}
          />
          {touched && errors.occurredOn ? (
            <p className="text-xs text-danger mt-1">{errors.occurredOn}</p>
          ) : null}
        </div>

        {OPTIONAL_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`rec-${key}`} className="block text-xs font-bold text-gray-700 mb-1.5">
              {label} <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id={`rec-${key}`}
              value={form[key]}
              onChange={set(key)}
              placeholder={isEdit ? "Leave empty to clear" : undefined}
              className={fieldClass()}
            />
          </div>
        ))}

        {onAcceptDuplicate && (
          <button
            type="button"
            onClick={onAcceptDuplicate}
            className="self-start text-xs font-semibold text-danger underline underline-offset-2"
          >
            Save anyway — this duplicates a record you already have
          </button>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline-neutral" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {isEdit ? "Save changes" : "Add record"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
