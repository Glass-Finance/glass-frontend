import { JOB_LABELS } from "../../../utils/recordBook";
export default function ImportProgress({ job }) {
  const timeline = [...(job.timeline ?? [])].sort((a, b) => a.sequence - b.sequence);
  return (
    <section className="rounded-g-2 md:rounded-g-3 bg-white border border-black/10 p-5 space-y-4">
      <div role="status" aria-live="polite">
        <h2 className="font-semibold">{JOB_LABELS[job.status] ?? "Checking import status"}</h2>
        <p className="text-sm text-ink-muted mt-2">
          {job.status === "COMMIT_QUEUED"
            ? "Your records are being saved. Editing is paused until this finishes."
            : "You can leave this page and return later. It will update automatically as your spreadsheet is processed."}
        </p>
      </div>
      <ol className="space-y-4">
        {timeline.map((entry) => (
          <li key={entry.sequence} className="border-l-2 border-brand/20 pl-4">
            <p className="text-sm font-medium">
              {entry.title || JOB_LABELS[entry.status] || "Import update"}
            </p>
            {entry.message && <p className="text-sm text-ink-muted mt-1">{entry.message}</p>}
            <p className="text-xs text-ink-muted mt-1">
              {new Date(entry.occurredAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
      {job.sourceRowsScanned != null && (
        <p className="text-sm text-ink-muted">
          {job.sourceRowsScanned} source rows read · {job.generatedRows ?? 0} draft records prepared
        </p>
      )}
    </section>
  );
}
