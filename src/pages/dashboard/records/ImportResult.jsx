import { Link } from "react-router-dom";
export default function ImportResult({ job, identifier }) {
  return (
    <section
      className="rounded-g-2 md:rounded-g-3 border border-black/10 bg-white p-5 space-y-4"
      aria-live="polite"
    >
      <h2 className="text-lg font-semibold">
        {job.status === "COMMITTED" ? "Your records have been saved" : "This import was discarded"}
      </h2>
      <p className="text-sm text-ink-muted">
        {job.status === "COMMITTED"
          ? `${job.committedRows ?? 0} records saved · ${job.skippedRows ?? 0} skipped. These are the counts at the time of import.`
          : "Pending rows were removed. No records from this import were added to the record book."}
      </p>
      {job.status === "COMMITTED" && (
        <Link
          className="text-brand underline text-sm"
          to={`/dashboard/records?community=${encodeURIComponent(identifier)}&importJobId=${job.id}`}
        >
          View saved records
        </Link>
      )}
    </section>
  );
}
