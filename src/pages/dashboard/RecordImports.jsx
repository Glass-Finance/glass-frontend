import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
import { useRecordImports } from "../../hooks/useRecordImports";
import { Button } from "../../components/ui/Button";
import { JOB_LABELS, jobLabel } from "../../utils/recordBook";
import RecordsTabs from "./records/RecordsTabs";
import ImportUploadModal from "./records/ImportUploadModal";
import AiUsageNotice from "./records/AiUsageNotice";
import { ErrorNotice, QueryState, Pager, Select } from "./records/RecordBookUI";
export default function RecordImports() {
  usePageTitle("Record imports");
  const access = useRecordBookAccess();
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Records</h1>
      <p className="text-sm text-ink-muted">Import spreadsheets and return to saved review work.</p>
      <RecordsTabs identifier={access.identifier} />
      {access.loading ? (
        <p role="status">Loading access…</p>
      ) : access.error ? (
        <ErrorNotice error={access.error} />
      ) : !access.import ? (
        <ErrorNotice message="You don't have permission to import records for this community." />
      ) : (
        <ImportsContent key={access.id} access={access} />
      )}
    </div>
  );
}
function ImportsContent({ access }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [upload, setUpload] = useState(searchParams.get("upload") === "1");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useRecordImports(access.id, {
    pageNumber: page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  function closeUpload() {
    setUpload(false);
    if (searchParams.has("upload")) {
      const next = new URLSearchParams(searchParams);
      next.delete("upload");
      setSearchParams(next, { replace: true });
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button size="md" fullWidth={false} onClick={() => setUpload(true)}>
          Import spreadsheet
        </Button>
        <AiUsageNotice communityId={access.id} allowed={access.usage} />
      </div>
      <section className="rounded-g-2 md:rounded-g-3 border border-black/10 bg-white p-3 md:p-5 space-y-5">
        <div className="max-w-sm">
          <Select
            label="Import status"
            value={status}
            options={JOB_LABELS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </div>
        <QueryState query={query} empty={query.data?.content?.length === 0}>
          <div className="divide-y divide-black/10">
            {query.data?.content?.map((job) => (
              <article
                key={job.id}
                className="py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm font-medium break-words">{jobLabel(job)}</h2>
                  <p className="text-sm text-ink-muted">
                    {JOB_LABELS[job.status] ?? "Unknown status"}
                  </p>
                  {job.status === "COMMITTED" && (
                    <p className="text-sm text-ink-muted">
                      {job.committedRows ?? 0} saved · {job.skippedRows ?? 0} skipped
                    </p>
                  )}
                </div>
                <Link
                  className="inline-flex min-h-12 items-center rounded-g-1 border border-black/10 px-4 text-sm text-brand"
                  to={`/dashboard/records/imports/${job.id}?community=${encodeURIComponent(access.identifier)}`}
                >
                  {job.status === "READY_FOR_REVIEW"
                    ? "Review records"
                    : ["COMMITTED", "DISCARDED"].includes(job.status)
                      ? "View result"
                      : "View progress"}
                </Link>
              </article>
            ))}
          </div>
        </QueryState>
        <Pager data={query.data} page={page} onChange={setPage} disabled={query.isFetching} />
      </section>
      {upload && (
        <ImportUploadModal
          communityId={access.id}
          identifier={access.identifier}
          onClose={closeUpload}
        />
      )}
    </div>
  );
}
