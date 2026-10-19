import { useCommunityAiUsage } from "../../../hooks/useCommunityAiUsage";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { useMe } from "../../../hooks/useMyAccount";
import { formatDateTime } from "../../../utils/format";
export default function AiUsageNotice({ communityId, allowed }) {
  const navigate = useNavigate();
  const query = useCommunityAiUsage(communityId, allowed);
  const { data: me } = useMe();
  if (!allowed) return null;
  const usage = query.data;
  const reset = usage?.resetsAt ? formatDateTime(usage.resetsAt, me?.timezone) : null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-xs text-ink-ghost">
        {query.isPending ? (
          "Checking AI import allowance…"
        ) : query.error ? (
          "AI import allowance is currently unavailable."
        ) : (
          <>
            {usage?.mode === "UNLIMITED"
              ? "Unlimited AI imports"
              : usage?.mode === "DISABLED"
                ? "AI imports are disabled for this community."
                : `${usage?.remainingUnits ?? "Unknown"} AI imports remaining${usage?.reservedUnits ? ` · ${usage.reservedUnits} in progress` : ""}`}
            {usage?.mode === "LIMITED" && reset ? ` · Resets ${reset}` : ""}. Each file starts a
            separate import.
          </>
        )}
      </p>
      <Button
        variant="outline-neutral"
        size="sm-tight"
        fullWidth={false}
        onClick={() =>
          navigate(
            `/dashboard/settings/community/ai-usage?community=${encodeURIComponent(communityId)}`,
          )
        }
      >
        View AI usage
      </Button>
    </div>
  );
}
