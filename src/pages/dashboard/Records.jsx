import { useMemo, useState } from "react";
import { BookOpen, ArrowDownLeft, ArrowUpRight, Plus, Pencil, Trash2 } from "lucide-react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useDebounce } from "../../hooks/useDebounce";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useKycGate } from "../../hooks/useKycGate";
import { isKycGatedCommunityRequestError } from "../../utils/kycStatus";
import {
  useCommunityRecords,
  useCommunityRecord,
  useCreateCommunityRecord,
  useUpdateCommunityRecord,
  useDeleteCommunityRecord,
} from "../../hooks/useCommunityRecords";
import { isRecordEditable, reviewStatusLabel } from "../../utils/recordBook";
import { getErrorMessage } from "../../utils/errorHandler";
import { fmt, fmtDate } from "./platform-admin/shared";
import LoadingState from "../../components/common/LoadingState";
import ModalShell from "../../components/dashboard/ModalShell";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import CommunityStaffKycNotice from "../../components/dashboard/CommunityStaffKycNotice";
import { Button } from "../../components/ui/Button";
import RecordFormModal from "./records/RecordFormModal";
import {
  TableShell,
  TableFooter,
  SearchBar,
  FilterSelect,
} from "../../components/dashboard/TableChrome";

// Community record book — visible records.
//
// The read path only. Creating and editing manual records, and the import
// wizard, are separate slices; this screen is what they land into.
//
// Two things about the numbers, both of which are silent-wrong if missed:
//
//  • fmt() DEFAULTS TO MINOR UNITS. It divides by 100 unless told otherwise,
//    because most money fields on this backend are in kobo. Record amounts are
//    NOT — the backend sends major-unit decimals ("1250.50"), so every call
//    below passes { minor: false }. Forgetting it inflates every figure by 100x.
//    decimals: 2 because this is a bookkeeping ledger, where dropping kobo on a
//    per-record amount is the whole point of having it.
//
//  • The date bounds are DATES, NOT TIMESTAMPS. occurredOnFrom / occurredOnTo
//    bind to java.time.LocalDate with @DateTimeFormat(iso = ISO.DATE), so they
//    want a bare "YYYY-MM-DD". The toInstant() helper in settlements/
//    SettlementsList.jsx — which this screen's shape otherwise resembles —
//    converts to an ISO instant, and that value is wrong here. So the raw
//    <input type="date"> value is passed straight through, unconverted.

const PAGE_SIZE = 20;

// Tints reused from notificationTypes.js so the badge vocabulary matches the one
// the notifications panel already renders.
const GREEN = { bg: "var(--color-success-tint-2)", fg: "var(--color-success-strong)" };
const AMBER = { bg: "var(--color-warning-tint)", fg: "var(--color-warning)" };
const RED = { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" };
const INDIGO = { bg: "var(--color-brand-tint-2)", fg: "var(--color-accent-indigo)" };
const GRAY = { bg: "var(--color-stacked-container)", fg: "var(--color-ink-muted)" };

const SOURCE_TONE = {
  MANUAL: INDIGO,
  FILE_IMPORT: GRAY,
  PLATFORM: GRAY,
};

const REVIEW_TONE = {
  VALID: GREEN,
  REVIEW_REQUIRED: AMBER,
  INVALID: RED,
  SKIPPED: GRAY,
};

// occurredOn is a bare "YYYY-MM-DD" business date, not an ISO instant. Passing
// it to fmtDate() would run it through `new Date("2026-09-15")`, which parses as
// UTC midnight — and Intl then renders 14 Sep for anyone west of UTC. Parsing
// the parts into a LOCAL date is the fix, and is the same reasoning (and the
// same code shape) as toInstant() in settlements/SettlementsList.jsx.
function fmtBusinessDate(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return fmtDate(value);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function Badge({ tone, children }) {
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {children}
    </span>
  );
}

function SourceBadge({ source }) {
  return <Badge tone={SOURCE_TONE[source] ?? GRAY}>{(source ?? "—").replace(/_/g, " ")}</Badge>;
}

function ReviewBadge({ status }) {
  if (!status) return null;
  return <Badge tone={REVIEW_TONE[status] ?? GRAY}>{reviewStatusLabel(status)}</Badge>;
}

const SOURCE_OPTIONS = [
  { value: "ALL", label: "All sources" },
  { value: "MANUAL", label: "Manual" },
  { value: "FILE_IMPORT", label: "Imported" },
  { value: "PLATFORM", label: "Platform" },
];

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "MEMBER_PAYMENT", label: "Member payment" },
  { value: "EXPENSE", label: "Expense" },
  { value: "OTHER", label: "Other" },
];

const DIRECTION_OPTIONS = [
  { value: "ALL", label: "All directions" },
  { value: "INFLOW", label: "Money in" },
  { value: "OUTFLOW", label: "Money out" },
];

function AmountCell({ record }) {
  const isInflow = record.direction === "INFLOW";
  const Icon = isInflow ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon size={12} className={isInflow ? "text-success-strong" : "text-gray-400"} />
      {/* minor: false — see the note at the top of this file. */}
      <span className={`text-xs font-semibold ${isInflow ? "text-gray-900" : "text-gray-700"}`}>
        {fmt(record.amount, record.currency, { minor: false, decimals: 2 })}
      </span>
    </span>
  );
}

function RecordDetail({ communityId, recordId, onClose, onEdit, onDelete }) {
  const { data, isLoading, error } = useCommunityRecord(communityId, recordId);
  const record = data;
  // PLATFORM records are projections of platform transactions; the backend
  // rejects writes on them, so neither control is offered.
  const editable = isRecordEditable(record);

  return (
    <ModalShell
      title="Record"
      subtitle={record ? fmtBusinessDate(record.occurredOn) : ""}
      onClose={onClose}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <LoadingState className="py-10" />
        ) : error ? (
          <p className="text-xs text-danger">{getErrorMessage(error)}</p>
        ) : !record ? (
          <p className="text-xs text-gray-400">This record is no longer available.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <SourceBadge source={record.source} />
              <ReviewBadge status={record.reviewStatus} />
              {!editable && (
                <span className="text-[10px] text-gray-400">Platform records are read-only.</span>
              )}
            </div>

            {editable && (
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline-neutral"
                  size="xs"
                  fullWidth={false}
                  onClick={() => onEdit(record)}
                >
                  <Pencil size={12} className="mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="critical"
                  size="xs"
                  fullWidth={false}
                  onClick={() => onDelete(record)}
                >
                  <Trash2 size={12} className="mr-1.5" />
                  Delete
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ["Type", (record.recordType ?? "—").replace(/_/g, " ")],
                ["Direction", record.direction === "INFLOW" ? "Money in" : "Money out"],
                // minor: false — see the note at the top of this file.
                ["Amount", fmt(record.amount, record.currency, { minor: false, decimals: 2 })],
                ["Currency", record.currency ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white rounded-xl p-3 border border-surface-container-border"
                >
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            <dl className="space-y-2">
              {[
                ["Description", record.description],
                ["Payer", record.payerName],
                ["Payer reference", record.payerReference],
                ["Category", record.categoryLabel],
                ["External reference", record.externalReference],
                ["Occurred", record.occurredOn],
                [
                  "Imported from",
                  record.sheetName ? `${record.sheetName}, row ${record.sourceRowNumber}` : null,
                ],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-3">
                    <dt className="text-[11px] text-gray-400 w-40 shrink-0">{label}</dt>
                    <dd className="text-xs text-gray-700 break-words">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>

            {record.issues?.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Issues
                </p>
                <ul className="space-y-1.5">
                  {record.issues.map((issue, i) => (
                    <li key={`${issue.code}-${i}`} className="flex items-start gap-2">
                      <Badge tone={REVIEW_TONE.INVALID}>{issue.severity ?? "ISSUE"}</Badge>
                      <span className="text-xs text-gray-700">{issue.message ?? issue.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function Records() {
  usePageTitle("Records");
  const communityId = useActiveCommunityId();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [direction, setDirection] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // 1-based, because the backend's createPageable() does
  // PageRequest.of(pageNumber - 1, …) and rejects page 0 with a 400.
  const [pageNumber, setPageNumber] = useState(1);
  const [openRecordId, setOpenRecordId] = useState(null);
  // null | "new" | { record } — the form modal remounts on identity change via
  // `key`, so switching rows reseeds cleanly (same approach as GroupFormModal).
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formError, setFormError] = useState("");
  // Set after a 409 so the form can offer the explicit duplicate override. The
  // pending body is held here so "Save anyway" resends it verbatim with
  // duplicateAccepted rather than re-deriving it.
  const [duplicateRetry, setDuplicateRetry] = useState(null);

  const createRecord = useCreateCommunityRecord(communityId);
  const updateRecord = useUpdateCommunityRecord(communityId);
  const deleteRecord = useDeleteCommunityRecord(communityId);
  const formSaving = createRecord.isPending || updateRecord.isPending;

  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPageNumber(1);
  });

  // "ALL" is a sentinel that is never sent — the backend treats an omitted
  // filter as no filter, and sending "ALL" would be an invalid enum and 400.
  // Search is trimmed and left undefined when blank rather than sent as "".
  const params = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      source: source !== "ALL" ? source : undefined,
      type: type !== "ALL" ? type : undefined,
      direction: direction !== "ALL" ? direction : undefined,
      // Bare YYYY-MM-DD — LocalDate binding, see the note at the top.
      occurredOnFrom: from || undefined,
      occurredOnTo: to || undefined,
      pageNumber,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, source, type, direction, from, to, pageNumber],
  );

  const { data, isLoading, isFetching, error } = useCommunityRecords(communityId, params);
  const rows = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // A community staff member whose KYC isn't approved is downgraded to
  // COMMUNITY_MEMBER server-side, so this list 403s despite a correct role —
  // same situation as Groups.jsx. Only claimed when the KYC status is actually
  // known, so a 403 from any other cause still reads as a plain error.
  const kycGate = useKycGate();
  const kycGated = isKycGatedCommunityRequestError(error, kycGate.status, {
    isLoading: kycGate.isLoading,
    isError: kycGate.isError,
    exempt: kycGate.exempt,
  });

  function resetPage(setter) {
    return (value) => {
      setter(value);
      setPageNumber(1);
    };
  }

  function closeForm() {
    setEditing(null);
    setFormError("");
    setDuplicateRetry(null);
  }

  // A 409 is the backend asking for consent, not reporting a failure: this
  // duplicates a record the community already committed. It is surfaced as an
  // explicit choice rather than retried automatically — duplicateAccepted is
  // consent, not a validation bypass, and silently resending it would create
  // the duplicate the user never agreed to.
  async function save(payload, { acceptDuplicate = false } = {}) {
    const isEdit = Boolean(editing && editing !== "new");
    setFormError("");
    setDuplicateRetry(null);
    try {
      if (isEdit) {
        await updateRecord.mutateAsync({ recordId: editing.id, payload });
      } else {
        await createRecord.mutateAsync({
          ...payload,
          ...(acceptDuplicate ? { duplicateAccepted: true } : {}),
        });
      }
      closeForm();
      setOpenRecordId(null);
    } catch (err) {
      if (err?.response?.status === 409) {
        setFormError("This looks like a duplicate of a record you already have.");
        setDuplicateRetry(payload);
        return;
      }
      setFormError(getErrorMessage(err, "Couldn't save the record."));
    }
  }

  async function runDelete() {
    if (!confirmDelete) return;
    try {
      await deleteRecord.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
      setOpenRecordId(null);
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't delete the record."));
      setConfirmDelete(null);
    }
  }

  if (!communityId) {
    return (
      <div className="px-4 md:px-8 py-6">
        <h1 className="text-xl font-bold text-black mb-1">Records</h1>
        <p className="text-sm text-gray-400">
          Pick a community first — records belong to a single community.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 md:px-8 py-6 overflow-y-auto min-h-0">
      <div className="mb-5 flex-shrink-0 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-black mb-1">Records</h1>
          <p className="text-sm text-gray-400">
            Historical activity for this community. The record book does not move money or change
            any wallet balance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" fullWidth={false} onClick={() => setEditing("new")}>
            <Plus size={12} className="mr-1.5" />
            Add record
          </Button>
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              debouncedSet(v);
            }}
            placeholder="Search records…"
            label="Search records"
          />
          <FilterSelect
            value={source}
            onChange={resetPage(setSource)}
            options={SOURCE_OPTIONS}
            label="Filter by source"
          />
          <FilterSelect
            value={type}
            onChange={resetPage(setType)}
            options={TYPE_OPTIONS}
            label="Filter by type"
          />
          <FilterSelect
            value={direction}
            onChange={resetPage(setDirection)}
            options={DIRECTION_OPTIONS}
            label="Filter by direction"
          />
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => resetPage(setFrom)(e.target.value)}
            aria-label="Occurred from"
            className="h-9 rounded-lg border border-surface-container-border bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:border-brand"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => resetPage(setTo)(e.target.value)}
            aria-label="Occurred to"
            className="h-9 rounded-lg border border-surface-container-border bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {kycGated && <CommunityStaffKycNotice className="mb-4" />}

      <TableShell
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        error={error}
        emptyIcon={BookOpen}
        emptyLabel="No records yet"
        forbiddenMessage="Records are visible to community admins, treasurers and viewers."
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Occurred", "Type", "Description", "Amount", "Source", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((record, i) => (
              <tr
                key={record.id}
                onClick={() => setOpenRecordId(record.id)}
                // Row-click alone is mouse-only, which left the same drawer
                // unreachable by keyboard in SettlementsList until it was fixed.
                tabIndex={0}
                role="button"
                aria-label={`View record dated ${record.occurredOn ?? "unknown date"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenRecordId(record.id);
                  }
                }}
                className={`hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand transition-colors cursor-pointer ${
                  i < rows.length - 1 ? "border-b border-surface-sunken" : "border-b-0"
                }`}
              >
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {record.occurredOn ? fmtBusinessDate(record.occurredOn) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                  {(record.recordType ?? "—").replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  {record.description || record.payerName || "—"}
                </td>
                <td className="px-4 py-3">
                  <AmountCell record={record} />
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={record.source} />
                </td>
                <td className="px-4 py-3">
                  <ReviewBadge status={record.reviewStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isFetching && <p className="px-4 py-2 text-[10px] text-gray-400">Refreshing…</p>}
      </TableShell>

      <TableFooter
        totalElements={totalElements}
        noun="record"
        // TableChrome's Pager is 0-indexed; the backend's pageNumber is not.
        page={pageNumber - 1}
        totalPages={totalPages}
        onPage={(i) => setPageNumber(i + 1)}
      />

      {openRecordId && (
        <RecordDetail
          communityId={communityId}
          recordId={openRecordId}
          onClose={() => setOpenRecordId(null)}
          onEdit={(record) => {
            setFormError("");
            setDuplicateRetry(null);
            setEditing({ record });
          }}
          onDelete={(record) => setConfirmDelete(record)}
        />
      )}

      {editing && (
        <RecordFormModal
          key={editing === "new" ? "new" : editing.id}
          record={editing === "new" ? null : editing.record}
          onClose={closeForm}
          onSubmit={(payload) => save(payload)}
          saving={formSaving}
          error={formError}
          // Only offered after the backend actually returned 409, so the
          // override never appears for an unrelated failure.
          onAcceptDuplicate={
            duplicateRetry ? () => save(duplicateRetry, { acceptDuplicate: true }) : undefined
          }
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this record?"
          subtitle={fmtBusinessDate(confirmDelete.occurredOn)}
          description="This removes the record from the visible record book. It can't be undone."
          confirmLabel="Delete record"
          confirmingLabel="Deleting…"
          confirming={deleteRecord.isPending}
          error={formError}
          onConfirm={runDelete}
          onClose={() => {
            setConfirmDelete(null);
            setFormError("");
          }}
        />
      )}
    </div>
  );
}
