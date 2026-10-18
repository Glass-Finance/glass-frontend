import { Link } from "react-router-dom";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { useCommunityRecord } from "../../../hooks/useCommunityRecords";
import {
  RECORD_TYPES,
  DIRECTIONS,
  RECORD_SOURCES,
  formatRecordAmount,
  formatRecordDate,
} from "../../../utils/recordBook";
import { QueryState } from "./RecordBookUI";

export default function RecordDetailPanel({
  communityId,
  identifier,
  recordId,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onClose,
}) {
  const query = useCommunityRecord(communityId, recordId);
  const row = query.data;
  return (
    <ModalShell title="Record details" onClose={onClose}>
      <div className="p-5 max-h-[70vh] overflow-y-auto">
        <QueryState query={query}>
          {row && (
            <div className="space-y-5">
              <p className="text-xl font-semibold">
                {formatRecordAmount(row.amount, row.currency)}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ["Date", formatRecordDate(row.occurredOn)],
                  ["Source", RECORD_SOURCES[row.source]],
                  ["Type", RECORD_TYPES[row.recordType]],
                  ["Direction", DIRECTIONS[row.direction]],
                  ["Payer", row.payerName],
                  ["Payer reference", row.payerReference],
                  ["Description", row.description],
                  ["Category", row.categoryLabel],
                  ["External reference", row.externalReference],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="break-words mt-1">{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
              {row.source === "PLATFORM" ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">Glass transaction records are read-only.</p>
                  {row.transactionId && (
                    <Link
                      className="text-brand text-sm underline"
                      to={`/dashboard/transactions/${encodeURIComponent(row.transactionId)}?community=${encodeURIComponent(identifier)}`}
                    >
                      View original transaction
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  {canEdit && (
                    <Button size="sm-tight" fullWidth={false} onClick={() => onEdit(row)}>
                      Edit record
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm-tight"
                      fullWidth={false}
                      variant="outline-caution"
                      onClick={() => onDelete(row)}
                    >
                      Delete record
                    </Button>
                  )}
                </div>
              )}
              {row.importJobId && (
                <Link
                  className="block text-brand text-sm underline"
                  to={`/dashboard/records/imports/${row.importJobId}?community=${encodeURIComponent(identifier)}`}
                >
                  View source import
                </Link>
              )}
              <SourceEvidence cells={row.mappedSourceCells} />
            </div>
          )}
        </QueryState>
      </div>
    </ModalShell>
  );
}

export function SourceEvidence({ cells = [] }) {
  if (!cells?.length) return null;
  return (
    <details className="rounded-g-1 border border-black/10 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Original spreadsheet evidence ({cells.length})
      </summary>
      <div className="space-y-3 mt-3">
        {cells.map((cell, i) => (
          <div key={i} className="border-t border-black/10 pt-3 text-sm space-y-1">
            <p className="font-medium break-words">{cell.field || "Source value"}</p>
            <p className="text-ink-muted break-words">
              {cell.sheetName} · Row {cell.rowNumber}, column {cell.columnNumber}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {String(cell.rawValue ?? cell.renderedValue ?? cell.cachedValue ?? "Empty")}
            </p>
            {cell.formula && (
              <p className="break-words text-ink-muted">Formula (not executed): {cell.formula}</p>
            )}
            {cell.cachedValue != null && (
              <p className="break-words text-ink-muted">Saved result: {String(cell.cachedValue)}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
