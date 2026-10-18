import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import ConfirmDialog from "../../../components/dashboard/ConfirmDialog";
import ModalShell from "../../../components/dashboard/ModalShell";
import { useCommunityMembers } from "../../../hooks/useCommunityMembers";
import {
  RECORD_FIELDS,
  OPTIONAL_FIELDS,
  RECORD_TYPES,
  DIRECTIONS,
  errorDescription,
  validateRecord,
} from "../../../utils/recordBook";
import { Field, Select, ErrorNotice } from "./RecordBookUI";
const LABELS = {
  recordType: "Record type",
  direction: "Direction",
  occurredOn: "Date",
  amount: "Amount",
  currency: "Currency",
  memberId: "Member",
  payerName: "Payer name",
  payerReference: "Payer reference",
  description: "Description",
  categoryLabel: "Category",
  externalReference: "External reference",
};
export default function ImportBulkActions({
  communityId,
  selected,
  onClear,
  onApply,
  frozen,
  onDraftChange = () => {},
}) {
  const [patch, setPatch] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function apply() {
    if (busy || frozen || !selected.length || selected.length > 500) return;
    setBusy(true);
    setError("");
    try {
      await onApply(patch);
      setPatch(null);
      onDraftChange(false);
      onClear();
    } catch (err) {
      setError(errorDescription(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-g-1 border border-black/10 p-3 space-y-3">
      <p className="text-sm font-medium">{selected.length} selected across pages (maximum 500)</p>
      <p className="text-xs text-ink-muted">
        Only explicitly selected records are affected. Some selections may be outside your current
        page or filters.
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          ["Skip selected", { skip: true }],
          ["Include selected", { skip: false }],
          ["Accept interpreted values", { acceptRowAssistance: true }],
          ["Accept duplicate warnings", { duplicateAccepted: true }],
          ["Clear duplicate acceptance", { duplicateAccepted: false }],
        ].map(([label, value]) => (
          <Button
            key={String(label)}
            size="md"
            fullWidth={false}
            variant="outline-neutral"
            disabled={frozen || !selected.length}
            onClick={() => {
              setError("");
              setPatch(value);
              onDraftChange(true);
            }}
          >
            {label}
          </Button>
        ))}
        <Button
          size="md"
          fullWidth={false}
          variant="outline"
          disabled={frozen || !selected.length}
          onClick={() => {
            setEditing(true);
            onDraftChange(true);
          }}
        >
          Edit selected
        </Button>
        <Button
          size="md"
          fullWidth={false}
          variant="tertiary"
          disabled={frozen || busy || !selected.length}
          onClick={onClear}
        >
          Clear selection
        </Button>
      </div>
      {patch && (
        <ConfirmDialog
          title="Apply bulk changes?"
          danger={false}
          description={`Apply these changes only to ${selected.length} selected records. Acceptance confirms you have reviewed their current values. Other validation issues may still need correction.`}
          confirmLabel={`Apply to ${selected.length} selected records`}
          confirming={busy}
          confirmDisabled={frozen}
          error={error}
          onClose={() => {
            if (!busy) {
              setPatch(null);
              onDraftChange(false);
            }
          }}
          onConfirm={apply}
        >
          <dl className="text-sm space-y-1">
            {Object.entries(patch).map(([name, value]) => (
              <div key={name}>
                <dt className="inline font-medium">
                  {LABELS[name] ||
                    {
                      skip: "Skip records",
                      duplicateAccepted: "Accept duplicates",
                      acceptRowAssistance: "Accept AI interpretation",
                    }[name]}
                  :{" "}
                </dt>
                <dd className="inline break-words">
                  {value === null
                    ? "Clear value"
                    : value === true
                      ? "Yes"
                      : value === false
                        ? "No"
                        : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </ConfirmDialog>
      )}
      {editing && (
        <BulkEditor
          communityId={communityId}
          frozen={frozen}
          onClose={() => {
            setEditing(false);
            onDraftChange(false);
          }}
          onContinue={(next) => {
            setEditing(false);
            setPatch(next);
          }}
        />
      )}
    </div>
  );
}
function BulkEditor({ communityId, onClose, onContinue, frozen }) {
  const members = useCommunityMembers(communityId, { includeHistorical: true });
  const [field, setField] = useState("description");
  const [value, setValue] = useState("");
  const [clear, setClear] = useState(false);
  const [changes, setChanges] = useState({});
  const [error, setError] = useState("");
  function add() {
    if (frozen) return;
    setError("");
    if (clear && OPTIONAL_FIELDS.includes(field)) {
      setChanges((old) => ({ ...old, [field]: null }));
      return;
    }
    if (!value.trim()) {
      setError("Enter a value, or explicitly choose Clear value for an optional field.");
      return;
    }
    const validation = validateRecord(
      { [field]: value, ...(field === "amount" ? { currency: changes.currency || "KWD" } : {}) },
      true,
    );
    if (validation[field]) {
      setError(validation[field]);
      return;
    }
    setChanges((old) => ({ ...old, [field]: field === "amount" ? Number(value) : value }));
  }
  const options =
    field === "recordType"
      ? RECORD_TYPES
      : field === "direction"
        ? DIRECTIONS
        : field === "memberId"
          ? Object.fromEntries(
              members.members.map((m) => [
                m.id,
                [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                  m.memberRef ||
                  "Unnamed member",
              ]),
            )
          : null;
  return (
    <ModalShell
      title="Edit selected records"
      onClose={onClose}
      footer={
        <Button
          size="md"
          disabled={frozen || !Object.keys(changes).length}
          onClick={() => onContinue(changes)}
        >
          Review changes
        </Button>
      }
    >
      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
        {frozen && (
          <ErrorNotice message="Review is paused because the import changed state. Your staged field changes are retained until you close this editor." />
        )}
        <p className="text-sm text-ink-muted">
          Add only the fields to change. Other fields remain unchanged. Changing a member can also
          update payer snapshots where they are not explicitly included.
        </p>
        <Select
          disabled={frozen}
          label="Field to change"
          value={field}
          empty={null}
          options={Object.fromEntries(RECORD_FIELDS.map((name) => [name, LABELS[name]]))}
          onChange={(next) => {
            setField(next);
            setValue("");
            setClear(false);
          }}
        />
        {options ? (
          <Select
            label="New value"
            value={value}
            options={options}
            empty="Choose value"
            onChange={setValue}
            disabled={frozen || clear}
          />
        ) : (
          <Field label="New value">
            <TextInput
              aria-label="New value"
              type={field === "occurredOn" ? "date" : "text"}
              value={value}
              disabled={frozen || clear}
              onChange={(e) =>
                setValue(field === "currency" ? e.target.value.toUpperCase() : e.target.value)
              }
            />
          </Field>
        )}
        {OPTIONAL_FIELDS.includes(field) && (
          <label className="text-sm flex gap-3">
            <input
              type="checkbox"
              checked={clear}
              disabled={frozen}
              onChange={(e) => setClear(e.target.checked)}
              className="accent-brand"
            />
            Clear value
          </label>
        )}
        <ErrorNotice message={error} />
        <Button size="md" fullWidth={false} variant="outline" onClick={add} disabled={frozen}>
          Add field change
        </Button>
        {Object.entries(changes).map(([name, next]) => (
          <div key={name} className="flex justify-between gap-3 text-sm items-center">
            <p className="break-words">
              {LABELS[name]}: {next === null ? "Clear value" : String(next)}
            </p>
            <Button
              size="sm"
              fullWidth={false}
              variant="tertiary"
              disabled={frozen}
              onClick={() =>
                setChanges((old) =>
                  Object.fromEntries(Object.entries(old).filter(([key]) => key !== name)),
                )
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
