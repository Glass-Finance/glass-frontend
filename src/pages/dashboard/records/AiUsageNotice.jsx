import { useCommunityAiUsage } from "../../../hooks/useCommunityAiUsage";
export default function AiUsageNotice({ communityId, allowed }) {
  const query = useCommunityAiUsage(communityId, allowed);
  if (!allowed) return null;
  if (query.isPending)
    return <p className="text-xs text-ink-ghost">Checking AI import allowance…</p>;
  if (query.error)
    return <p className="text-xs text-ink-ghost">AI import allowance is currently unavailable.</p>;
  const usage = query.data;
  const reset = usage?.resetsAt ? new Date(usage.resetsAt).toLocaleString() : null;
  return (
    <p className="text-xs text-ink-ghost">
      {usage?.mode === "UNLIMITED"
        ? "Unlimited AI imports"
        : usage?.mode === "DISABLED"
          ? "AI imports are disabled for this community."
          : `${usage?.remainingUnits ?? "Unknown"} AI imports remaining${usage?.reservedUnits ? ` · ${usage.reservedUnits} in progress` : ""}`}
      {usage?.mode === "LIMITED" && reset ? ` · Resets ${reset}` : ""}. Each file starts a separate
      import.
    </p>
  );
}
