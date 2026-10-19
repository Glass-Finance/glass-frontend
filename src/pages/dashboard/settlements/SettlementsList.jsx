import { useState, useMemo } from "react";
import { Button } from "../../../components/ui/Button";
import { Landmark, ShieldCheck, ShieldAlert } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import LoadingState from "../../../components/common/LoadingState";
import EmptyState from "../../../components/common/EmptyState";
import { SkeletonTable } from "../../../components/common/SkeletonUI";
import { getErrorMessage } from "../../../utils/errorHandler";
import { useDebounce } from "../../../hooks/useDebounce";
import { useActiveCommunityId } from "../../../hooks/useActiveCommunityId";
import {
  useCommunitySettlements,
  useCommunitySettlement,
} from "../../../hooks/useCommunitySettlements";
// Only the pure formatting/colour helpers are borrowed from the platform-admin
// folder (fmt, fmtDateTime, STATUS_COLORS all cover the four statuses this
// screen can see). The chrome is deliberately NOT taken from there:
// platform-admin/SharedUI.jsx's TableShell hardcodes "Platform admin rights
// required to view this data." for a 403, which would be the wrong copy for a
// community admin. Relocating those helpers to a neutral home is a reasonable
// follow-up once a second consumer exists, but it would touch every
// platform-admin section, so it is not bundled into this change.
import { fmt as fmtCurrency, fmtDateTime, STATUS_COLORS } from "../platform-admin/shared";

const PAGE_SIZE = 20;

// Community settlement totals and matched transaction amounts are already
// in major currency units. Keep their decimal precision without rescaling.
function fmt(amount, currency) {
  return fmtCurrency(amount, currency, { minor: false, decimals: 2 });
}

// Columns of the settlements table, defined once and read by both the real
// <thead> and the loading placeholder, so a column added to one cannot leave
// the other a column short. All are visible at every breakpoint.
const SETTLEMENT_COLUMNS = ["Settled", "Gross", "Deductions", "Net", "Status", "Matched txns"];

// SettlementStatus enum values a community caller can actually observe. The
// backend filters MISMATCHED and REVIEWED out of both the list and the detail
// endpoint, so offering them here would only ever produce an empty page.
// PENDING / PROCESSING / SUCCESS / FAILED is the real, closed set.
const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SUCCESS", label: "Settled" },
  { value: "FAILED", label: "Failed" },
];

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] ?? { bg: "bg-gray-100", text: "text-gray-500" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors.bg} ${colors.text}`}
    >
      {(status ?? "—").replace(/_/g, " ")}
    </span>
  );
}

/** Native date input → ISO instant, omitting blanks so the filter stays unset. */
function toInstant(value, endOfDay = false) {
  if (!value) return undefined;
  // Parse as a LOCAL date rather than letting `new Date("2026-09-30")` read it
  // as UTC midnight — that silently dropped everything settled later on the
  // chosen end date, and (for anyone east of UTC) shifted the start bound too.
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function SettlementDetail({ communityId, settlementId, onClose }) {
  const { data, isLoading, error } = useCommunitySettlement(communityId, settlementId);
  const transactions = data?.transactions ?? [];
  const gone = error?.response?.status === 404;

  return (
    <ModalShell
      title="Settlement"
      subtitle={data?.settledAt ? fmtDateTime(data.settledAt) : ""}
      onClose={onClose}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <LoadingState className="py-10" />
        ) : gone ? (
          <EmptyState
            icon={Landmark}
            title="This settlement is no longer available"
            subtitle="Settlements awaiting review are not shown to community admins."
          />
        ) : error ? (
          <p className="text-xs text-danger">{getErrorMessage(error)}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ["Gross", data.gross],
                ["Net", data.net],
                ["Deductions", data.deductions],
                ["Total", data.totalAmount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white rounded-xl p-3 border border-surface-container-border"
                >
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(value, data.currency)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900">
                Matched Transactions ({data.matchedTransactionCount ?? transactions.length})
              </p>
              <StatusBadge status={data.status} />
            </div>

            {transactions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No transactions linked to this settlement.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-lg p-3 flex items-center justify-between gap-3 border border-surface-container-border"
                  >
                    <div className="min-w-0">
                      {/* No reference: CommunitySettlementTransactionResponse
                          omits it (the admin response has it), so the row is
                          identified by when it was paid. */}
                      <p className="text-[11px] text-gray-500">{fmtDateTime(t.paidAt)}</p>
                      <p className="text-[10px] text-gray-400">
                        {(t.status ?? "").replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {t.matched ? (
                        <ShieldCheck size={13} className="text-success" />
                      ) : (
                        <ShieldAlert size={13} className="text-danger" />
                      )}
                      <span className="text-xs font-semibold text-gray-900">
                        {fmt(t.amount, t.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function SettlementsList() {
  const communityId = useActiveCommunityId();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [openSettlementId, setOpenSettlementId] = useState(null);

  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPageNumber(1);
  });

  const params = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status !== "ALL" ? status : undefined,
      settledFrom: toInstant(from),
      settledTo: toInstant(to, true),
      pageNumber,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, status, from, to, pageNumber],
  );

  const { data, isLoading, isFetching, error } = useCommunitySettlements(communityId, params);
  const items = data?.content ?? [];
  const is403 = error?.response?.status === 403;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-ink m-0">Settlements</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Gateway settlement batches for this community.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debouncedSet(e.target.value);
            }}
            placeholder="Search settlements…"
            aria-label="Search settlements"
            className="h-9 w-[200px] rounded-lg border border-surface-container-border bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-brand"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPageNumber(1);
            }}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-surface-container-border bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:border-brand"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPageNumber(1);
            }}
            aria-label="Settled from"
            className="h-9 rounded-lg border border-surface-container-border bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:border-brand"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPageNumber(1);
            }}
            aria-label="Settled to"
            className="h-9 rounded-lg border border-surface-container-border bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="bg-surface-container rounded-2xl overflow-hidden border border-surface-container-border">
        {isLoading ? (
          // Stand the table's shape in rather than a centred ring. The real
          // table below is inside the same overflow-x-auto wrapper and uses the
          // same six columns, so the card keeps its height and the rows do not
          // shove the content down when they arrive.
          <div className="overflow-x-auto">
            <SkeletonTable
              rows={5}
              columns={SETTLEMENT_COLUMNS.length}
              tableClassName="w-full border-collapse"
              headClassName="border-b border-stacked-container"
              cellClassName="px-4 py-3"
              headBarClassName="h-2.5 w-12"
            />
          </div>
        ) : is403 ? (
          /* Not an edge case: the endpoints require
             `community.reconciliation.read`, which COMMUNITY_MEMBER and
             COLLECTIONS_OFFICER do not hold. */
          <div className="flex flex-col items-center justify-center py-16 gap-2 px-6 text-center">
            <Landmark size={22} className="text-gray-300" />
            <p className="text-xs font-semibold text-gray-700">
              You don't have access to settlements
            </p>
            <p className="text-xs text-gray-400">
              Settlements are visible to community admins, treasurers and viewers.
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-xs font-semibold text-danger">Failed to load</p>
            <p className="text-xs text-gray-400">{getErrorMessage(error)}</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Landmark} title="No settlements found" className="py-16" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stacked-container">
                  {SETTLEMENT_COLUMNS.map((h) => (
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
                {items.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => setOpenSettlementId(s.id)}
                    // Row-click alone is mouse-only, so the drawer was
                    // unreachable by keyboard and unannounced to screen
                    // readers. tabIndex + role + Enter/Space make the same
                    // affordance real for everyone.
                    tabIndex={0}
                    role="button"
                    aria-label={`View settlement settled ${fmtDateTime(s.settledAt)}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenSettlementId(s.id);
                      }
                    }}
                    className={`hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
                  >
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                      {fmtDateTime(s.settledAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{fmt(s.gross, s.currency)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {fmt(s.deductions, s.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-900">
                      {fmt(s.net, s.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {s.matchedTransactionCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isFetching && <p className="px-4 py-2 text-[10px] text-gray-400">Refreshing…</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 px-1">
        <p className="text-[11px] text-gray-400">
          {(data?.totalElements ?? 0).toLocaleString()} settlement
          {data?.totalElements === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            Prev
          </Button>
          <span className="text-[11px] text-gray-500 px-1">
            Page {pageNumber} of {Math.max(1, data?.totalPages ?? 1)}
          </span>
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            onClick={() => setPageNumber((p) => p + 1)}
            disabled={pageNumber >= (data?.totalPages ?? 1)}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </div>

      {openSettlementId && (
        <SettlementDetail
          communityId={communityId}
          settlementId={openSettlementId}
          onClose={() => setOpenSettlementId(null)}
        />
      )}
    </div>
  );
}
