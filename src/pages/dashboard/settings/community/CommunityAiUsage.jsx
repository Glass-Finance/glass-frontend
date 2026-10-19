import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { useRecordBookAccess } from "../../../../hooks/useRecordBookAccess";
import { useCommunityAiUsageList } from "../../../../hooks/useCommunityAiUsage";
import { useMe } from "../../../../hooks/useMyAccount";
import AiFeatureUsage from "./AiFeatureUsage";
import { usageDate } from "../../../../utils/communityAiUsage";

function Notice({ children }) {
  return (
    <div className="rounded-g-2 border border-surface-container-border bg-white p-5 text-sm text-ink-muted">
      {children}
    </div>
  );
}

function UsageContent({ access }) {
  const [page, setPage] = useState(1);
  const { data: me } = useMe();
  const query = useCommunityAiUsageList(
    access.id,
    { pageNumber: page, pageSize: 10, sortBy: "feature", dir: "asc" },
    access.usage,
  );
  // A permission change must also hide any previously cached values.
  if (!access.usage || query.error?.response?.status === 403)
    return <Notice>You don't have permission to view AI usage for this community.</Notice>;
  const data = query.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">AI usage &amp; policy</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Current AI usage and allowance rules for {access.community?.name ?? "this community"}.
          </p>
          {query.dataUpdatedAt > 0 && (
            <p className="mt-1 text-xs text-ink-ghost">
              Last updated {usageDate(query.dataUpdatedAt, me?.timezone)}
            </p>
          )}
        </div>
        <Button
          size="sm-tight"
          fullWidth={false}
          loading={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {query.error && (
        <div
          role="alert"
          className="rounded-g-2 border border-danger/20 bg-white p-4 text-sm text-ink"
        >
          <p>
            {data
              ? "We couldn't refresh AI usage. The values below may be out of date."
              : "We couldn't load AI usage. Please try again."}
          </p>
          <Button
            size="sm-tight"
            variant="outline-neutral"
            fullWidth={false}
            className="mt-3"
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
      {query.isPending && (
        <p role="status" className="py-6 text-sm text-ink-muted">
          Loading AI usage…
        </p>
      )}
      {data?.content?.length === 0 && (
        <Notice>
          <p className="font-medium text-ink">No AI features available</p>
          <p className="mt-1 text-xs">
            AI features will appear here when they are available for your community.
          </p>
        </Notice>
      )}
      {data?.content?.map((usage) => (
        <AiFeatureUsage key={usage.id ?? usage.feature} usage={usage} timezone={me?.timezone} />
      ))}
      {data && data.totalPages > 1 && (
        <nav
          aria-label="AI features pages"
          className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted"
        >
          <p>{data.totalElements} AI features</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline-neutral"
              size="sm-tight"
              fullWidth={false}
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline-neutral"
              size="sm-tight"
              fullWidth={false}
              disabled={page >= data.totalPages || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default function CommunityAiUsage() {
  const access = useRecordBookAccess();
  if (access.loading)
    return (
      <p role="status" className="py-6 text-sm text-ink-muted">
        Checking access…
      </p>
    );
  if (access.error)
    return (
      <Notice>We couldn't check your access to AI usage. Refresh the page to try again.</Notice>
    );
  return <UsageContent key={access.id ?? "unresolved"} access={access} />;
}
