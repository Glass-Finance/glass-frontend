import { useId } from "react";
import { usageDate } from "../../../../utils/communityAiUsage";

const count = (value) => Number.isSafeInteger(value) && value >= 0;
const signedCount = (value) => Number.isSafeInteger(value);
const number = (value) => (count(value) ? value.toLocaleString() : "Unavailable");
const featureNames = { RECORD_IMPORT: "Spreadsheet imports" };
const periods = { DAILY: "day", WEEKLY: "week", MONTHLY: "month" };

function featureName(feature) {
  if (featureNames[feature]) return featureNames[feature];
  if (typeof feature !== "string" || !feature.trim()) return "AI feature";
  const words = feature.replaceAll("_", " ").toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink break-words">{children}</dd>
    </div>
  );
}

export default function AiFeatureUsage({ usage, timezone }) {
  const titleId = useId();
  const title = featureName(usage.feature);
  const limited = usage.mode === "LIMITED";
  const unlimited = usage.mode === "UNLIMITED";
  const disabled = usage.mode === "DISABLED";
  const exhausted = limited && usage.remainingUnits === 0;
  const operationMeter = usage.meterType === "OPERATIONS";
  const period = periods[usage.periodType];
  const total =
    count(usage.allowanceUnits) && signedCount(usage.adjustmentUnits)
      ? usage.allowanceUnits + usage.adjustmentUnits
      : null;
  const committed =
    count(usage.consumedUnits) && count(usage.reservedUnits)
      ? usage.consumedUnits + usage.reservedUnits
      : null;
  const showBar =
    limited &&
    operationMeter &&
    count(total) &&
    total > 0 &&
    count(committed) &&
    committed <= total;
  const status = unlimited
    ? "Unlimited"
    : disabled
      ? "Disabled"
      : exhausted
        ? "Allowance used up"
        : limited
          ? "Limited allowance"
          : "Availability unavailable";
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-g-2 border border-surface-container-border bg-white"
    >
      <div className="border-b border-surface-container-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="text-sm font-semibold text-ink">
            {title}
          </h3>
          <p
            className={`text-xs font-medium ${disabled || exhausted ? "text-warning" : "text-ink-muted"}`}
          >
            {status}
          </p>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {disabled
            ? "AI is currently disabled for this feature."
            : unlimited
              ? "This feature has no usage limit."
              : exhausted
                ? "No allowance is available right now. Check the reset date below."
                : limited
                  ? "Your community shares this allowance for the current period."
                  : "Availability details are not currently available."}
        </p>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-ink">Current usage</h4>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Fact label="Used">{number(usage.consumedUnits)}</Fact>
            <Fact label="In progress">{number(usage.reservedUnits)}</Fact>
            <Fact label="Remaining">
              {unlimited ? "Unlimited" : disabled ? "Unavailable" : number(usage.remainingUnits)}
            </Fact>
          </dl>
          {showBar && (
            <div
              role="progressbar"
              aria-label={`${title} allowance usage`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={committed}
              aria-valuetext={`${number(usage.consumedUnits)} used, ${number(usage.reservedUnits)} in progress out of ${number(total)} operations`}
              className="mt-4 flex h-2 overflow-hidden rounded-g-1 bg-stacked-container"
            >
              <span
                className="h-full bg-brand"
                style={{ width: `${(usage.consumedUnits / total) * 100}%` }}
              />
              <span
                className="h-full bg-ink-ghost"
                style={{ width: `${(usage.reservedUnits / total) * 100}%` }}
              />
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-ink-muted">
            {usage.feature === "RECORD_IMPORT" && operationMeter
              ? "Each unit represents one spreadsheet import."
              : operationMeter
                ? "Each unit represents one AI operation."
                : "The usage unit for this feature is unavailable."}
          </p>
        </div>
        <div className="min-w-0 border-t border-surface-container-border pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <h4 className="text-sm font-medium text-ink">Allowance rules</h4>
          <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Fact label="Base allowance">
              {unlimited
                ? "Unlimited"
                : count(usage.allowanceUnits) && operationMeter
                  ? `${number(usage.allowanceUnits)} operations${period ? ` per ${period}` : ""}`
                  : "Unavailable"}
            </Fact>
            <Fact label="Period adjustment">
              {signedCount(usage.adjustmentUnits) && operationMeter
                ? usage.adjustmentUnits === 0
                  ? "No adjustment"
                  : `${usage.adjustmentUnits > 0 ? "+" : ""}${usage.adjustmentUnits.toLocaleString()} operations`
                : "Unavailable"}
            </Fact>
            <Fact label="Reset schedule">
              {period
                ? { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" }[usage.periodType]
                : "Unavailable"}
            </Fact>
            <Fact label="Current period started">{usageDate(usage.periodStartsAt, timezone)}</Fact>
            <Fact label="Next reset">{usageDate(usage.resetsAt, timezone)}</Fact>
          </dl>
        </div>
      </div>
    </section>
  );
}
