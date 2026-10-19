import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Mail, Phone, Clock, ChevronLeft } from "lucide-react";
import {
  useJoinRequests,
  requesterOf,
  requestStatusOf as statusOf,
} from "../../hooks/useJoinRequests";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Skeleton } from "../../components/common/SkeletonUI";
import { Button } from "../../components/ui/Button";
import { formatDate, formatDateShort } from "../../utils/format";

function formatRequestedAt(r) {
  const raw = r.createdAt ?? r.requestedAt ?? r.submittedAt ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d ago`;
  return formatDate(d);
}

const STATUS_CHIP = {
  APPROVED: { label: "Approved", cls: "bg-success-wash text-success-strong" },
  REJECTED: { label: "Rejected", cls: "bg-danger-wash text-danger" },
  CANCELLED: { label: "Cancelled", cls: "bg-stacked-container text-ink-muted" },
  EXPIRED: { label: "Expired", cls: "bg-stacked-container text-ink-muted" },
};

function Avatar({ requester }) {
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-100 bg-brand-wash">
      {requester.image ? (
        <img src={requester.image} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xs font-bold text-brand">{requester.initials}</span>
      )}
    </div>
  );
}

function RequestCard({ r, onApprove, onReject, busy }) {
  const requester = requesterOf(r);
  const status = statusOf(r);
  const isPending = status === "PENDING";
  const requestedAt = formatRequestedAt(r);
  const reviewedAt = r.reviewedAt ? formatDateShort(r.reviewedAt) : null;
  const chip = STATUS_CHIP[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-surface-container rounded-xl border border-surface-container-border">
      <div className="flex items-center gap-3.5 min-w-0">
        <Avatar requester={requester} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate m-0">{requester.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {requester.email && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Mail size={11} className="flex-shrink-0" />
                <span className="truncate">{requester.email}</span>
              </span>
            )}
            {requester.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone size={11} className="flex-shrink-0" />
                {requester.phone}
              </span>
            )}
            {requestedAt && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={11} className="flex-shrink-0" />
                Requested {requestedAt}
              </span>
            )}
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline-caution"
            size="sm"
            disabled={busy}
            onClick={onReject}
            fullWidth={false}
          >
            <X size={13} /> Reject
          </Button>
          <Button size="sm" disabled={busy} onClick={onApprove} fullWidth={false}>
            <Check size={13} /> Approve
          </Button>
        </div>
      ) : (
        chip && (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${chip.cls}`}>
              {chip.label}
            </span>
            {reviewedAt && <span className="text-[11px] text-gray-400">on {reviewedAt}</span>}
          </div>
        )
      )}
    </div>
  );
}

export default function JoinRequests() {
  usePageTitle("Join Requests");
  const navigate = useNavigate();
  const communityId = useActiveCommunityId();
  const { requests, isLoading, error, approve, reject } = useJoinRequests(communityId);
  // Row-level busy state so approving one request doesn't freeze the rest.
  const [respondingId, setRespondingId] = useState(null);

  // Only PENDING requests are actionable — the backend rejects approve/
  // reject on anything else ("Only pending join requests can be approved").
  // Processed ones are shown below as read-only history.
  const { pending, processed } = useMemo(() => {
    const pending = [];
    const processed = [];
    for (const r of requests) {
      (statusOf(r) === "PENDING" ? pending : processed).push(r);
    }
    return { pending, processed };
  }, [requests]);

  async function respond(action, r) {
    setRespondingId(r.id);
    try {
      await action(r.id);
    } catch {
      // The global mutation error handler already toasts the reason
      // (e.g. "Only pending join requests can be approved").
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full px-4 md:px-6 py-6 overflow-y-auto min-h-0">
      {/* Header */}
      <div className="mb-5 flex-shrink-0">
        {/* Reached only via a deep link (Members' pending-requests banner,
            or a join-request notification), not the sidebar nav -- same
            situation as TransactionDetail.jsx, so matching its exact
            back-breadcrumb pattern (navigate(-1), not a fixed destination,
            since either entry point is equally valid to return to). */}
        <h1 className="text-xl font-bold text-black mb-1">
          {/* Own text-sm, not inherited text-xl -- the button had no size
              class of its own, so "Back" rendered at the same size as the
              title itself instead of reading as a smaller, secondary link. */}
          <Button variant="tertiary" size="sm" fullWidth={false} onClick={() => navigate(-1)}>
            <ChevronLeft size={13} /> Back
          </Button>
          <span className="text-sm text-gray-300 mx-2 align-middle">›</span> Join Requests
        </h1>
        <p className="text-sm text-gray-400">
          Review who wants to join before letting them into your community.
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger mb-4">Couldn't load join requests. Please refresh.</p>
      )}

      {/* Pending -- plain label, no count badge, matching "Recently
          processed" below exactly (that one never had one, so the badge
          here read as an inconsistency rather than a feature; the count
          is redundant anyway since the cards themselves are right below). */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Awaiting review
      </p>

      {isLoading ? (
        // Same footprint as the real RequestCard below (px-5 py-4 card,
        // w-11 h-11 rounded-full avatar slot) so the list does not jump when
        // the requests arrive -- and so it agrees with the empty state, which
        // already mirrors that card.
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 px-5 py-4 bg-surface-container rounded-xl border border-surface-container-border"
            >
              <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" tone="bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        // Shaped like a real RequestCard below (same px-5/py-4 card, same
        // w-11 h-11 rounded-full avatar slot) but dashed and empty, instead
        // of the generic icon-in-a-circle EmptyState -- no dedicated
        // illustration exists for this page, and reusing an unrelated one
        // (e.g. Members' add-members graphic) would be confusing shown for
        // a different message. Matches the ghost-row treatment already
        // applied to the rest of the dashboard's nested empty states.
        <div className="flex items-center gap-3.5 px-5 py-4 bg-surface-container rounded-xl border border-surface-container-border">
          <div className="w-11 h-11 rounded-full flex-shrink-0 border-2 border-dashed border-gray-200" />
          <div>
            <p className="text-sm text-gray-400 m-0">No pending join requests</p>
            <p className="text-xs text-gray-400 mt-0.5">
              New requests from Discover or invite links will show up here for you to approve or
              reject.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pending.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              busy={respondingId === r.id}
              onApprove={() => respond(approve, r)}
              onReject={() => respond(reject, r)}
            />
          ))}
        </div>
      )}

      {/* Processed history */}
      {processed.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-8 mb-3">
            Recently processed
          </p>
          <div className="flex flex-col gap-2.5 pb-8">
            {processed.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
