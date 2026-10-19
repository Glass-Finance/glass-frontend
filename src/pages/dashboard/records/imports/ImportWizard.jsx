import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, Check } from "lucide-react";
import { usePageTitle } from "../../../../hooks/usePageTitle";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useFileUploadMultiple } from "../../../../hooks/useFileUpload";
import {
  useCreateImportJob,
  useImportJobs,
  useImportJob,
  useCommitImportJob,
  useDiscardImportJob,
  useRetryImportJob,
} from "../../../../hooks/useRecordImports";
import {
  importJobActions,
  importJobStatusLabel,
  isCommitFailureCode,
  isImportJobInFlight,
  isReviewOpen,
  REVIEW_STATUSES,
} from "../../../../utils/recordBook";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { Button } from "../../../../components/ui/Button";
import ConfirmDialog from "../../../../components/dashboard/ConfirmDialog";
import { TableShell, TableFooter } from "../../../../components/dashboard/TableChrome";
import { IMPORT_ACCEPT, validateImportFiles, formatBytes } from "./fileRules";
import RowReview from "./RowReview";

// Community record book — spreadsheet import.
//
// The flow, and the one thing that will bite:
//
//   pick spreadsheets → upload each → submit one job per file → poll
//   → review rows → commit → poll until COMMITTED
//
// ONE FILE IS ONE JOB. There is no combined multi-file import request, so
// picking three spreadsheets produces three jobs, not one. Multiple upload is
// only a convenience for obtaining several file IDs in one round trip.
//
// COMMIT IS NOT DONE WHEN IT RESPONDS. POST /commit answers 202 having queued
// the work, and a commit blocked by validation does not fail the job — it comes
// back READY_FOR_REVIEW with IMPORT_COMMIT_BLOCKED, and a commit that burned
// through its queue retries does the same with
// IMPORT_COMMIT_RETRIES_EXHAUSTED. useImportJob's poll stops only when the job
// settles, and the two codes below are surfaced as a message rather than an
// error, because the user's next move is to fix rows and commit again.

const PAGE_SIZE = 20;

function StatusPill({ job }) {
  const tone =
    job.status === "COMMITTED"
      ? "var(--color-success-tint-2)"
      : job.status === "FAILED"
        ? "var(--color-danger-tint)"
        : job.status === "READY_FOR_REVIEW"
          ? "var(--color-warning-tint)"
          : "var(--color-stacked-container)";
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: tone }}
    >
      {importJobStatusLabel(job.status)}
    </span>
  );
}

function ReviewTotals({ totals }) {
  if (!totals) return null;
  // Missing keys mean zero — the backend omits them rather than sending 0.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {REVIEW_STATUSES.filter((s) => (totals[s] ?? 0) > 0).map((s) => (
        <span key={s} className="text-[10px] text-gray-500">
          {totals[s]} {s.replace(/_/g, " ").toLowerCase()}
        </span>
      ))}
    </div>
  );
}

export default function ImportWizard() {
  usePageTitle("Import records");
  const communityId = useActiveCommunityId();

  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [pickedError, setPickedError] = useState("");
  const [jobError, setJobError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(null);
  const [openJobId, setOpenJobId] = useState(null);
  // Jobs from this session's upload, so the list can scroll to them. The job
  // LIST endpoint is the source of truth for what exists.
  const [highlight, setHighlight] = useState([]);

  const uploadFiles = useFileUploadMultiple();
  const createJob = useCreateImportJob(communityId);
  const commitJob = useCommitImportJob(communityId);
  const discardJob = useDiscardImportJob(communityId);
  const retryJob = useRetryImportJob(communityId);

  const { data, isLoading, error } = useImportJobs(communityId, { pageSize: PAGE_SIZE });
  const jobs = data?.content ?? [];

  // Poll only the job the user opened, and only while it is moving. A job left
  // open at COMMITTED stops polling rather than refetching forever.
  const openJob = useImportJob(communityId, openJobId, { poll: !!openJobId });

  function pick(event) {
    const chosen = [...(event.target.files ?? [])];
    setPickedError("");
    const invalid = validateImportFiles(chosen);
    if (invalid) {
      setPickedError(invalid);
      // Reset so re-picking the same bad file re-fires change.
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFiles(chosen);
  }

  async function submitAll() {
    setJobError("");
    const created = [];
    for (const file of files) {
      // One job per file — there is no multi-file import request.
      try {
        const res = await uploadFiles.mutateAsync({
          files: [file],
          fileCategory: "RECORD_IMPORT_SOURCE",
        });
        const uploaded = res.uploaded[0];
        if (!uploaded) {
          setJobError(res.failed[0]?.message ?? `${file.name} could not be uploaded.`);
          continue;
        }
        const job = await createJob.mutateAsync({ fileId: uploaded.id });
        created.push(job.data?.id);
      } catch (err) {
        setJobError(getErrorMessage(err, `Couldn't start the import for ${file.name}.`));
      }
    }
    if (created.length > 0) setHighlight(created);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function run(action, fallback) {
    setJobError("");
    try {
      await action();
    } catch (err) {
      setJobError(getErrorMessage(err, fallback));
    }
  }

  if (!communityId) {
    return (
      <div className="px-4 md:px-8 py-6">
        <h1 className="text-xl font-bold text-black mb-1">Import records</h1>
        <p className="text-sm text-gray-400">Pick a community first.</p>
      </div>
    );
  }

  const submitting = uploadFiles.isPending || createJob.isPending;
  const activeJob = openJob.data;
  const activeActions = activeJob ? importJobActions(activeJob.status, activeJob.retryable) : null;

  return (
    <div className="flex flex-col h-full px-4 md:px-8 py-6 overflow-y-auto min-h-0">
      <div className="mb-5 flex-shrink-0">
        <h1 className="text-xl font-bold text-black mb-1">Import records</h1>
        <p className="text-sm text-gray-400">
          Upload a CSV, TSV, XLSX or XLS file up to 25 MB. Each file becomes its own import —
          records are only visible once you review and commit them.
        </p>
      </div>

      {/* ── Pick and submit ── */}
      <div className="bg-surface-container rounded-2xl border border-surface-container-border p-4 mb-5 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={IMPORT_ACCEPT}
              onChange={pick}
              aria-label="Choose spreadsheet files"
              className="text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-white focus:outline-none"
            />
            {files.length > 0 && (
              <Button size="xs" fullWidth={false} loading={submitting} onClick={submitAll}>
                <Upload size={12} className="mr-1.5" />
                Start {files.length} import{files.length === 1 ? "" : "s"}
              </Button>
            )}
          </div>
          {files.length > 0 && (
            <ul className="text-[11px] text-gray-500">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} <span className="text-gray-400">({formatBytes(f.size)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pickedError && <p className="text-xs text-danger mt-2">{pickedError}</p>}
        {jobError && <p className="text-xs text-danger mt-2">{jobError}</p>}
      </div>

      {/* ── Job list ── */}
      <TableShell
        isLoading={isLoading}
        isEmpty={jobs.length === 0}
        error={error}
        emptyIcon={FileSpreadsheet}
        emptyLabel="No imports yet"
        forbiddenMessage="Importing is available to community admins."
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["File", "Status", "Rows", "Created", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr
                key={job.id}
                className={i < jobs.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}
              >
                <td className="px-4 py-3 text-xs text-gray-700">
                  {job.fileName ?? job.fileFormat}
                  {highlight.includes(job.id) && (
                    <span className="block text-[10px] text-gray-400">just added</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill job={job} />
                </td>
                <td className="px-4 py-3">
                  <ReviewTotals totals={job.reviewTotals} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {new Date(job.createdAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="outline-neutral"
                    size="xs"
                    fullWidth={false}
                    onClick={() => setOpenJobId(job.id)}
                  >
                    {isReviewOpen(job.status) ? "Review rows" : "Open"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="import"
        page={0}
        totalPages={1}
        onPage={() => {}}
      />

      {/* ── Job detail ── */}
      {openJobId && (
        <div className="mt-5 bg-surface-container rounded-2xl border border-surface-container-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 flex items-center gap-2">
                {isImportJobInFlight(activeJob?.status) && (
                  <Loader2 size={13} className="text-gray-400 animate-spin" />
                )}
                {activeJob ? importJobStatusLabel(activeJob.status) : "Loading…"}
              </h2>
              {activeJob?.fileName && (
                <p className="text-xs text-gray-400 mt-0.5">{activeJob.fileName}</p>
              )}
              {activeJob?.failureCode && (
                <p
                  className="text-xs mt-2"
                  style={{
                    color: isCommitFailureCode(activeJob.failureCode)
                      ? "var(--color-warning)"
                      : "var(--color-danger)",
                  }}
                >
                  {activeJob.failureCode}
                  {activeJob.failureMessage ? ` — ${activeJob.failureMessage}` : ""}
                  {isCommitFailureCode(activeJob.failureCode)
                    ? " Fix the highlighted rows and commit again."
                    : ""}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeActions?.retry && (
                <Button
                  variant="outline-neutral"
                  size="xs"
                  fullWidth={false}
                  onClick={() => run(() => retryJob.mutateAsync(openJobId), "Couldn't retry.")}
                >
                  Retry
                </Button>
              )}
              {activeActions?.discard && (
                <Button
                  variant="critical"
                  size="xs"
                  fullWidth={false}
                  onClick={() => setConfirmDiscard(activeJob)}
                >
                  Discard
                </Button>
              )}
              {activeActions?.commit && (
                <Button
                  size="xs"
                  fullWidth={false}
                  loading={commitJob.isPending}
                  onClick={() =>
                    run(() => commitJob.mutateAsync(openJobId), "Couldn't request the commit.")
                  }
                >
                  <Check size={12} className="mr-1.5" />
                  Commit {activeJob?.reviewTotals?.VALID ?? 0} rows
                </Button>
              )}
              <Button
                variant="tertiary"
                size="xs"
                fullWidth={false}
                onClick={() => setOpenJobId(null)}
              >
                Close
              </Button>
            </div>
          </div>

          {activeActions?.editRows ? (
            <RowReview communityId={communityId} job={activeJob} onEditRow={() => {}} />
          ) : (
            <p className="text-xs text-gray-400 py-6 text-center">
              {isImportJobInFlight(activeJob?.status)
                ? "Processing your file — this page updates on its own."
                : "Nothing to review in this state."}
            </p>
          )}
        </div>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this import?"
          subtitle={confirmDiscard.fileName}
          description="Pending rows are removed. The job and its history are kept."
          confirmLabel="Discard import"
          confirmingLabel="Discarding…"
          confirming={discardJob.isPending}
          onConfirm={() =>
            run(async () => {
              await discardJob.mutateAsync(confirmDiscard.id);
              setConfirmDiscard(null);
            }, "Couldn't discard this import.")
          }
          onClose={() => setConfirmDiscard(null)}
        />
      )}
    </div>
  );
}
