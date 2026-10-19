import { Upload, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFileDrop } from "../../hooks/useFileDrop";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
import { useRecordImports } from "../../hooks/useRecordImports";
import { Button } from "../../components/ui/Button";
import { JOB_LABELS } from "../../utils/recordBook";
import RecordsHeader from "./records/RecordsHeader";
import ImportUploadModal from "./records/ImportUploadModal";
import AiUsageNotice from "./records/AiUsageNotice";
import { ErrorNotice, QueryState, Pager, Select } from "./records/RecordBookUI";
export default function RecordImports() {
  usePageTitle("Record imports");
  const access = useRecordBookAccess();
  const dropRoot = useRef(null);
  return (
    <div ref={dropRoot} role="region" aria-label="Record imports page" className="relative h-full">
      {(access.loading || access.error || !access.import) && (
        <div className="px-4 md:px-6 pt-6">
          <RecordsHeader identifier={access.identifier} />
        </div>
      )}
      {access.loading ? (
        <p role="status">Loading access…</p>
      ) : access.error ? (
        <ErrorNotice error={access.error} />
      ) : !access.import ? (
        <ErrorNotice message="You don't have permission to import records for this community." />
      ) : (
        <ImportsContent key={access.id} access={access} dropRoot={dropRoot} />
      )}
    </div>
  );
}
function ImportsContent({ access, dropRoot }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [upload, setUpload] = useState(searchParams.get("upload") === "1");
  const [droppedFiles, setDroppedFiles] = useState([]);
  const { dragging, dropHandlers, resetDrag } = useFileDrop(
    (files, event) => {
      if (!(event.target instanceof Node) || !dropRoot.current?.contains(event.target)) return;
      setDroppedFiles(files);
      setUpload(true);
    },
    upload,
    true,
  );
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const query = useRecordImports(access.id, {
    pageNumber: page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  function closeUpload() {
    setUpload(false);
    setDroppedFiles([]);
    resetDrag();
    if (searchParams.has("upload")) {
      const next = new URLSearchParams(searchParams);
      next.delete("upload");
      setSearchParams(next, { replace: true });
    }
  }
  return (
    <>
      {dragging && (
        <div
          role="group"
          aria-label="Spreadsheet page drop target"
          className="absolute inset-0 z-20 bg-white/80 p-4 md:p-8"
        >
          <div className="pointer-events-none flex h-full items-center justify-center rounded-g-3 border-2 border-dashed border-brand p-6 text-center">
            <div role="status" className="max-w-md space-y-4 rounded-g-3 bg-white p-6">
              <Upload size={48} className="mx-auto text-brand" aria-hidden="true" />
              <p className="text-xl font-semibold">Drop spreadsheets to import</p>
              <p className="text-sm text-ink-muted">CSV, TSV, XLSX, or XLS · Up to 25 MiB each</p>
              <p className="text-sm text-ink-muted">You'll review the files before uploading.</p>
            </div>
          </div>
        </div>
      )}
      <div
        role="group"
        aria-label="Imports page drop zone"
        className="px-4 md:px-6 py-6 h-full overflow-y-auto"
        {...dropHandlers}
      >
        <RecordsHeader
          identifier={access.identifier}
          description="Import spreadsheets and manage your community's historical records."
        >
          <Button
            size="sm-tight"
            fullWidth={false}
            onClick={() => {
              resetDrag();
              setUpload(true);
            }}
          >
            <Upload size={13} />
            Import spreadsheet
          </Button>
        </RecordsHeader>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Imports</h2>
              <AiUsageNotice communityId={access.id} allowed={access.usage} />
            </div>
            <div className="max-w-sm">
              <Select
                compact
                hideLabel
                empty="All statuses"
                label="Import status"
                value={status}
                options={JOB_LABELS}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <QueryState
            query={query}
            empty={query.data?.content?.length === 0}
            emptyIcon={FileSpreadsheet}
            emptyTitle={status ? "No matching imports" : "No imports yet"}
            emptyDescription={
              status
                ? "Try another status to find your import."
                : "Import a spreadsheet to bring historical records into your community."
            }
          >
            <div className="rounded-g-3 border border-surface-container-border bg-white overflow-hidden">
              <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_170px_140px_120px] gap-4 bg-stacked-container/60 px-4 py-3 text-xs text-ink-ghost">
                <span>Import</span>
                <span>Status</span>
                <span>Records</span>
                <span className="sr-only">Action</span>
              </div>
              <div className="divide-y divide-surface-container-border">
                {query.data?.content?.map((job) => (
                  <Link
                    key={job.id}
                    to={`/dashboard/records/imports/${job.id}?community=${encodeURIComponent(access.identifier)}`}
                    className="hover:bg-stacked-container/30 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_170px_140px_120px] items-center gap-3 md:gap-4 px-4 py-4 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <FileSpreadsheet size={18} className="shrink-0 text-ink-ghost" />
                      <div className="min-w-0">
                        <h3 className="font-medium break-words">
                          {job.fileFormat || "Spreadsheet"} import{" "}
                          <span className="text-ink-ghost font-normal">
                            #{String(job.id).slice(0, 6)}
                          </span>
                        </h3>
                        <p className="text-ink-ghost mt-1">
                          {job.createdAt
                            ? new Date(job.createdAt).toLocaleString()
                            : "Date unavailable"}
                        </p>
                      </div>
                    </div>
                    <p>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs ${job.status === "COMMITTED" ? "bg-success-wash text-success" : job.status === "FAILED" ? "bg-danger-wash text-danger" : job.status === "READY_FOR_REVIEW" ? "bg-warning-wash text-warning" : "bg-stacked-container text-ink-muted"}`}
                      >
                        {JOB_LABELS[job.status] ?? "Unknown status"}
                      </span>
                    </p>
                    <p className="text-ink-muted">
                      {job.status === "COMMITTED"
                        ? `${job.committedRows ?? 0} saved · ${job.skippedRows ?? 0} skipped`
                        : job.status === "READY_FOR_REVIEW"
                          ? `${Object.values(job.reviewTotals ?? {}).reduce((sum, n) => sum + Number(n), 0)} to review`
                          : "—"}
                    </p>
                    <span className="inline-flex items-center justify-center min-h-11 md:min-h-8 rounded-g-1 border border-brand bg-brand px-3 text-xs text-white w-fit">
                      {job.status === "READY_FOR_REVIEW"
                        ? "Review records"
                        : ["COMMITTED", "DISCARDED"].includes(job.status)
                          ? "View result"
                          : "View progress"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </QueryState>
          <Pager
            noun="imports"
            data={query.data}
            page={page}
            onChange={setPage}
            disabled={query.isFetching}
          />
        </section>
        {upload && (
          <ImportUploadModal
            communityId={access.id}
            identifier={access.identifier}
            onClose={closeUpload}
            initialFiles={droppedFiles}
          />
        )}
      </div>
    </>
  );
}
