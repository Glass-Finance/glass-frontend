import { useMemo, useState } from "react";
import { AlertTriangle, SkipForward, Trash2, Pencil } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import LoadingState from "../../../../components/common/LoadingState";
import { SearchBar, FilterSelect } from "../../../../components/dashboard/TableChrome";
import { useImportJobRows } from "../../../../hooks/useRecordImports";
import {
  useUpdateImportJobRow,
  useBulkUpdateImportJobRows,
  useCreateImportJobRow,
  useDeleteImportJobRow,
} from "../../../../hooks/useRecordImports";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { fmt } from "../../platform-admin/shared";
import { reviewStatusLabel } from "../../../../utils/recordBook";

// Review rows for one import job.
//
// Reachable only at READY_FOR_REVIEW — every mutation here is rejected by the
// backend in any other state, and importJobActions() in utils/recordBook.js is
// what decides whether the screen is shown at all.
//
// A row write CAN come back INVALID or REVIEW_REQUIRED with fresh issues and
// still resolve successfully. That is a normal outcome, not an error, so the
// mutations invalidate and re-read rather than asserting success.

const PAGE_SIZE = 20;

const REVIEW_OPTIONS = [
  { value: "ALL", label: "All rows" },
  { value: "VALID", label: "Valid" },
  { value: "INVALID", label: "Invalid" },
  { value: "REVIEW_REQUIRED", label: "Needs review" },
  { value: "SKIPPED", label: "Skipped" },
];

const ISSUE_TONE = {
  ERROR: "var(--color-danger-tint)",
  REVIEW: "var(--color-warning-tint)",
  WARNING: "var(--color-stacked-container)",
};

function IssueList({ issues }) {
  if (!issues?.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className="flex items-start gap-1.5">
          <AlertTriangle
            size={11}
            className="mt-0.5 shrink-0"
            style={{
              color: issue.severity === "ERROR" ? "var(--color-danger)" : "var(--color-warning)",
            }}
          />
          <span className="text-[10px] text-gray-600">{issue.message ?? issue.code}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RowReview({ communityId, job, onEditRow }) {
  const jobId = job.id;
  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [actionError, setActionError] = useState("");

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      reviewStatus: reviewStatus !== "ALL" ? reviewStatus : undefined,
      pageNumber,
      pageSize: PAGE_SIZE,
    }),
    [search, reviewStatus, pageNumber],
  );

  const { data, isLoading, error } = useImportJobRows(communityId, jobId, params);
  const rows = data?.content ?? [];
  const totalPages = data?.totalPages ?? 1;

  const updateRow = useUpdateImportJobRow(communityId);
  const bulkPatch = useBulkUpdateImportJobRows(communityId);
  const createRow = useCreateImportJobRow(communityId);
  const deleteRow = useDeleteImportJobRow(communityId);

  const busy =
    updateRow.isPending || bulkPatch.isPending || createRow.isPending || deleteRow.isPending;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Every row action reports failures inline rather than toasting, because the
  // refresh that follows is what actually tells the user whether it landed.
  async function run(action, fallback) {
    setActionError("");
    try {
      await action();
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err, fallback));
      return false;
    }
  }

  // Bulk is capped at 500 server-side; selection is per-page here, so the cap
  // is only reachable by adding across pages — still worth refusing early.
  async function bulkSkip() {
    const rowIds = [...selected];
    if (rowIds.length === 0) return;
    await run(
      () => bulkPatch.mutateAsync({ jobId, rowIds, patch: { skip: true } }),
      "Couldn't skip those rows.",
    );
    setSelected(new Set());
  }

  async function bulkUnskip() {
    const rowIds = [...selected];
    if (rowIds.length === 0) return;
    await run(
      () => bulkPatch.mutateAsync({ jobId, rowIds, patch: { skip: false } }),
      "Couldn't unskip those rows.",
    );
    setSelected(new Set());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPageNumber(1);
            }}
            placeholder="Search rows…"
            label="Search rows"
            width={180}
          />
          <FilterSelect
            value={reviewStatus}
            onChange={(v) => {
              setReviewStatus(v);
              setPageNumber(1);
            }}
            options={REVIEW_OPTIONS}
            label="Filter rows by review status"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">
            {selected.size > 0 ? `${selected.size} selected` : ""}
          </span>
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            disabled={selected.size === 0 || busy}
            onClick={bulkUnskip}
          >
            Unskip
          </Button>
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            disabled={selected.size === 0 || busy}
            onClick={bulkSkip}
          >
            <SkipForward size={12} className="mr-1.5" />
            Skip
          </Button>
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            disabled={busy}
            onClick={() => createRow.mutate({ jobId, payload: {} })}
            title="Add a manual row"
          >
            <Pencil size={12} className="mr-1.5" />
            Add row
          </Button>
        </div>
      </div>

      {actionError && <p className="text-xs text-danger mb-3">{actionError}</p>}

      <div className="bg-surface-container rounded-2xl overflow-hidden border border-surface-container-border">
        {isLoading ? (
          <LoadingState className="py-12" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 px-6 text-center">
            <p className="text-xs font-semibold text-danger">Couldn't load rows</p>
            <p className="text-xs text-gray-400">{getErrorMessage(error)}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-gray-400">No rows match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-stacked-container">
                  <th className="px-3 py-3 w-8" />
                  {["Row", "Date", "Description", "Amount", "Review", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isSkipped = row.reviewStatus === "SKIPPED";
                  // Only MANUAL pending additions can be deleted; generated rows
                  // must be skipped instead, and the backend refuses DELETE.
                  const deletable = row.source === "MANUAL" && !isSkipped;
                  return (
                    <tr
                      key={row.id}
                      className={
                        i < rows.length - 1 ? "border-b border-surface-sunken" : "border-b-0"
                      }
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select row ${row.sourceRowNumber ?? row.id}`}
                          className="accent-brand"
                        />
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                        {row.sourceRowNumber ?? "—"}
                        {row.sheetName ? (
                          <span className="block text-[10px] text-gray-400">{row.sheetName}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700">
                        <span className={isSkipped ? "line-through text-gray-400" : ""}>
                          {row.description || row.payerName || "—"}
                        </span>
                        <IssueList issues={row.issues} />
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {/* minor: false — import rows carry major-unit amounts
                            like every other record figure. */}
                        {fmt(row.amount, row.currency, { minor: false, decimals: 2 })}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background:
                              ISSUE_TONE[
                                row.reviewStatus === "INVALID"
                                  ? "ERROR"
                                  : row.reviewStatus === "REVIEW_REQUIRED"
                                    ? "REVIEW"
                                    : "WARNING"
                              ],
                          }}
                        >
                          {reviewStatusLabel(row.reviewStatus)}
                        </span>
                        {row.rowAssistanceAcceptanceRequired && (
                          <span className="block mt-1 text-[10px] text-gray-400">
                            Needs acceptance
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline-neutral"
                            size="xs"
                            fullWidth={false}
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  updateRow.mutateAsync({
                                    jobId,
                                    rowId: row.id,
                                    payload: { skip: !isSkipped },
                                  }),
                                "Couldn't update that row.",
                              )
                            }
                            aria-label={isSkipped ? "Unskip row" : "Skip row"}
                          >
                            {isSkipped ? "Unskip" : "Skip"}
                          </Button>
                          <Button
                            variant="outline-neutral"
                            size="xs"
                            fullWidth={false}
                            disabled={busy}
                            onClick={() => onEditRow(row)}
                            aria-label="Edit row"
                          >
                            <Pencil size={12} />
                          </Button>
                          {deletable && (
                            <Button
                              variant="critical"
                              size="xs"
                              fullWidth={false}
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => deleteRow.mutateAsync({ jobId, rowId: row.id }),
                                  "Couldn't delete that row.",
                                )
                              }
                              aria-label="Delete row"
                            >
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-[11px] text-gray-400">
          {(data?.totalElements ?? 0).toLocaleString()} row
          {data?.totalElements === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            Prev
          </Button>
          <span className="text-[11px] text-gray-500 px-1">
            Page {pageNumber} of {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            disabled={pageNumber >= totalPages}
            onClick={() => setPageNumber((p) => p + 1)}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
