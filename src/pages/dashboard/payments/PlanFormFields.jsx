import { WEEKDAYS, inputCls } from "./constants";
import { blurOnWheel, ordinal, payoutAccountLabel } from "./helpers";

// Shared payout-account picker (create wizard + edit modal). Only shown when
// a community has more than one connected account — with just one, there's
// nothing to choose and the backend already defaults to it. plan.metrics
// gates the field: reject invalid selections silently by falling back to
// the community's default account.
export function PayoutAccountField({ accounts, value, onChange }) {
  if (!accounts || accounts.length <= 1) return null;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Payout Account</label>
      <div className="relative">
        <select
          className={`${inputCls} appearance-none !pr-9`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {payoutAccountLabel(a)}
              {a.defaultAccount ? " (Default)" : ""}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        Members' payments for this plan settle to this account.
      </p>
    </div>
  );
}

// Shared billing-day picker (create wizard + edit modal). WEEKLY plans get a
// weekday dropdown instead of a raw 1–7 input, and every frequency shows an
// always-visible plain-English preview of when members are billed.
export function BillingDayField({ frequency, value, max, onChange, id = "billing-day" }) {
  const day = Number(value);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
        Billing Day
      </label>
      {frequency === "WEEKLY" ? (
        <div className="relative">
          <select
            id={id}
            className={`${inputCls} appearance-none !pr-9`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select day of week</option>
            {WEEKDAYS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
        </div>
      ) : (
        <input
          id={id}
          type="number"
          onWheel={blurOnWheel}
          className={inputCls}
          value={value || ""}
          min={1}
          max={max}
          placeholder={`1–${max}`}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange("");
              return;
            }
            onChange(String(Math.min(Math.max(Number(raw), 1), max)));
          }}
        />
      )}
      <p className="text-[11px] text-gray-400 mt-1">
        {frequency === "WEEKLY"
          ? day
            ? `Members are billed every ${WEEKDAYS[day - 1]}.`
            : "Pick the day of the week members are billed."
          : day
            ? `Members are billed on the ${ordinal(day)} of the month.` +
              (max < 31 ? ` The selected start month only has ${max} days.` : "")
            : `Pick the day of the month members are billed (1–${max}).`}
      </p>
    </div>
  );
}
