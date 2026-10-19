import { Check, ChevronDown, Circle, CircleAlert, LoaderCircle } from "lucide-react";
import { JOB_LABELS } from "../../../utils/recordBook";

const ACTIVE = new Set([
  "QUEUED",
  "READING_FILE",
  "INFERRING_MAPPING",
  "APPLYING_MAPPING",
  "ASSISTING_ROWS",
  "COMMIT_QUEUED",
]);
const DESCRIPTIONS = {
  QUEUED: "Your spreadsheet is waiting for processing to begin.",
  READING_FILE: "Reading the worksheets and source values in your spreadsheet.",
  INFERRING_MAPPING: "Identifying which columns contain dates, amounts and payer details.",
  APPLYING_MAPPING: "Turning the spreadsheet values into draft community records.",
  ASSISTING_ROWS:
    "Checking values that need interpretation. You can review the results before saving.",
  READY_FOR_REVIEW: "Your draft records are ready. Check, correct or skip them before saving.",
  COMMIT_QUEUED:
    "Your request to save is queued or processing. We will show the results when saving finishes.",
  COMMITTED: "Your reviewed records have been saved to the community record book.",
  FAILED: "Processing stopped. Check the explanation and available recovery actions below.",
  DISCARDED: "This import was discarded. Its history remains available.",
};
export default function ImportProgress({ job, compact = false }) {
  const timeline = [...(job.timeline ?? [])].sort((a, b) => a.sequence - b.sequence);
  // A refreshed status may arrive before its timeline entry. Keep that state visible
  // without inventing completed stages or treating retries as linear progress.
  if (timeline.at(-1)?.status !== job.status) {
    timeline.push({ sequence: `current-${job.status}`, status: job.status });
  }
  const running = ACTIVE.has(job.status);
  const current = timeline.at(-1);
  const activity = (
    <ol className="space-y-0">
      {timeline.map((entry, index) => {
        const isCurrent = entry === current;
        const failed = entry.status === "FAILED";
        const waiting = isCurrent && entry.status === "QUEUED";
        const Icon = failed
          ? CircleAlert
          : isCurrent && running
            ? waiting
              ? Circle
              : LoaderCircle
            : Check;
        const label = failed
          ? "Failed"
          : isCurrent && running
            ? waiting
              ? "Waiting"
              : "In progress"
            : "Finished";
        return (
          <li key={entry.sequence} className="relative flex gap-3 pb-4 last:pb-0">
            {index < timeline.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-4 top-8 bottom-0 border-l border-surface-container-border"
              />
            )}
            <span
              className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ${failed ? "bg-danger-wash text-danger" : isCurrent && running ? "bg-brand/10 text-brand" : "bg-stacked-container text-ink-muted"}`}
            >
              <Icon
                aria-hidden="true"
                size={16}
                className={
                  isCurrent && running && !waiting ? "animate-spin motion-reduce:animate-none" : ""
                }
              />
            </span>
            <details
              open={isCurrent}
              className="group min-w-0 flex-1 rounded-g-1 border border-surface-container-border bg-surface-bg"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-medium break-words">
                    {entry.title || JOB_LABELS[entry.status] || "Import update"}
                  </span>
                  <span
                    className={`block mt-1 text-xs ${failed ? "text-danger" : isCurrent && running ? "text-brand" : "text-ink-ghost"}`}
                  >
                    {label}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-ink-ghost group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-surface-container-border px-3 py-3 space-y-2">
                <p className="text-sm text-ink-muted break-words">
                  {entry.message ||
                    DESCRIPTIONS[entry.status] ||
                    "The import status has changed. Check the latest details below."}
                </p>
                {entry.occurredAt && (
                  <p className="text-xs text-ink-ghost">
                    {new Date(entry.occurredAt).toLocaleString()}
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
  if (compact)
    return (
      <details className="rounded-g-3 border border-surface-container-border bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium py-1">Processing activity</summary>
        <div className="mt-4">{activity}</div>
      </details>
    );
  return (
    <section
      aria-label="Import processing activity"
      className="rounded-g-3 bg-white border border-surface-container-border p-4 sm:p-5 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div role="status" aria-live="polite">
          <h2 className="text-sm font-semibold">
            {JOB_LABELS[job.status] ?? "Checking import status"}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            {DESCRIPTIONS[job.status] || "Checking the latest import details."}
          </p>
        </div>
        {running && (
          <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-brand animate-pulse motion-reduce:animate-none"
            />
            Updating automatically
          </span>
        )}
      </div>
      {activity}
      {(job.sourceRowsScanned != null || job.generatedRows != null) && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-surface-container-border pt-4">
          {[
            ["Source rows read", job.sourceRowsScanned],
            ["Draft records prepared", job.generatedRows],
          ]
            .filter(([, value]) => value != null)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-ghost">{label}</dt>
                <dd className="mt-1 text-base font-semibold">{Number(value).toLocaleString()}</dd>
              </div>
            ))}
        </dl>
      )}
      {running && (
        <p className="text-xs text-ink-ghost">
          You can leave and return to this import. Processing continues in the background.
        </p>
      )}
    </section>
  );
}
