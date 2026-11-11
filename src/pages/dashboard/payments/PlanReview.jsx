import { formatNaira, formatDate } from "../../../utils/format";
import {
  FREQUENCIES,
  REMINDER_FREQUENCIES,
  REMINDER_CHANNELS,
  RETRY_POLICIES,
  AMOUNT_MODES,
  AUDIENCE_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./constants";
import { billingDayLabel, intervalUnitLabel, payoutAccountLabel } from "./helpers";

const optionLabel = (options, value, fallback = "—") =>
  options.find((option) => option.value === value)?.label ?? fallback;

// Phone frame (iPhone 16 - 77) draws Frequency as a coloured pill. Colours are
// the design-system frequency badges (docs/design-system.md §9.1): Weekly
// blue, Monthly amber. §9.1 has no Daily/Quarterly/Annually entry, so those
// take its remaining badge pair (purple); the One-time purple it is named for
// never appears here -- Frequency only renders for recurring plans.
const FREQUENCY_BADGE = {
  WEEKLY: "bg-brand-100 text-brand",
  MONTHLY: "bg-warning-wash text-warning",
};
const FREQUENCY_BADGE_FALLBACK = "bg-accent-purple-tint text-accent-purple";

export default function PlanReview({
  planType,
  form,
  slug,
  accounts,
  memberCount = 0,
  groupCount = 0,
}) {
  const rows = [
    { label: "Plan Name", value: form.name || "—" },
    { label: "URL slug", value: slug || "—" },
    {
      label: "Plan Type",
      value: planType === "recurring" ? "Recurring" : "One Time",
    },
    { label: "Amount type", value: optionLabel(AMOUNT_MODES, form.amountMode, "Fixed amount") },
    {
      label: "Amount",
      // VARIABLE with no figure is a real state, not a missing one — the
      // backend stores 0 and lets the member choose at checkout.
      value: form.amount
        ? formatNaira(Number(form.amount))
        : form.amountMode === "VARIABLE"
          ? "Any amount"
          : "—",
    },
    { label: "Who it's for", value: optionLabel(AUDIENCE_OPTIONS, form.audience, "All members") },
    ...(form.audience === "SELECTED_MEMBERS"
      ? [{ label: "Members selected", value: `${memberCount}` }]
      : []),
    // A count, not names: the review step has no group list loaded (the picker
    // only mounts on the details step, and its query is scoped to that step's
    // lifetime), so naming groups here would mean either fetching again or
    // rendering stale labels carried over from the previous step. The count is
    // always accurate, and the details step just above it is where the names are
    // actually chosen.
    ...(form.audience === "GROUP" ? [{ label: "Groups selected", value: `${groupCount}` }] : []),
    { label: "Who can pay", value: optionLabel(VISIBILITY_OPTIONS, form.visibility, "Anyone") },
    ...(accounts && accounts.length > 1
      ? [
          {
            label: "Payout Account",
            value: payoutAccountLabel(
              accounts.find((account) => account.id === form.communityAccountId),
            ),
          },
        ]
      : []),
    ...(planType === "recurring"
      ? [
          {
            label: "Frequency",
            value:
              (FREQUENCIES.find((frequency) => frequency.value === form.frequency)?.label ??
                form.frequency) ||
              "—",
            badge: form.frequency
              ? (FREQUENCY_BADGE[form.frequency] ?? FREQUENCY_BADGE_FALLBACK)
              : null,
          },
          {
            label: "Repeats Every",
            value: `${form.interval || 1} ${intervalUnitLabel(form.frequency, form.interval || 1)}`,
          },
          ...(form.frequency !== "DAILY"
            ? [{ label: "Billing Day", value: billingDayLabel(form.frequency, form.billingDay) }]
            : []),
          { label: "End Date", value: form.endAt ? formatDate(form.endAt) : "No end date" },
          { label: "Grace Period", value: `${form.graceDays || 0} day(s)` },
          {
            label: "Retry Policy",
            value:
              RETRY_POLICIES.find((retry) => retry.value === (form.retryPolicy || "NO_RETRY"))
                ?.label ?? "No retry",
          },
        ]
      : [
          {
            label: "Due Date",
            value: form.dueDate
              ? new Date(form.dueDate).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—",
          },
        ]),
    {
      label: "Activate",
      value: (form.activateImmediately ?? true) ? "Immediately" : "Manually later",
    },
    {
      label: "Reminders",
      value:
        (form.reminderEnabled ?? true) && (form.reminderChannels ?? []).length
          ? `${REMINDER_FREQUENCIES.find((frequency) => frequency.value === form.reminderFrequency)?.label ?? "Every 3 Days"} via ${(form.reminderChannels ?? []).map((channel) => REMINDER_CHANNELS.find((option) => option.value === channel)?.label ?? channel).join(", ")}`
          : "Off",
    },
  ];

  return (
    <div>
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex justify-between px-4 py-2.5 text-xs ${index < rows.length - 1 ? "border-b border-gray-100" : ""} ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
          >
            <span className="text-gray-500 w-36">{row.label}</span>
            {row.badge ? (
              <>
                {/* Phone: coloured pill. Desktop: the plain value, unchanged. */}
                <span
                  className={`md:hidden rounded-full px-2 py-0.5 text-xs font-medium ${row.badge}`}
                >
                  {row.value}
                </span>
                <span className="hidden md:inline font-semibold text-gray-900">{row.value}</span>
              </>
            ) : (
              <span className="font-semibold text-gray-900">{row.value}</span>
            )}
          </div>
        ))}
      </div>
      {/* Phone frame: the design-system Banner/Feedback (§9.4: #ccdaff fill,
          #002fa7 @20% stroke, r=4) with a filled brand "!" and fuller copy.
          Desktop keeps its original note. */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 rounded-g-1 bg-brand-100 border border-brand/20">
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold leading-none flex items-center justify-center flex-shrink-0"
        >
          !
        </span>
        <p className="text-sm text-ink">
          Once created, members assigned to this plan will receive a notification. You can edit or
          pause the plan at any time from the Payments page.
        </p>
      </div>
      <div className="hidden md:block px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-gray-500">
        Once created, assigned members will receive a notification.
      </div>
    </div>
  );
}
