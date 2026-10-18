import { Button } from "../../../components/ui/Button";
import {
  RECORD_TYPES,
  DIRECTIONS,
  RECORD_SOURCES,
  REVIEW_LABELS,
  formatRecordAmount,
  formatRecordDate,
} from "../../../utils/recordBook";
export default function RecordsTable({
  rows,
  onOpen,
  review = false,
  selected = [],
  onSelect,
  onSelectPage,
  frozen = false,
}) {
  return (
    <>
      <div className="hidden xl:block rounded-g-3 border border-surface-container-border bg-surface-container overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-ghost bg-stacked-container/60 border-b border-surface-container-border">
            <tr>
              {review && (
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    aria-label="Select this page"
                    checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                    onChange={onSelectPage}
                    disabled={frozen || !rows.length}
                    className="accent-brand"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Payer / description</th>
              <th className="px-4 py-3 font-medium">Type / direction</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">{review ? "Review" : "Source"}</th>
              <th className="px-4 py-3">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-b-0 border-surface-container-border hover:bg-stacked-container/30"
              >
                {review && (
                  <td className="px-4 py-3">
                    <input
                      aria-label={`Select record ${row.payerName || row.id}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => onSelect(row.id)}
                      disabled={frozen || (!selected.includes(row.id) && selected.length >= 500)}
                      className="accent-brand"
                    />
                  </td>
                )}
                <td className="px-4 py-3 whitespace-nowrap">{formatRecordDate(row.occurredOn)}</td>
                <td className="px-4 py-3 max-w-64">
                  <p className="font-medium break-words">
                    {row.payerName || row.payerReference || "Unlinked payer"}
                  </p>
                  <p className="text-ink-ghost mt-1 line-clamp-1 break-words">
                    {row.description || "No description"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{RECORD_TYPES[row.recordType] || "Type missing"}</p>
                  <p className="text-ink-muted">
                    {DIRECTIONS[row.direction] || "Direction missing"}
                  </p>
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {formatRecordAmount(row.amount, row.currency)}
                </td>
                <td className="px-4 py-3">
                  {review ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs ${row.reviewStatus === "VALID" ? "bg-success-wash text-success" : row.reviewStatus === "INVALID" ? "bg-danger-wash text-danger" : row.reviewStatus === "REVIEW_REQUIRED" ? "bg-warning-wash text-warning" : "bg-stacked-container text-ink-muted"}`}
                    >
                      {REVIEW_LABELS[row.reviewStatus] || "Check record"}
                    </span>
                  ) : (
                    RECORD_SOURCES[row.source] || "Unknown source"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="xs"
                    variant="outline-neutral"
                    fullWidth={false}
                    onClick={() => onOpen(row)}
                  >
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xl:hidden divide-y divide-surface-container-border rounded-g-3 border border-surface-container-border bg-surface-container px-4">
        {review && (
          <label className="flex items-center gap-3 py-3 text-sm">
            <input
              aria-label="Select this page"
              type="checkbox"
              checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
              onChange={onSelectPage}
              disabled={frozen || !rows.length}
              className="accent-brand"
            />
            Select this page
          </label>
        )}
        {rows.map((row) => (
          <div key={row.id} className="py-4 space-y-2">
            {review && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  aria-label={`Select record ${row.payerName || row.id}`}
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={() => onSelect(row.id)}
                  disabled={frozen || (!selected.includes(row.id) && selected.length >= 500)}
                  className="accent-brand"
                />
                Select record
              </label>
            )}
            <div className="flex justify-between gap-3">
              <p className="font-medium break-words min-w-0">
                {row.payerName || row.payerReference || "Unlinked payer"}
              </p>
              <p className="text-sm font-medium shrink-0">
                {formatRecordAmount(row.amount, row.currency)}
              </p>
            </div>
            <p className="text-sm text-ink-muted break-words">
              {row.description || "No description"}
            </p>
            <p className="text-sm text-ink-muted">
              {formatRecordDate(row.occurredOn)} ·{" "}
              {DIRECTIONS[row.direction] || "Direction missing"}
            </p>
            <div className="flex justify-between items-center">
              <span className="text-sm">
                {review ? REVIEW_LABELS[row.reviewStatus] : RECORD_SOURCES[row.source]}
              </span>
              <Button
                size="md"
                variant="outline-neutral"
                fullWidth={false}
                onClick={() => onOpen(row)}
              >
                Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
