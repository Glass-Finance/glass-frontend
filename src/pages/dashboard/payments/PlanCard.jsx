import { formatNaira, formatDateShort, toTitleCase } from "../../../utils/format";
import { PLAN_STATUS, FREQUENCIES } from "./constants";
import { formatCompact } from "./helpers";
import PlanOverflowMenu from "./PlanOverflowMenu";

export default function PlanCard({
  plan,
  planPlans,
  barColorCls,
  onEdit,
  onViewMembers,
  onDuplicate,
}) {
  const ps = PLAN_STATUS[plan.status] ?? PLAN_STATUS.DRAFT;

  const freqLabel =
    plan.type === "RECURRING"
      ? (FREQUENCIES.find((f) => f.value === plan.frequency)?.label ??
        plan.frequency ??
        "Recurring")
      : "One-Time";

  const paidCount = plan.paidCount ?? 0;
  const totalCount = plan.totalCount ?? 0;
  const collected = plan.amountCollected ?? 0;
  const expected = plan.expectedAmount ?? 0;
  const pct = totalCount > 0 ? Math.min(100, Math.round((paidCount / totalCount) * 100)) : 0;

  return (
    <div className="bg-surface-container rounded-2xl border border-surface-container-border p-5 flex flex-col gap-4">
      {/* Status + overflow */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${ps.cls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ps.dotCls}`} />
          {ps.label}
        </span>
        <PlanOverflowMenu
          plan={plan}
          planPlans={planPlans}
          onEdit={onEdit}
          onViewMembers={onViewMembers}
          onDuplicate={onDuplicate}
        />
      </div>

      {/* Name */}
      <p className="text-[15px] font-semibold text-black leading-snug">{toTitleCase(plan.name)}</p>

      {/* Amount + frequency + collected */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-md font-semibold text-gray-900 leading-none">
            {/* A VARIABLE plan with no baseline stores amount 0 (the service
                maps a null amount to 0), so formatting it would read as
                "₦0" — i.e. free — rather than "any amount". */}
            {plan.amountMode === "VARIABLE" && !plan.amount
              ? "Any amount"
              : formatNaira(plan.amount)}
          </span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 text-accent-purple bg-accent-purple-wash">
            {freqLabel}
          </span>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className="font-semibold text-gray-600">{formatCompact(collected)}</span>/
          {formatCompact(expected)} Collected
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-2">
          <div
            role="progressbar"
            aria-label={`${plan.name} members paid`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className={`h-full rounded-full transition-all ${barColorCls}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">
            {paidCount} / {totalCount} members paid
          </p>
          <p className="text-xs text-gray-400">
            Due {plan.dueAt ? formatDateShort(plan.dueAt) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
