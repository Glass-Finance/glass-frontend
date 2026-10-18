import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { useCommunityRecord } from "../../../hooks/useCommunityRecords";
import {
  RECORD_TYPES,
  DIRECTIONS,
  REVIEW_LABELS,
  ISSUE_LABELS,
  formatRecordAmount,
  formatRecordDate,
} from "../../../utils/recordBook";
import { SourceEvidence } from "./RecordDetailPanel";
import { ErrorNotice } from "./RecordBookUI";
function Candidate({ communityId, recordId }) {
  const query = useCommunityRecord(communityId, recordId);
  return (
    <p className="text-sm text-ink-muted break-words">
      {query.data
        ? `${formatRecordDate(query.data.occurredOn)} · ${query.data.payerName || "Unlinked payer"} · ${formatRecordAmount(query.data.amount, query.data.currency)} · ${query.data.description || "No description"}`
        : query.error
          ? "Candidate is unavailable in this community."
          : "Loading possible duplicate…"}
    </p>
  );
}
export default function ImportRowPanel({
  row,
  communityId,
  frozen,
  busy,
  error,
  onPatch,
  onEdit,
  onDelete,
  onClose,
}) {
  const duplicates =
    row.issues?.filter((issue) => ["EXACT_DUPLICATE", "POSSIBLE_DUPLICATE"].includes(issue.code)) ??
    [];
  return (
    <ModalShell title="Review record" onClose={onClose}>
      <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
        <p className="text-sm text-ink-muted">
          {REVIEW_LABELS[row.reviewStatus] ?? "Check record"}
        </p>
        <p className="text-xl font-semibold">{formatRecordAmount(row.amount, row.currency)}</p>
        <p className="text-sm">
          {row.payerName || row.payerReference || "Unlinked payer"} ·{" "}
          {formatRecordDate(row.occurredOn)}
        </p>
        <p className="text-sm text-ink-muted">
          {RECORD_TYPES[row.recordType] || "Type missing"} ·{" "}
          {DIRECTIONS[row.direction] || "Direction missing"}
        </p>
        {row.description && <p className="text-sm break-words">{row.description}</p>}
        <ErrorNotice error={error} />
        {frozen && (
          <p className="text-sm text-ink-muted">
            This import is no longer editable. Close this panel to see its current state.
          </p>
        )}
        <div className="space-y-3">
          {row.issues?.map((issue, i) => (
            <div key={i} className="border-l-2 border-black/20 pl-3 space-y-1">
              <p className="text-sm font-medium">
                {ISSUE_LABELS[issue.code] || "Please check this value."}
              </p>
              {issue.message && (
                <p className="text-sm text-ink-muted break-words">{issue.message}</p>
              )}
              {issue.field && <p className="text-xs text-ink-muted">Field: {issue.field}</p>}
              {issue.candidateMemberIds?.length > 0 && (
                <p className="text-sm text-ink-muted">
                  {issue.candidateCount ?? issue.candidateMemberIds.length} possible member matches.
                  Choose a member in Edit record, or leave it unlinked.
                </p>
              )}
            </div>
          ))}
        </div>
        <SourceEvidence cells={row.mappedSourceCells} />
        {duplicates.map((issue, i) => (
          <details key={i} className="border border-black/10 rounded-g-1 p-3">
            <summary className="text-sm cursor-pointer">
              Possible duplicates ({issue.candidateCount ?? issue.candidateRecordIds?.length ?? 0})
            </summary>
            <div className="mt-3 space-y-3">
              {issue.candidateRecordIds?.map((id) => (
                <Candidate key={id} communityId={communityId} recordId={id} />
              ))}
              {issue.candidateCount > (issue.candidateRecordIds?.length ?? 0) && (
                <p className="text-sm text-ink-muted">
                  Only some candidates are shown. Review the record book for further matches.
                </p>
              )}
            </div>
          </details>
        ))}
        <div className="flex flex-wrap gap-3">
          <Button size="md" fullWidth={false} disabled={frozen || busy} onClick={onEdit}>
            Edit record
          </Button>
          <Button
            size="md"
            fullWidth={false}
            variant="outline-neutral"
            disabled={frozen || busy}
            onClick={() => onPatch({ skip: row.reviewStatus !== "SKIPPED" })}
          >
            {row.reviewStatus === "SKIPPED" ? "Include record" : "Skip record"}
          </Button>
          {row.rowAssistanceAcceptanceRequired && (
            <Button
              size="md"
              fullWidth={false}
              variant="outline"
              disabled={frozen || busy}
              onClick={() => onPatch({ acceptRowAssistance: true })}
            >
              Accept interpreted values
            </Button>
          )}
          {duplicates.length > 0 && !row.duplicateAccepted && (
            <Button
              size="md"
              fullWidth={false}
              variant="outline"
              disabled={frozen || busy}
              onClick={() => onPatch({ duplicateAccepted: true })}
            >
              Include despite duplicate warning
            </Button>
          )}
          {row.duplicateAccepted && (
            <Button
              size="md"
              fullWidth={false}
              variant="outline-neutral"
              disabled={frozen || busy}
              onClick={() => onPatch({ duplicateAccepted: false })}
            >
              Clear duplicate acceptance
            </Button>
          )}
          {row.source === "MANUAL" && (
            <Button
              size="md"
              fullWidth={false}
              variant="outline-caution"
              disabled={frozen || busy}
              onClick={onDelete}
            >
              Delete manual addition
            </Button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
