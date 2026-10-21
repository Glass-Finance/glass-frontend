import { useEffect } from "react";
import { Check, Loader2, X } from "lucide-react";
import { daysInMonth } from "../../../utils/date";
import recurringPaymentIcon from "../../../assets/dashboard/recurring-payment.webp";
import oneTimePaymentIcon from "../../../assets/dashboard/one-time-payment.webp";
import {
  inputCls,
  textareaCls,
  FREQUENCIES,
  RETRY_POLICIES,
  REMINDER_FREQUENCIES,
  REMINDER_CHANNELS,
  AMOUNT_MODES,
  AUDIENCE_OPTIONS,
  audienceEmptyMessage,
  VISIBILITY_OPTIONS,
} from "./constants";
import {
  blurOnWheel,
  intervalUnitLabel,
  amountModesForPlanType,
  amountRequiredForMode,
} from "./helpers";
import { PayoutAccountField, BillingDayField } from "./PlanFormFields";
import PlanReview from "./PlanReview";
import AudienceMemberPicker from "./AudienceMemberPicker";
import AudienceGroupPicker from "./AudienceGroupPicker";

// The native select chevron is drawn by hand throughout this file (an
// absolutely-positioned triangle over `appearance-none`), so every select here
// repeats it rather than diverging visually. Every option list passed in
// always has a concrete value, so there is no empty/placeholder state to
// model — the controls below all default to a real term.
function Select({ value, onChange, options, testId }) {
  return (
    <div className="relative">
      <select
        className={`${inputCls} appearance-none !pr-9`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
    </div>
  );
}

// Card look matches onboarding's ChoosePath.jsx (white fill, rounded-2xl,
// brand border + filled checkmark circle only on selection) -- one
// deliberate difference: ChoosePath's cards sit on a textured page
// background, so an unselected "border-white" still reads as a distinct
// card there. This modal's panel is itself bg-white (see CreatePlanModal),
// so unselected cards get a visible border-gray-200 instead, or they'd
// disappear into the panel entirely.
export function Step1({ value, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-5">Choose the type of plan you want to create</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            id: "recurring",
            icon: recurringPaymentIcon,
            title: "Recurring",
            desc: "Members pay on a set schedule.",
          },
          {
            id: "one_time",
            icon: oneTimePaymentIcon,
            title: "One Time",
            desc: "A single payment for one purpose.",
          },
        ].map((opt) => {
          const sel = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              // items-center/text-center, not text-left: per direct
              // feedback the icon/title/description block should be
              // centered in the card, with only the selection badge
              // staying pinned top-left as an overlay.
              className={`relative flex flex-col items-center text-center p-5 min-h-[140px] rounded-2xl bg-white transition-all duration-200 border ${sel ? "border-2 border-brand" : "border-gray-200"}`}
            >
              <div className="absolute top-4 left-4">
                {sel ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-brand">
                    <Check size={12} color="white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-hairline-disabled" />
                )}
              </div>
              {/* Card was reading as near-square against Figma's wider
                  rectangle -- min-h-[180px] plus mt-6/mb-5 around the icon
                  tile added up to more vertical space than the content
                  needed. Trimmed both; icon/title/description unchanged. */}
              {/* Plain black glyph, no colored background tile -- confirmed
                  against the actual exported Figma icons (fill="black"),
                  not recolored/boxed the way an earlier pass assumed. */}
              <img
                src={opt.icon}
                alt=""
                className="w-8 h-8 object-contain mt-5 mb-3"
                loading="lazy"
              />
              <p className="font-semibold text-gray-900 text-base mb-1">{opt.title}</p>
              {/* text-xs, not text-sm -- per direct feedback the
                  description read too large next to the title. */}
              <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Step2({
  planType,
  form,
  onChange,
  slugState,
  accounts,
  fieldErrors = {},
  onFieldBlur,
  communityId,
}) {
  const { slug, setSlug, available, checking, suggesting, suggestFrom } = slugState;

  const isDaily = form.frequency === "DAILY";
  const amountRequired = amountRequiredForMode(form.amountMode);

  // Weekly billing days are 1–7 (day of week). Monthly billing days are
  // validated against the selected start date's actual month (e.g. 28 for
  // February) rather than a flat 1–28/1–31 range — falls back to 31 (the
  // most permissive value) until a start date is chosen. Daily plans don't
  // use billingDay at all — the cycle is driven by startAt + interval — so
  // this value is unused (and the field hidden) when frequency is DAILY.
  const billingDayMax = (() => {
    if (form.frequency === "WEEKLY") return 7;
    if (!form.startDate) return 31;
    const [year, month] = form.startDate.split("-").map(Number);
    return daysInMonth(year, month);
  })();

  // If the user picked a billing day for a longer month, then switches to
  // a shorter one (e.g. 31 → February), the stale value is now invalid —
  // clamp it down rather than silently submitting an out-of-range day.
  useEffect(() => {
    if (form.billingDay && Number(form.billingDay) > billingDayMax) {
      onChange("billingDay", String(billingDayMax));
    }
  }, [billingDayMax, form.billingDay, onChange]);

  return (
    <div className="pr-1 space-y-3.5">
      <div>
        <label htmlFor="create-plan-name" className="block text-xs font-medium text-gray-700 mb-1">
          Plan Name
        </label>
        <input
          id="create-plan-name"
          className={inputCls}
          value={form.name || ""}
          placeholder="Enter plan name"
          onChange={(e) => onChange("name", e.target.value)}
          onBlur={(e) => {
            if (!slug) suggestFrom(form.name);
            onFieldBlur?.("name")(e);
          }}
          style={fieldErrors.name ? { borderColor: "var(--color-danger)" } : undefined}
        />
        {fieldErrors.name && <p className="text-xs text-danger mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor="create-plan-slug" className="block text-xs font-medium text-gray-700 mb-1">
          URL slug
        </label>
        <div className="relative">
          <input
            id="create-plan-slug"
            className={inputCls + " pr-8"}
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="e.g. alumni-dues-2026"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {(checking || suggesting) && (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            )}
            {!checking && !suggesting && available === true && (
              <Check size={14} className="text-success" />
            )}
            {!checking && !suggesting && available === false && (
              <X size={14} className="text-danger" />
            )}
          </span>
        </div>
        {available === false && !checking && (
          <p className="text-xs text-danger mt-1">That URL is taken — try another.</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className={textareaCls}
          value={form.description || ""}
          rows={3}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>
      <PayoutAccountField
        accounts={accounts}
        value={form.communityAccountId}
        onChange={(v) => onChange("communityAccountId", v)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Amount mode is constrained by plan type, not just offered: the
            backend whitelists paymentType x amountMode and RECURRING accepts
            FIXED alone, so the option list here is the whitelist for this
            step's plan type. */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Amount type</label>
          <Select
            value={form.amountMode || "FIXED"}
            onChange={(v) => onChange("amountMode", v)}
            options={AMOUNT_MODES.filter((o) => amountModesForPlanType(planType).includes(o.value))}
            testId="amount-mode"
          />
          {amountModesForPlanType(planType).length === 1 && (
            <p className="text-[11px] text-gray-400 mt-1">
              Recurring plans always bill a fixed amount.
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="create-plan-amount"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Amount{" "}
            {amountRequired ? (
              <span className="text-danger">*</span>
            ) : (
              <span className="text-gray-400">(optional)</span>
            )}
          </label>
          <input
            id="create-plan-amount"
            type="number"
            onWheel={blurOnWheel}
            className={inputCls}
            value={form.amount || ""}
            placeholder="₦0.00"
            onChange={(e) => onChange("amount", e.target.value)}
            onBlur={onFieldBlur?.("amount")}
            style={fieldErrors.amount ? { borderColor: "var(--color-danger)" } : undefined}
          />
          {fieldErrors.amount && <p className="text-xs text-danger mt-1">{fieldErrors.amount}</p>}
          {!amountRequired && !fieldErrors.amount && (
            <p className="text-[11px] text-gray-400 mt-1">
              Leave blank and members pay any amount they choose.
            </p>
          )}
        </div>
      </div>

      {planType === "recurring" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
          <div className="relative">
            <select
              className={`${inputCls} appearance-none !pr-9`}
              value={form.frequency || ""}
              onChange={(e) => onChange("frequency", e.target.value)}
            >
              <option value="" disabled>
                Select frequency
              </option>
              {FREQUENCIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Who it's for</label>
          <Select
            value={form.audience || "ALL_MEMBERS"}
            onChange={(v) => onChange("audience", v)}
            options={AUDIENCE_OPTIONS}
            testId="audience"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Who can pay</label>
          <Select
            value={form.visibility || "PUBLIC"}
            onChange={(v) => onChange("visibility", v)}
            options={VISIBILITY_OPTIONS}
            testId="visibility"
          />
        </div>
      </div>

      {form.audience === "SELECTED_MEMBERS" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Members <span className="text-danger">*</span>
          </label>
          <AudienceMemberPicker
            communityId={communityId}
            selected={form.memberIds}
            onChange={(ids) => onChange("memberIds", ids)}
          />
          {/* Shown as soon as the audience needs a selection, not only after a
              submit attempt: Continue is disabled while the list is empty, so
              waiting for a click would mean the reason never appears. */}
          {(fieldErrors.audience ||
            (form.audience === "SELECTED_MEMBERS" && !(form.memberIds ?? []).length)) && (
            <p className="text-xs text-danger mt-1">
              {fieldErrors.audience || audienceEmptyMessage(form.audience)}
            </p>
          )}
        </div>
      )}

      {form.audience === "GROUP" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Groups <span className="text-danger">*</span>
          </label>
          {/* Mounted only for a GROUP audience, so an all-members or
              selected-members plan never fetches the group list. */}
          <AudienceGroupPicker
            communityId={communityId}
            selected={form.groupIds}
            onChange={(ids) => onChange("groupIds", ids)}
          />
          {/* Proactive for the same reason as the member picker above. */}
          {(fieldErrors.audience ||
            (form.audience === "GROUP" && !(form.groupIds ?? []).length)) && (
            <p className="text-xs text-danger mt-1">
              {fieldErrors.audience || audienceEmptyMessage(form.audience)}
            </p>
          )}
        </div>
      )}

      {/* Interval — multiplier on top of frequency, e.g. frequency=DAILY +
          interval=3 means "every 3 days". Required by RecurringPlanRequest;
          defaults to 1 (i.e. every single cycle) when left blank. */}
      {planType === "recurring" && form.frequency && (
        <div>
          <label
            htmlFor="create-plan-interval"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Repeat Every
          </label>
          <div className="flex items-center gap-2">
            <input
              id="create-plan-interval"
              type="number"
              onWheel={blurOnWheel}
              min={1}
              className={inputCls + " max-w-[100px]"}
              value={form.interval || ""}
              placeholder="1"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange("interval", "");
                  return;
                }
                onChange("interval", String(Math.max(1, Number(raw))));
              }}
            />
            <span className="text-xs text-gray-500">
              {intervalUnitLabel(form.frequency, form.interval || 1)}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="create-plan-start-date"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            Start Date
          </label>
          <input
            id="create-plan-start-date"
            type="date"
            className={inputCls}
            value={form.startDate || ""}
            onChange={(e) => onChange("startDate", e.target.value)}
          />
        </div>
        {planType === "recurring" ? (
          !isDaily && (
            <BillingDayField
              id="create-plan-billing-day"
              frequency={form.frequency}
              value={form.billingDay}
              max={billingDayMax}
              onChange={(v) => onChange("billingDay", v)}
            />
          )
        ) : (
          <div>
            <label
              htmlFor="create-plan-due-date"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Due Date <span className="text-danger">*</span>
            </label>
            <input
              id="create-plan-due-date"
              type="date"
              className={inputCls}
              value={form.dueDate || ""}
              min={form.startDate || undefined}
              onChange={(e) => onChange("dueDate", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Optional end date for recurring plans — when to stop generating
          new obligations. Left blank = runs indefinitely. */}
      {planType === "recurring" && (
        <div>
          <label
            htmlFor="create-plan-end-date"
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            End Date <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="create-plan-end-date"
            type="date"
            className={inputCls}
            value={form.endAt || ""}
            min={form.startDate || undefined}
            onChange={(e) => onChange("endAt", e.target.value)}
          />
        </div>
      )}

      {planType === "recurring" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="create-plan-grace-days"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Grace Period (days)
            </label>
            <input
              id="create-plan-grace-days"
              type="number"
              onWheel={blurOnWheel}
              min={0}
              className={inputCls}
              value={form.graceDays || ""}
              placeholder="0"
              onChange={(e) => {
                const raw = e.target.value;
                onChange("graceDays", raw === "" ? "" : String(Math.max(0, Number(raw))));
              }}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Days after due date before a payment is marked overdue.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Retry Policy</label>
            <div className="relative">
              <select
                className={`${inputCls} appearance-none !pr-9`}
                value={form.retryPolicy || "NO_RETRY"}
                onChange={(e) => onChange("retryPolicy", e.target.value)}
              >
                {RETRY_POLICIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
            </div>
          </div>
        </div>
      )}

      {/* Default reminder cadence for this plan — sent automatically to
          unpaid members going forward. Separate from "Send Reminder" in the
          plan's ⋯ menu, which fires an immediate one-off blast on top of
          whatever's configured here. */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
          <input
            type="checkbox"
            checked={form.reminderEnabled ?? true}
            onChange={(e) => onChange("reminderEnabled", e.target.checked)}
          />
          Send automatic reminders to unpaid members
        </label>
        {(form.reminderEnabled ?? true) && (
          <div className="flex flex-col gap-2.5 pl-6">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Remind every</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none !pr-9`}
                  value={form.reminderFrequency || "EVERY_3_DAYS"}
                  onChange={(e) => onChange("reminderFrequency", e.target.value)}
                >
                  {REMINDER_FREQUENCIES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1.5">Send via</label>
              <div className="flex flex-col gap-1.5">
                {REMINDER_CHANNELS.map((c) => {
                  const checked = (form.reminderChannels ?? []).includes(c.value);
                  return (
                    <label key={c.value} className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = form.reminderChannels ?? [];
                          onChange(
                            "reminderChannels",
                            checked ? current.filter((v) => v !== c.value) : [...current, c.value],
                          );
                        }}
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
              {(form.reminderChannels ?? []).length === 0 && (
                <p className="text-[11px] text-danger mt-1">
                  Choose at least one channel, or reminders will be created disabled.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={form.activateImmediately ?? true}
          onChange={(e) => onChange("activateImmediately", e.target.checked)}
        />
        Activate immediately after creation
      </label>
    </div>
  );
}

export function Step3({ planType, form, slug, accounts, memberCount = 0, groupCount = 0 }) {
  return (
    <PlanReview
      planType={planType}
      form={form}
      slug={slug}
      accounts={accounts}
      memberCount={memberCount}
      groupCount={groupCount}
    />
  );
}
