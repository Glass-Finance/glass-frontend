import { TextInput } from "../../../components/ui/TextInput";
import { useCommunityMembers } from "../../../hooks/useCommunityMembers";
import { RECORD_TYPES, DIRECTIONS } from "../../../utils/recordBook";
import { Field, Select } from "./RecordBookUI";

export default function RecordFields({
  communityId,
  values,
  onChange,
  errors = {},
  disabled = false,
}) {
  const members = useCommunityMembers(communityId);
  function chooseMember(memberId) {
    const member = members.members.find((m) => m.id === memberId);
    onChange({
      memberId,
      ...(member
        ? {
            payerName: [member.firstName, member.middleName, member.lastName]
              .filter(Boolean)
              .join(" "),
            payerReference: member.memberRef ?? "",
          }
        : {}),
    });
  }
  const input = (field, label, extra = {}) => (
    <Field label={label} error={errors[field]}>
      <TextInput
        aria-label={label}
        value={values[field] ?? ""}
        onChange={(e) =>
          onChange({
            [field]: field === "currency" ? e.target.value.toUpperCase() : e.target.value,
          })
        }
        disabled={disabled}
        error={errors[field]}
        {...extra}
      />
    </Field>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Record type"
          value={values.recordType}
          options={RECORD_TYPES}
          empty="Choose type"
          onChange={(recordType) => onChange({ recordType })}
          disabled={disabled}
        />
        <Select
          label="Direction"
          value={values.direction}
          options={DIRECTIONS}
          empty="Choose direction"
          onChange={(direction) => onChange({ direction })}
          disabled={disabled}
        />
        {input("occurredOn", "Date", { type: "date", max: new Date().toISOString().slice(0, 10) })}
        {input("amount", "Amount", { inputMode: "decimal", placeholder: "0.00" })}
        {input("currency", "Currency", { maxLength: 3 })}
        <Select
          label="Member (optional)"
          value={values.memberId}
          options={Object.fromEntries(
            members.members.map((m) => [
              m.id,
              `${[m.firstName, m.lastName].filter(Boolean).join(" ") || m.memberRef || "Unnamed member"}${m.status && m.status !== "ACTIVE" ? ` (${m.status.toLowerCase()})` : ""}`,
            ]),
          )}
          empty={members.isLoading ? "Loading members…" : "Leave unlinked"}
          onChange={chooseMember}
          disabled={disabled || members.isLoading || !!members.error}
        />
        {input("payerName", "Payer name (optional)")}
        {input("payerReference", "Payer reference (optional)")}
      </div>
      {members.error && (
        <p className="text-sm text-ink-muted">
          Member lookup is unavailable. You can still enter payer details and leave this record
          unlinked.
        </p>
      )}
      <details className="rounded-g-1 border border-black/10 p-3">
        <summary className="cursor-pointer text-sm font-medium">Additional details</summary>
        <div className="grid gap-4 mt-4">
          {input("description", "Description")}
          {input("categoryLabel", "Category")}
          {input("externalReference", "External reference")}
        </div>
      </details>
    </div>
  );
}
