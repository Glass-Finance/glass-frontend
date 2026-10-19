import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY RECORD BOOK — spreadsheet import lifecycle
// ─────────────────────────────────────────────────────────────────────────────
//
// Shapes verified against the live backend OpenAPI (api.glasspay.app/v3/api-docs)
// and the backend's own integration guide, docs/new/community-record-book-
// frontend-api.md in glass-backend.
//
// The flow, and the two places it will bite:
//
//   upload spreadsheet → POST /imports (202) → poll GET /imports/{jobId}
//   → READY_FOR_REVIEW → edit rows → POST /commit (202) → poll until COMMITTED
//
// 1. SUBMISSION IS NOT PROCESSING. POST /imports and POST /commit both answer
//    202 and only queue work. Neither response is evidence that anything
//    succeeded — see commitImportJob below.
//
// 2. A COMMIT CAN COME BACK. A commit blocked by validation returns the job to
//    READY_FOR_REVIEW with failureCode IMPORT_COMMIT_BLOCKED; a commit that
//    exhausted its queue retries returns it there with
//    IMPORT_COMMIT_RETRIES_EXHAUSTED. Neither is the job failing, and exiting
//    a poll on the first non-COMMITTED status is exactly the premature-settle
//    bug the payment poller already has to avoid. Use importJobStatus.js.
//
// Upload the source separately via src/api/files.js with
// fileCategory=RECORD_IMPORT_SOURCE — one upload, one job. There is no combined
// multi-file import request.
//
// Paths stay inline for the endpoint audit; see src/api/groups.js.

// POST /api/v1/communities/{communityIdentifier}/records/imports
// CreateRecordImportRequest { fileId, acknowledgeDuplicate? } → ImportJob, 202.
// Use data.id from the upload response; never send the signed URL.
//
// A previously committed same-community file (SHA-256 match) answers 409 unless
// acknowledgeDuplicate is true. That acknowledges a duplicate FILE; individual
// duplicate ROWS still need their own review and acceptance.
export const createImportJob = (communityId, payload) =>
  client.post(`/communities/${communityId}/records/imports`, payload);

// GET /api/v1/communities/{communityIdentifier}/records/imports
// query: status, requester, fileId, createdFrom, createdTo, pageNumber,
// pageSize, sortBy (createdAt | status | id), dir.
// Bounds are [from, to) — inclusive from, EXCLUSIVE to. (The AI usage lists
// are inclusive on both ends; they are a different axis, not an inconsistency
// to copy from here.)
export const getImportJobs = (communityId, params = {}) =>
  client.get(`/communities/${communityId}/records/imports`, { params });

// GET /api/v1/communities/{communityIdentifier}/records/imports/{jobId}
// ImportJob including fileData (the authorized source link). Submission, list,
// retry and rerun responses do NOT populate fileData — fetch job detail when a
// download link is needed, and re-fetch it when the signed URL has expired.
export const getImportJob = (communityId, jobId) =>
  client.get(`/communities/${communityId}/records/imports/${jobId}`);

// GET /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rows
// query: reviewStatus, issueCode, sheetName, type, direction, memberId, search,
// pageNumber, pageSize, sortBy (createdAt | sourceRowNumber |
// sourceColumnNumber | reviewStatus | id), dir. Default sort is createdAt ASC.
export const getImportJobRows = (communityId, jobId, params = {}) =>
  client.get(`/communities/${communityId}/records/imports/${jobId}/rows`, { params });

// POST /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rows
// Add a manual pending row. Same create fields as a visible record → 201.
// Only manual additions can be deleted later; generated rows must be skipped.
export const createImportJobRow = (communityId, jobId, payload) =>
  client.post(`/communities/${communityId}/records/imports/${jobId}/rows`, payload);

// PATCH /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rows/{rowId}
// Record fields (omitted preserved, explicit null cleared) plus the review-only
// actions: skip (true|false — null is invalid), duplicateAccepted (true clears
// otherwise), and acceptRowAssistance (must be true if present).
//
// A successful write can still come back INVALID or REVIEW_REQUIRED with
// issues for the user to correct — that is a normal outcome, not an error.
export const updateImportJobRow = (communityId, jobId, rowId, payload) =>
  client.patch(`/communities/${communityId}/records/imports/${jobId}/rows/${rowId}`, payload);

// DELETE /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rows/{rowId}
// Manual pending rows only; generated rows must be skipped instead.
export const deleteImportJobRow = (communityId, jobId, rowId) =>
  client.delete(`/communities/${communityId}/records/imports/${jobId}/rows/${rowId}`);

// PATCH /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rows/bulk
// { rowIds: [1-500 distinct UUIDs], patch } → the saved rows.
// One shared patch applied atomically: a scope, state or concurrency error rolls
// back the WHOLE batch, so never assume the local selection was applied —
// refresh the rows after a conflict.
export const bulkUpdateImportJobRows = (communityId, jobId, payload) =>
  client.patch(`/communities/${communityId}/records/imports/${jobId}/rows/bulk`, payload);

// POST /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/commit
// No body. 202 when queued, 200 when already committed.
//
// 202 IS NOT SUCCESS. The worker revalidates every included row and only then
// makes records visible. Callers must poll the job until COMMITTED — and must
// not stop early on a non-COMMITTED status, because a blocked commit returns
// the job to READY_FOR_REVIEW rather than failing.
export const commitImportJob = (communityId, jobId) =>
  client.post(`/communities/${communityId}/records/imports/${jobId}/commit`);

// POST /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/discard
// Allowed only from QUEUED, READY_FOR_REVIEW or FAILED. Removes pending rows in
// one operation and retains a job-level audit with the deleted-row count.
export const discardImportJob = (communityId, jobId) =>
  client.post(`/communities/${communityId}/records/imports/${jobId}/discard`);

// POST /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/retry
// Allowed only for a FAILED job the backend reports as retryable. Keeps the same
// job and AI operation, and the retained mapping checkpoints.
export const retryImportJob = (communityId, jobId) =>
  client.post(`/communities/${communityId}/records/imports/${jobId}/retry`);

// POST /api/v1/communities/{communityIdentifier}/records/imports/{jobId}/rerun
// Allowed only from FAILED or READY_FOR_REVIEW. Creates a NEW job and AI
// operation from the current selections; retains the original job and its
// decisions but does NOT copy edits or acceptance. Switch the UI to the
// returned job id — rerun does not update the job you called it on.
export const rerunImportJob = (communityId, jobId) =>
  client.post(`/communities/${communityId}/records/imports/${jobId}/rerun`);
