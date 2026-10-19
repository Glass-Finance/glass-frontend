import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
import { useRecordImport, useImportAction } from "../../hooks/useRecordImports";
import { Button } from "../../components/ui/Button";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import {
  jobActions,
  jobLabel,
  recordCounts,
  JOB_LABELS,
  errorDescription,
  COMMIT_BLOCKED_CODE,
  COMMIT_RETRIES_EXHAUSTED_CODE,
} from "../../utils/recordBook";
import { recordKeys } from "../../utils/recordBookQueryKeys";
import RecordsTabs from "./records/RecordsTabs";
import ImportActionsMenu from "./records/ImportActionsMenu";
import ImportProgress from "./records/ImportProgress";
import ImportReview from "./records/ImportReview";
import ImportResult from "./records/ImportResult";
import { ErrorNotice } from "./records/RecordBookUI";
export default function RecordImportDetail() {
  usePageTitle("Record import");
  const access = useRecordBookAccess();
  const { jobId } = useParams();
  return (
    <div className="px-4 md:px-6 py-6 h-full overflow-y-auto space-y-4">
      <h1 className="text-xl font-bold">Records</h1>
      <RecordsTabs identifier={access.identifier} />
      {access.loading ? (
        <p role="status">Loading access…</p>
      ) : access.error ? (
        <ErrorNotice error={access.error} />
      ) : !access.import ? (
        <ErrorNotice message="You don't have permission to review imports for this community." />
      ) : (
        <JobContent key={`${access.id}:${jobId}`} access={access} jobId={jobId} />
      )}
    </div>
  );
}
function JobContent({ access, jobId }) {
  const query = useRecordImport(access.id, jobId);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState("");
  const commit = useImportAction(access.id, jobId, "commit");
  const retry = useImportAction(access.id, jobId, "retry");
  const rerun = useImportAction(access.id, jobId, "rerun");
  const discard = useImportAction(access.id, jobId, "discard");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const job = query.data;
  const actions = jobActions(job);
  const counts = recordCounts(job);
  const mutations = { commit, retry, rerun, discard };
  const busy = Object.values(mutations).some((mutation) => mutation.isPending);
  if (!job)
    return query.error ? (
      <ErrorNotice error={query.error} onRetry={() => query.refetch()} />
    ) : (
      <p role="status">Loading import…</p>
    );
  const blocked = counts.invalid + counts.review > 0;
  const descriptions = {
    commit: `Save ${counts.included} included records and leave out ${counts.skipped} skipped records? Saving happens in the background. The server checks every included record before saving any of them.`,
    retry: "Continue processing this import using its existing job and retained checkpoints.",
    rerun:
      "Start fresh processing as a new import. Your corrections, manual additions, and acceptances will not be copied. The current import is retained. A fresh import uses a separate AI operation.",
    discard:
      "Remove all pending rows from this import? The file and import history are retained. This cannot be undone.",
  };
  async function act() {
    if (!actions[confirm] || busy) return;
    setError("");
    try {
      const result = await mutations[confirm].mutateAsync();
      if (confirm === "rerun")
        navigate(
          `/dashboard/records/imports/${result.id}?community=${encodeURIComponent(access.identifier)}`,
        );
      if (result.status === "COMMITTED")
        void client.invalidateQueries({ queryKey: recordKeys.records(access.id) });
      setConfirm(null);
    } catch (err) {
      setError(errorDescription(err));
    }
  }
  const expired = job.fileData?.urlExpiresAt && Date.parse(job.fileData.urlExpiresAt) <= now;
  return (
    <div className="space-y-5">
      <Button
        variant="tertiary"
        size="sm-tight"
        fullWidth={false}
        onClick={() =>
          navigate(`/dashboard/records/imports?community=${encodeURIComponent(access.identifier)}`)
        }
      >
        Back to imports
      </Button>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold break-words">{jobLabel(job)}</h2>
          <p className="text-sm text-ink-muted mt-1" role="status" aria-live="polite">
            {JOB_LABELS[job.status] ?? "Unknown status"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {job.fileData?.url && !expired && (
            <Button
              variant="outline"
              size="sm-tight"
              fullWidth={false}
              onClick={() => window.open(job.fileData.url, "_blank", "noopener,noreferrer")}
            >
              Download source
            </Button>
          )}
          {expired && (
            <Button
              variant="outline"
              size="sm-tight"
              fullWidth={false}
              loading={query.isFetching}
              onClick={() => query.refetch()}
            >
              Refresh source link
            </Button>
          )}
          {actions.retry && (
            <Button
              size="sm-tight"
              fullWidth={false}
              disabled={busy}
              onClick={() => {
                setError("");
                setConfirm("retry");
              }}
            >
              Retry processing
            </Button>
          )}
          <ImportActionsMenu
            actions={actions}
            busy={busy}
            fetching={query.isFetching}
            onRefresh={() => query.refetch()}
            onAction={(action) => {
              setError("");
              setConfirm(action);
            }}
          />
        </div>
      </div>
      <ErrorNotice error={query.error} />
      {job.failureCode && (
        <ErrorNotice
          message={
            job.failureCode === COMMIT_BLOCKED_CODE
              ? "Some records need attention before they can be saved. Review the updated issues, correct or skip those records, then save again."
              : job.failureCode === COMMIT_RETRIES_EXHAUSTED_CODE
                ? "Saving could not finish after several attempts. Your review work is retained. You can try saving again when the service is available."
                : job.failureMessage ||
                  "This import could not be processed. Use Import actions above to start fresh, or retry processing when available."
          }
        />
      )}
      {!JOB_LABELS[job.status] && (
        <ErrorNotice message="This import has an unfamiliar status. Controls are paused; refresh to check for updates." />
      )}
      {["COMMITTED", "DISCARDED"].includes(job.status) ? (
        <ImportResult job={job} identifier={access.identifier} />
      ) : (
        <ImportProgress job={job} compact={job.status === "READY_FOR_REVIEW"} />
      )}
      {job.unmappedRegions?.length > 0 && (
        <details className="rounded-g-1 border border-warning/30 bg-warning-wash p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Some spreadsheet sections were not mapped ({job.unmappedRegions.length})
          </summary>
          <p className="text-sm mt-2">
            Check the source spreadsheet and add missing records manually where needed. These
            sections are not automatically included.
          </p>
          <ul className="text-sm mt-3 space-y-2">
            {job.unmappedRegions.map((region, i) => (
              <li key={i}>
                {region.sheetName} · Rows {region.startRow}–{region.endRow} · Columns{" "}
                {region.columns?.join(", ") || "not specified"}
              </li>
            ))}
          </ul>
        </details>
      )}
      <ImportReview
        communityId={access.id}
        job={job}
        defaultCurrency={access.community.defaultCurrency}
        frozen={!actions.edit || busy || !!query.error}
      />
      {actions.commit && (
        <div
          className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-g-1 border border-surface-container-border bg-white px-4 py-3"
          aria-label="Save reviewed records"
        >
          <div role="status" className="min-w-0 text-sm">
            <p className="font-medium">
              {counts.included} included · {counts.skipped} skipped
            </p>
            <p id="import-save-help" className="mt-1 text-xs text-ink-muted">
              {blocked
                ? `Correct, accept, or skip the ${counts.invalid + counts.review} records needing attention before saving.`
                : counts.included === 0
                  ? "Include at least one record to save this import."
                  : "Your reviewed records are ready to save."}
            </p>
          </div>
          <Button
            size="sm-tight"
            fullWidth={false}
            disabled={busy || !!query.error || blocked || counts.included === 0}
            aria-describedby="import-save-help"
            onClick={() => {
              setError("");
              setConfirm("commit");
            }}
          >
            Save records
          </Button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          presentation="record"
          title={
            {
              commit: "Save reviewed records?",
              retry: "Retry processing?",
              rerun: "Start fresh import?",
              discard: "Discard import?",
            }[confirm]
          }
          description={descriptions[confirm]}
          danger={confirm === "discard"}
          confirmLabel={
            {
              commit: "Save records",
              retry: "Retry processing",
              rerun: "Start fresh import",
              discard: "Discard import",
            }[confirm]
          }
          confirming={busy}
          confirmDisabled={!actions[confirm] || !!query.error}
          error={error}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={act}
        />
      )}
    </div>
  );
}
