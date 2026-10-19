import { useRef, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { TextInput } from "../../../components/ui/TextInput";
import { Button } from "../../../components/ui/Button";
import { RECORD_TYPES, DIRECTIONS, RECORD_SOURCES } from "../../../utils/recordBook";
import { useCommunityMembers } from "../../../hooks/useCommunityMembers";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { Field, Select, SearchField } from "./RecordBookUI";
export default function RecordFilters({
  communityId,
  filters,
  onChange,
  review = false,
  children,
  leading,
}) {
  const members = useCommunityMembers(communityId, { includeHistorical: true });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const change = (name) => (value) => onChange({ ...filters, [name]: value });
  const count = Object.entries(filters).filter(
    ([key, value]) =>
      !["search", "sortBy", "dir", "reviewStatus", "issueCode", "sheetName"].includes(key) && value,
  ).length;
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <SearchField value={filters.search ?? ""} onChange={change("search")} />
        {leading}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          compact
          hideLabel
          label="Sort by"
          value={filters.sortBy ?? "createdAt"}
          options={
            review
              ? {
                  createdAt: "Added",
                  sourceRowNumber: "Spreadsheet row",
                  reviewStatus: "Review status",
                }
              : { createdAt: "Recent", occurredOn: "Record date", amountMinor: "Amount" }
          }
          empty={null}
          onChange={change("sortBy")}
        />
        <div
          ref={ref}
          className="static"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <Button
            ref={trigger}
            size="sm-tight"
            fullWidth={false}
            variant="outline-neutral"
            aria-expanded={open}
            aria-controls="record-filters-panel"
            onClick={() => setOpen(!open)}
          >
            <SlidersHorizontal size={13} />
            Filter{count > 0 ? ` (${count})` : ""}
            <ChevronDown size={12} />
          </Button>
          {open && (
            <div
              id="record-filters-panel"
              role="group"
              aria-label="Record filters"
              className="absolute right-0 top-full mt-2 z-30 w-[min(32rem,calc(100vw-3rem))] rounded-g-2 border border-surface-container-border bg-white p-4 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Filter records</p>
                <Button
                  size="xs"
                  fullWidth={false}
                  variant="tertiary"
                  onClick={() =>
                    onChange({ search: filters.search, sortBy: filters.sortBy, dir: filters.dir })
                  }
                >
                  Clear filters
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children}
                {!review && (
                  <Select
                    compact
                    label="Source"
                    value={filters.source}
                    options={RECORD_SOURCES}
                    onChange={change("source")}
                  />
                )}
                <Select
                  compact
                  label="Type"
                  value={filters.type}
                  options={RECORD_TYPES}
                  onChange={change("type")}
                />
                <Select
                  compact
                  label="Direction"
                  value={filters.direction}
                  options={DIRECTIONS}
                  onChange={change("direction")}
                />
                <Select
                  compact
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
                    {[
                      ["occurredOnFrom", "From date"],
                      ["occurredOnTo", "To date"],
                    ].map(([field, label]) => (
                      <Field key={field} label={label}>
                        <TextInput
                          aria-label={label}
                          type="date"
                          value={filters[field] ?? ""}
                          onChange={(e) => change(field)(e.target.value)}
                          className="h-11 md:h-9 py-2! md:text-xs"
                        />
                      </Field>
                    ))}
                    <Field label="Currency">
                      <TextInput
                        aria-label="Currency filter"
                        maxLength={3}
                        value={filters.currency ?? ""}
                        onChange={(e) => change("currency")(e.target.value.toUpperCase())}
                        className="h-11 md:h-9 py-2! md:text-xs"
                      />
                    </Field>
                  </>
                )}
                <Select
                  compact
                  label="Order"
                  value={filters.dir ?? "desc"}
                  options={{ desc: "Descending", asc: "Ascending" }}
                  empty={null}
                  onChange={change("dir")}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm-tight" fullWidth={false} onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
