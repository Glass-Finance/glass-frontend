import { formatRecordAmount, formatRecordDate } from "../../../utils/recordBook";
export default function RecordDeleteSummary({ row }) {
  return (
    <div className="rounded-g-1 border border-surface-container-border bg-stacked-container/40 p-3 space-y-1 text-sm">
      <p className="font-medium break-words">
        {row.payerName || row.payerReference || "Unlinked payer"}
      </p>
      <p>
        {formatRecordAmount(row.amount, row.currency)} · {formatRecordDate(row.occurredOn)}
      </p>
      {row.description && <p className="text-ink-muted break-words">{row.description}</p>}
    </div>
  );
}
