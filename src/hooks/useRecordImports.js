import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createImportJob,
  getImportJob,
  getImportJobRows,
  getImportJobs,
  createImportJobRow,
  updateImportJobRow,
  deleteImportJobRow,
  bulkUpdateImportJobRows,
  commitImportJob,
  discardImportJob,
  retryImportJob,
  rerunImportJob,
} from "../api/recordImports";
import { isImportJobInFlight } from "../utils/recordBook";

// Community record book — spreadsheet import jobs and their review rows.
//
// Commit is the thing to read twice. POST /commit answers 202 having only
// queued the work; the job reaches COMMITTED only after a worker revalidates
// every included row. A commit blocked by validation does NOT fail the job —
// it comes back as READY_FOR_REVIEW with failureCode IMPORT_COMMIT_BLOCKED, and
// a commit that exhausted its queue retries does the same with
// IMPORT_COMMIT_RETRIES_EXHAUSTED. So the poll below keeps running while the
// job is in flight and stops when it settles, rather than stopping on the
// first status that isn't COMMITTED. That is the same premature-settle trap
// docs/payments.md and PaymentSuccess.jsx already guard against.
//
// Backend retries are 4-minute delays, 5 attempts — a failing commit can sit in
// COMMIT_QUEUED for ~20 minutes, which is why the detail query keeps polling
// while the tab is hidden and refetches on focus. The global default of
// refetchOnWindowFocus: false would otherwise strand the user on "Committing"
// after they switch away.

const JOB_POLL_MS = 1500;

// Exported so the rule is directly testable rather than buried in a query
// config. Two decisions live here:
//
//  1. No job yet → keep polling. A job that was already settled when the page
//     opened still needs one fetch to resolve to a known state; without this a
//     first render with no data would sit unpolled and look stuck.
//  2. A known job polls only while it is in flight. READY_FOR_REVIEW stops the
//     poll — nothing further happens until a human edits a row — and so does
//     COMMIT_QUEUED's opposite case, FAILED, which is a resting state.
//
// The case this exists to get right is COMMIT_QUEUED: it must keep polling,
// because a blocked or retry-exhausted commit returns the job to
// READY_FOR_REVIEW. Treating it as finished would freeze the UI on
// "Committing" forever.
export function importJobPollInterval(job) {
  if (!job) return JOB_POLL_MS;
  return isImportJobInFlight(job.status) ? JOB_POLL_MS : false;
}

function unwrapPage(res) {
  const d = res.data?.data;
  return {
    content: Array.isArray(d) ? d : (d?.content ?? []),
    totalElements: d?.totalElements ?? 0,
    totalPages: d?.totalPages ?? 1,
  };
}

export const IMPORT_PAGE_SIZE = 20;

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useImportJobs(communityId, params = {}) {
  return useQuery({
    queryKey: ["community", communityId, "imports", params],
    queryFn: () => getImportJobs(communityId, params).then(unwrapPage),
    enabled: !!communityId,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

// `poll` defaults true: after a submit or a commit the caller usually wants the
// job to track itself without wiring a timer. Pass false for a historical
// (settled) job, where polling would be pure overhead.
export function useImportJob(communityId, jobId, { poll = true } = {}) {
  return useQuery({
    queryKey: ["community", communityId, "imports", "detail", jobId],
    queryFn: () => getImportJob(communityId, jobId).then((res) => res.data?.data),
    enabled: !!communityId && !!jobId,
    // Poll until the job stops moving on its own.
    refetchInterval: (query) => (poll ? importJobPollInterval(query.state.data) : false),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
}

export function useImportJobRows(communityId, jobId, params = {}) {
  return useQuery({
    queryKey: ["community", communityId, "imports", "rows", jobId, params],
    queryFn: () => getImportJobRows(communityId, jobId, params).then(unwrapPage),
    enabled: !!communityId && !!jobId,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function useInvalidateImport(communityId) {
  const queryClient = useQueryClient();
  return ({ jobId, rows = true } = {}) => {
    queryClient.invalidateQueries({ queryKey: ["community", communityId, "imports"] });
    if (rows && jobId) {
      queryClient.invalidateQueries({
        queryKey: ["community", communityId, "imports", "rows", jobId],
      });
    }
  };
}

// A duplicate file answers 409 unless the body carries acknowledgeDuplicate,
// which is a question for the user rather than a retry the client should make
// on its own. Callers inspect err.response.status === 409 and re-ask.
export function useCreateImportJob(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: (payload) => createImportJob(communityId, payload),
    onSuccess: () => invalidate({ rows: false }),
    meta: { silentError: true },
  });
}

export function useUpdateImportJobRow(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: ({ jobId, rowId, payload }) =>
      updateImportJobRow(communityId, jobId, rowId, payload),
    // Refreshes rows AND detail: reviewTotals on the job changes with the rows.
    onSuccess: (_data, variables) => invalidate({ jobId: variables.jobId }),
    meta: { silentError: true },
  });
}

export function useCreateImportJobRow(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: ({ jobId, payload }) => createImportJobRow(communityId, jobId, payload),
    onSuccess: (_data, variables) => invalidate({ jobId: variables.jobId }),
    meta: { silentError: true },
  });
}

export function useDeleteImportJobRow(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: ({ jobId, rowId }) => deleteImportJobRow(communityId, jobId, rowId),
    onSuccess: (_data, variables) => invalidate({ jobId: variables.jobId }),
    meta: { silentError: true },
  });
}

export function useBulkUpdateImportJobRows(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: ({ jobId, rowIds, patch }) =>
      bulkUpdateImportJobRows(communityId, jobId, { rowIds, patch }),
    // The bulk patch is atomic: on a scope/state/concurrency error the whole
    // batch rolled back, so the refresh is what tells the user whether their
    // selection actually landed. It runs onError as well as onSuccess.
    onSettled: (_data, _error, variables) => invalidate({ jobId: variables?.jobId }),
    meta: { silentError: true },
  });
}

// Returns 202 having queued the commit. It does NOT wait for COMMITTED, and a
// resolve here is not permission to show a success toast — useImportJob's poll
// is what observes the outcome. Success deliberately invalidates nothing beyond
// the job itself, because the detail query is already refetching every 1.5s.
export function useCommitImportJob(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: (jobId) => commitImportJob(communityId, jobId),
    onSuccess: (_data, jobId) => invalidate({ jobId, rows: false }),
    meta: { silentError: true },
  });
}

export function useDiscardImportJob(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: (jobId) => discardImportJob(communityId, jobId),
    onSuccess: (_data, jobId) => invalidate({ jobId }),
    meta: { silentError: true },
  });
}

export function useRetryImportJob(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: (jobId) => retryImportJob(communityId, jobId),
    onSuccess: (_data, jobId) => invalidate({ jobId }),
    meta: { silentError: true },
  });
}

// Rerun answers with a NEW job. The original keeps its decisions and is NOT
// updated, so callers must switch to result.data.data.id — rerunning does not
// move the job they called it on.
export function useRerunImportJob(communityId) {
  const invalidate = useInvalidateImport(communityId);
  return useMutation({
    mutationFn: (jobId) => rerunImportJob(communityId, jobId),
    onSuccess: (_data, jobId) => invalidate({ jobId, rows: false }),
    meta: { silentError: true },
  });
}
