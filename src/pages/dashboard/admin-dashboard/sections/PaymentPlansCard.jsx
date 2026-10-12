import { toTitleCase } from "../../../../utils/format";
import { Button } from "../../../../components/ui/Button";
import { Skeleton } from "../../../../components/common/SkeletonUI";
import { formatNaira } from "../helpers";

const BAR_COLOR_CLASSES = [
  "bg-accent-gold",
  "bg-accent-purple",
  "bg-[#099DA8]",
  "bg-success-strong",
  "bg-brand",
  "bg-danger-bright",
];

export default function PaymentPlansCard({ plans, plansLoading, onManageAll, error = null }) {
  return (
    <div className="rounded-xl border border-surface-container-border p-4 bg-brand-mist">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-black">Payment Plans</span>
        <Button variant="tertiary" size="xs" fullWidth={false} onClick={onManageAll}>
          Manage All
        </Button>
      </div>

      {plansLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        // Must precede the empty check: a failed payment-links fetch resolves
        // to an empty array, so without this the card reads "No payment plans
        // yet" -- a community that never set up a plan -- rather than a load
        // failure. Keeps the same h-20 dashed footprint so the card doesn't
        // collapse to a different height than its loading/empty states.
        <div className="h-20 rounded-xl border-2 border-dashed border-danger-tint flex items-center justify-center">
          <span className="text-xs text-danger">Couldn't load payment plans.</span>
        </div>
      ) : plans.length === 0 ? (
        // Same h-20 rounded-xl footprint the loading Skeleton above already
        // uses for a real plan card -- dashed instead of shimmering, so
        // loading and empty read as the same shape rather than the
        // generic icon-in-a-circle EmptyState.
        <div className="h-20 rounded-xl border-2 border-dashed border-blue-200/60 flex items-center justify-center">
          <span className="text-xs text-gray-500">No payment plans yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((p, idx) => {
            const paidCount = p.paidCount ?? 0;
            const totalCount = p.totalCount ?? 0;
            const collected = p.amountCollected ?? 0;
            const expected = p.expectedAmount ?? 0;
            const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
            const barColorCls = BAR_COLOR_CLASSES[idx % BAR_COLOR_CLASSES.length];
            return (
              <div
                key={p.id}
                className="bg-surface-container rounded-xl p-4 border border-blue-100/60"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-black truncate">
                      {toTitleCase(p.name)}
                    </span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full flex-shrink-0 text-accent-purple bg-accent-purple-wash">
                      {p.frequency ?? p.type ?? "—"}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800 flex-shrink-0 ml-2">
                    {formatNaira(p.amount)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">
                  {paidCount} / {totalCount} members paid
                </p>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColorCls}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 text-right mt-1">{pct}% Collected</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
