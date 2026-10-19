import { Link, useNavigate } from "react-router-dom";
import DashboardDialog from "../../../components/dashboard/DashboardDialog";
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
  const navigate = useNavigate();
  const query = useCommunityRecord(communityId, recordId);
  const row = query.data;
  return (
    <DashboardDialog
      title="Record details"
      size="detail"
      onClose={onClose}
      footer={
        row && !query.error ? (
          row.source === "PLATFORM" ? (
            <div className="flex justify-end">
              {row.transactionId && (
                <Button
                  variant="primary"
                  size="sm-tight"
                  fullWidth={false}
                  onClick={() =>
                    navigate(
                      `/dashboard/transactions/${encodeURIComponent(row.transactionId)}?community=${encodeURIComponent(identifier)}`,
                    )
                  }
                >
                  View original transaction
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-3">
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
              {canEdit && (
                <Button size="sm-tight" fullWidth={false} onClick={() => onEdit(row)}>
                  Edit record
                </Button>
              )}
            </div>
          )
        ) : undefined
      }
    >
      <div className="space-y-4">
        <QueryState query={query}>
          {row && (
            <div className="space-y-5">
              <p className="text-xl font-semibold">
                {formatRecordAmount(row.amount, row.currency)}
              </p>
              <RecordFacts row={row} />
              {row.source === "PLATFORM" && (
                <p className="text-sm text-ink-muted">Glass transaction records are read-only.</p>
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
    </DashboardDialog>
  );
}

export function SourceEvidence({ cells = [] }) {
  if (!cells?.length) return null;
  return (
    <details className="rounded-g-1 border border-black/10 p-3">
      <summary className="cursor-pointer min-h-11 content-center text-sm font-medium">
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

export function RecordFacts({ row }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
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
        <div key={label} className={`min-w-0 ${label === "Description" ? "sm:col-span-2" : ""}`}>
          <dt className="text-ink-muted">{label}</dt>
          <dd className="break-words mt-1">{value || "Not provided"}</dd>
        </div>
      ))}
    </dl>
  );
}
