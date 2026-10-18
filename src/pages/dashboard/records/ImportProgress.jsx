import { JOB_LABELS } from "../../../utils/recordBook";
export default function ImportProgress({ job, compact = false }) {
  const timeline = [...(job.timeline ?? [])].sort((a, b) => a.sequence - b.sequence);
  const activity = (
    <ol className="space-y-3">
      {timeline.map((entry) => (
        <li key={entry.sequence} className="border-l-2 border-brand/20 pl-3">
          <p className="text-xs font-medium">
            {entry.title || JOB_LABELS[entry.status] || "Import update"}
          </p>
          {entry.message && <p className="text-xs text-ink-muted mt-1">{entry.message}</p>}
          <p className="text-xs text-ink-ghost mt-1">
            {new Date(entry.occurredAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
  if (compact)
    return (
      <details className="text-xs text-ink-muted">
        <summary className="cursor-pointer py-2">Processing activity</summary>
        <div className="mt-3 mb-4">{activity}</div>
      </details>
    );
  return (
    <section className="rounded-g-3 bg-surface-container border border-surface-container-border p-4 space-y-4">
      <div role="status" aria-live="polite">
        <h2 className="text-sm font-semibold">
          {JOB_LABELS[job.status] ?? "Checking import status"}
        </h2>
        <p className="text-xs text-ink-ghost mt-1">
          {job.status === "COMMIT_QUEUED"
            ? "Saving your records. Editing will resume if anything needs attention."
            : "Progress updates automatically. You can leave and return to this import."}
        </p>
      </div>
      {activity}
      {job.sourceRowsScanned != null && (
        <p className="text-xs text-ink-ghost">
          {job.sourceRowsScanned} source rows read · {job.generatedRows ?? 0} draft records prepared
        </p>
      )}
    </section>
  );
}
