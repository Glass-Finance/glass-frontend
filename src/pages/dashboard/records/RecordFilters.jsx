import { TextInput } from "../../../components/ui/TextInput";
import { RECORD_TYPES, DIRECTIONS, RECORD_SOURCES } from "../../../utils/recordBook";
import { useCommunityMembers } from "../../../hooks/useCommunityMembers";
import { Field, Select, SearchField } from "./RecordBookUI";
export default function RecordFilters({ communityId, filters, onChange, review = false }) {
  const members = useCommunityMembers(communityId, { includeHistorical: true });
  const change = (name) => (value) => onChange({ ...filters, [name]: value });
  return (
    <div className="space-y-3">
      <SearchField value={filters.search ?? ""} onChange={change("search")} />
      <details>
        <summary className="cursor-pointer text-sm font-medium text-ink-muted py-2">
          Filter and sort records
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-3">
          {!review && (
            <Select
              label="Source"
              value={filters.source}
              options={RECORD_SOURCES}
              onChange={change("source")}
            />
          )}
          <Select
            label="Type"
            value={filters.type}
            options={RECORD_TYPES}
            onChange={change("type")}
          />
          <Select
            label="Direction"
            value={filters.direction}
            options={DIRECTIONS}
            onChange={change("direction")}
          />
          <Select
            label="Member"
            value={filters.memberId}
            options={Object.fromEntries(
              members.members.map((m) => [
                m.id,
                [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                  m.memberRef ||
                  "Unnamed member",
              ]),
            )}
            onChange={change("memberId")}
          />
          {!review && (
            <>
              <Field label="From date">
                <TextInput
                  aria-label="From date"
                  type="date"
                  value={filters.occurredOnFrom ?? ""}
                  onChange={(e) => change("occurredOnFrom")(e.target.value)}
                />
              </Field>
              <Field label="To date">
                <TextInput
                  aria-label="To date"
                  type="date"
                  value={filters.occurredOnTo ?? ""}
                  onChange={(e) => change("occurredOnTo")(e.target.value)}
                />
              </Field>
              <Field label="Currency">
                <TextInput
                  aria-label="Currency filter"
                  maxLength={3}
                  value={filters.currency ?? ""}
                  onChange={(e) => change("currency")(e.target.value.toUpperCase())}
                />
              </Field>
            </>
          )}
          <Select
            label="Sort by"
            value={filters.sortBy ?? "createdAt"}
            options={
              review
                ? {
                    createdAt: "Added",
                    sourceRowNumber: "Spreadsheet row",
                    reviewStatus: "Review status",
                  }
                : { createdAt: "Added", occurredOn: "Record date", amountMinor: "Amount" }
            }
            empty={null}
            onChange={change("sortBy")}
          />
          <Select
            label="Order"
            value={filters.dir ?? "desc"}
            options={{ desc: "Descending", asc: "Ascending" }}
            empty={null}
            onChange={change("dir")}
          />
        </div>
      </details>
    </div>
  );
}
