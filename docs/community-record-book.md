# Community record book

## Current behavior

Owners and community admins open **Records** beside Payments. **All records** combines backend-projected successful Glass transactions, manual historical entries, and committed spreadsheet records. Record changes do not move money, alter balances, or reverse payments. Glass records are read-only; permitted manual/imported entries can be edited or deleted.

Lists use server pagination, filters, literal substring search (omitted by default and after clearing; the existing debounce hook receives a setter, never a value), and community-scoped React Query caches. Dates remain business dates; amounts are major currency units with currency-specific precision. No aggregate financial totals are inferred from a page.

### Access and navigation

Routes live inside `CommunityAdminGuard` and retain the existing `?community=` context. Feature hooks resolve canonical community UUIDs before fetching, matching SSE payload identifiers. Controls use the returned role permission codes for read/create/update/delete/import and AI usage independently. Backend authorization remains authoritative; unresolved permissions fail closed. The session system is unchanged.

### Presentation

Records follows the existing Payments header and segmented navigation, Settlements-style compact filters/tables/pagination, and matching Figma dashboard components. Bulk tools appear only after explicit selection. Source evidence and processing history remain available on demand. Phone/tablet views retain the full workflow.

### Spreadsheet import

Upload CSV, TSV, XLSX, or XLS, at most 25 MiB per file, as private `RECORD_IMPORT_SOURCE` files. A single selection uses the single upload endpoint; multiple selections use repeated `files` parts. Each successful upload is submitted independently. A single import opens directly; multiple successful imports return to the Imports list. Partial failures retain per-file recovery controls. Uncertain submissions remain uncertain after an empty history read because the original request may still commit; they offer repeated history checks rather than a resubmit action. Definitively rejected submissions can be explicitly retried.

Job responses do not include original filenames. Returning admins see labels derived from format, creation time, and a shortened job ID. Private source downloads come from authorized job detail and can be refreshed when their signed link expires.

For RECORD_IMPORT_SOURCE only, upload wrappers normalize the multipart file part to the canonical MIME for CSV/TSV/XLS/XLSX when browser/OS metadata differs. Bytes, filename, and last-modified time remain unchanged. Backend content/signature checks still apply.

The job page shows the server timeline by sequence. `RECORD_IMPORT_PROGRESS` events on the existing SSE connection invalidate the affected community's data. Authoritative job responses automatically reveal review and completion. Polling, reconnect, and focus refresh recover missed events, including for reviewers who are not the requester. Other jobs never replace the active workspace.

### Review and commit

Admins can correct fields, optionally link historical members, inspect source evidence, acknowledge duplicates, accept AI-interpreted values, skip/unskip generated rows, and add/delete pending manual entries. Formula caches are evidence only; formulas are not executed. Draft writes can succeed while returning unresolved validation issues.

Selections persist across pages and filters for one community/job, up to 500 explicitly selected rows. Page selection affects only the displayed page. Bulk actions apply a shared patch; untouched fields are omitted and explicitly cleared fields become null. The server remains responsible for final validation and atomic bulk writes.

**Save records** shows included/skipped counts and queues commit. `COMMIT_QUEUED` freezes edits; HTTP 202 is not success. `COMMITTED` reveals historical result counts and refreshes visible records, including when completion was discovered through polling. Commit recovery reopens review with refreshed issues. Dirty individual and bulk correction forms remain available for reference when another reviewer changes the job state. An edited row disappearing from a refreshed filtered page freezes saving until its latest values can be reconciled.

Retry continues an eligible failed job. Start fresh import creates a new job and AI operation without copying corrections or consent. Discard removes pending rows only in allowed states, retaining job history.

### Integration boundaries

- Axios wrappers: `src/api/communityRecords.js`, `recordImports.js`, `communityAiUsage.js`, and `files.js`.
- React Query hooks: `useCommunityRecords`, `useRecordImports`, `useRecordImportRows`, `useCommunityAiUsage`, and `useRecordBookAccess`.
- Shared interpretation/cache keys: `src/utils/recordBook.js` and `recordBookQueryKeys.js`.
- Screens: `Records.jsx`, `RecordImports.jsx`, `RecordImportDetail.jsx`, with focused components under `pages/dashboard/records/`.
- Notification deep links use the verified `RECORD_IMPORT_STATUS` content and `RecordImportJob` related entity in `notificationRouting.js`.

The contract source is the backend's 18 October 2026 frontend integration guide, checked against the deployed `/v3/api-docs`. Automated tests cover synthetic and mocked behavior. They do not establish that authenticated production permissions, private downloads, AI processing, or background commit workers work in a deployed environment.

## Proposed/future direction

Platform oversight and AI policy management, export, authoritative aggregate totals, editable mappings, ZIP archives, and combined multi-file jobs are outside this release. Adding original filenames to job responses would improve persistent labels but is not required by this frontend implementation.
