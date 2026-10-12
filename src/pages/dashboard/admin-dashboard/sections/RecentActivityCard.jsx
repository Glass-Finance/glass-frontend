import { toTitleCase } from "../../../../utils/format";
import { Skeleton } from "../../../../components/common/SkeletonUI";
import { ActivityIcon } from "../SkeletonUI";
import { timeAgo } from "../helpers";

export default function RecentActivityCard({ isLoading, items, error = null }) {
  return (
    <div className="bg-surface-container rounded-xl border border-surface-container-border p-4">
      <span className="text-sm font-medium text-black block mb-4">Recent Activity</span>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-3/4 mb-1.5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // Must precede the empty check: a failed /activity fetch resolves to
        // an empty list, so without this the card shows "No recent activity
        // yet" -- an empty community -- when what actually happened is that
        // the request errored.
        <p className="text-xs text-danger py-3">Couldn't load recent activity.</p>
      ) : items.length === 0 ? (
        // Shaped like a real row below (same gap-3/py-3, same w-9 h-9
        // rounded-full icon slot) but dashed and empty instead of filled +
        // colored -- reads as "this is where activity will show up" rather
        // than a generic icon-in-a-circle badge repeated across every
        // empty card on the page.
        <div className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-dashed border-gray-200" />
          <p className="text-xs text-gray-400">No recent activity yet</p>
        </div>
      ) : (
        items.map((a, i) => {
          const event = a.event ?? "";
          const failed = a.result === "FAILED";
          const isPmt = event.includes("PAYMENT");
          const aColor = failed
            ? "var(--color-danger-bright)"
            : isPmt
              ? "var(--color-success-strong)"
              : "var(--color-brand)";
          const aBgCls = failed ? "bg-danger-wash-2" : isPmt ? "bg-success-wash" : "bg-brand-tint";
          const type = isPmt ? "payment" : event.includes("MEMBER") ? "member" : undefined;
          const actorName = toTitleCase(
            [a.actor?.firstName, a.actor?.lastName].filter(Boolean).join(" "),
          );
          return (
            <div
              key={a.id ?? i}
              className={`flex items-start gap-3 py-3 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${aBgCls}`}
              >
                <ActivityIcon type={type} color={aColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {actorName && !a.description?.startsWith(actorName) && (
                    <strong className="text-brand font-semibold">{actorName} </strong>
                  )}
                  {a.description ?? event.replaceAll("_", " ").toLowerCase() ?? "activity"}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="var(--color-ink-faint)"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M12 6v6l4 2"
                      stroke="var(--color-ink-faint)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-[11px] text-gray-400">{timeAgo(a.occurredAt)}</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
