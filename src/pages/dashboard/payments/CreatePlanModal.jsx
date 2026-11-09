import { useCallback, useEffect, useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useSlug } from "../../../hooks/useSlug";
import { useCommunityAccount } from "../../../hooks/useCommunityAccount";
import { dateInputToIso } from "../../../utils/date";
import { audienceEmptyMessage } from "./constants";
import {
  validatePlanField,
  validateAmountForMode,
  amountPayloadForMode,
  resolveAmountMode,
  audienceChangePatch,
} from "./helpers";
import PlanStepIndicator from "./PlanStepIndicator";
import { Step1, Step2, Step3 } from "./PlanFormSteps";
import SuccessBadge from "../../../components/common/SuccessBadge";
import { Button } from "../../../components/ui/Button";
import { MobileBackButton } from "../../../components/ui/MobileBackButton";
import { useEscapeToClose } from "../../../hooks/useKeyboardShortcuts";

// ── Create plan modal ─────────────────────────────────────────────────────────
export default function CreatePlanModal({ communityId, onClose, onCreate, creating, createError }) {
  useEscapeToClose(onClose);
  const [step, setStep] = useState(1);
  const [planType, setPlanType] = useState("recurring");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    // amountMode/visibility/audience used to be hardcoded into the payload
    // (FIXED / PUBLIC / ALL_MEMBERS) — the endpoints have always accepted all
    // of them, but the wizard made the other values unreachable.
    amountMode: "FIXED",
    visibility: "PUBLIC",
    audience: "ALL_MEMBERS",
    memberIds: [],
    groupIds: [],
    frequency: "",
    startDate: "",
    dueDate: "",
    billingDay: "",
    interval: "",
    endAt: "",
    graceDays: "",
    retryPolicy: "NO_RETRY",
    activateImmediately: true,
    reminderEnabled: true,
    reminderFrequency: "EVERY_3_DAYS",
    reminderChannels: ["IN_APP"],
    communityAccountId: "",
  });
  const slugState = useSlug("PAYMENT_LINK");
  const [fieldErrors, setFieldErrors] = useState({ name: "", amount: "", audience: "" });
  // The amount rule is mode-dependent, so live re-validation has to read the
  // mode that applies. Depending on amountMode (rather than all of `form`)
  // keeps this callback stable across keystrokes — Step2's billing-day clamp
  // effect takes `onChange` as a dependency.
  const update = useCallback(
    (k, v) => {
      // Switching audience resets both id lists at once — see
      // audienceChangePatch. A plain `[k]: v` would leave the previous
      // audience's selection in state, ready to reappear on the way back.
      if (k === "audience") {
        setForm((f) => ({ ...f, ...audienceChangePatch(v) }));
        setFieldErrors((fe) => (fe.audience ? { ...fe, audience: "" } : fe));
        return;
      }
      setForm((f) => ({ ...f, [k]: v }));
      setFieldErrors((fe) =>
        fe[k]
          ? {
              ...fe,
              [k]:
                k === "amount"
                  ? validateAmountForMode(v, form.amountMode)
                  : validatePlanField(k, v),
            }
          : fe,
      );
    },
    [form.amountMode],
  );
  const handleFieldBlur = (field) => (e) =>
    setFieldErrors((fe) => ({
      ...fe,
      [field]:
        field === "amount"
          ? validateAmountForMode(e.target.value, form.amountMode)
          : validatePlanField(field, e.target.value),
    }));

  // Only relevant when a community has more than one payout account
  // connected (PayoutAccountField hides itself otherwise) — default to
  // whichever is flagged as the default so the field always has an
  // explicit value the moment there's a real choice to make.
  const { accounts } = useCommunityAccount(communityId);
  useEffect(() => {
    if (form.communityAccountId || accounts.length === 0) return;
    const def = accounts.find((a) => a.defaultAccount) ?? accounts[0];
    // Defaults the field once accounts (loaded async) arrive -- form.communityAccountId
    // stays user-editable after that, so this can't be a derived render value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (def) setForm((f) => ({ ...f, communityAccountId: def.id }));
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  // A SELECTED_MEMBERS or GROUP plan with an empty list is the invalid state
  // that must never reach the wire. The backend rejects an empty groupIds on
  // both paths ("Group audience requires at least one group"), but it does NOT
  // reject an empty memberIds on create — that path saves the audience rows
  // without checking — so an empty selection there would quietly produce a plan
  // that bills nobody. Gated here instead, for both audiences.
  const audienceReady =
    form.audience === "SELECTED_MEMBERS"
      ? (form.memberIds ?? []).length > 0
      : form.audience === "GROUP"
        ? (form.groupIds ?? []).length > 0
        : true;
  const canContinue =
    step === 1
      ? !!planType
      : step === 2
        ? !!(
            form.name &&
            !validateAmountForMode(form.amount, form.amountMode) &&
            slugState.slug &&
            audienceReady &&
            (planType === "recurring" ? form.frequency : form.dueDate)
          )
        : true;

  function handleStep2Continue() {
    const nameError = validatePlanField("name", form.name);
    const amountError = validateAmountForMode(form.amount, form.amountMode);
    const audienceError = audienceReady ? "" : audienceEmptyMessage(form.audience);
    if (nameError || amountError || audienceError) {
      setFieldErrors({ name: nameError, amount: amountError, audience: audienceError });
      return;
    }
    setStep(3);
  }

  async function handleSubmit() {
    const startIso = form.startDate
      ? dateInputToIso(form.startDate, { clampToNow: true })
      : new Date().toISOString();
    // Clamped at the last moment: picking VARIABLE on a one-time plan and then
    // switching back to recurring on step 1 can leave a mode the whitelist
    // rejects, and the payload must never carry it.
    const amountMode = resolveAmountMode(planType, form.amountMode);
    const payload = {
      title: form.name,
      amount: amountPayloadForMode(amountMode, form.amount),
      paymentType: planType === "recurring" ? "RECURRING" : "ONE_TIME",
      slug: slugState.slug,
      activateImmediately: form.activateImmediately ?? true,
      audience: form.audience || "ALL_MEMBERS",
      visibility: form.visibility || "PUBLIC",
      amountMode,
      // memberIds and groupIds only travel with the audience that owns them: the
      // backend reads each list solely for its own case, and sending the other
      // one would imply an audience the plan doesn't have.
      ...(form.audience === "SELECTED_MEMBERS" ? { memberIds: form.memberIds } : {}),
      ...(form.audience === "GROUP" ? { groupIds: form.groupIds } : {}),
      ...(form.description?.trim() ? { description: form.description.trim() } : {}),
      ...(form.communityAccountId ? { communityAccountId: form.communityAccountId } : {}),
      ...(planType === "recurring"
        ? {
            recurringPlan: {
              frequency: form.frequency,
              interval: form.interval ? Number(form.interval) : 1,
              startAt: startIso,
              // billingDay doesn't apply to DAILY — the cycle is driven by
              // startAt + interval instead, so omit it in that case rather
              // than sending a meaningless day-of-month/week value.
              ...(form.frequency !== "DAILY" && form.billingDay
                ? { billingDay: Number(form.billingDay) }
                : {}),
              ...(form.endAt
                ? { endAt: dateInputToIso(form.endAt, { endOfDayIfToday: true, clampToNow: true }) }
                : {}),
              retryPolicy: form.retryPolicy || "NO_RETRY",
              graceDays: form.graceDays ? Number(form.graceDays) : 0,
            },
          }
        : {
            ...(form.startDate ? { startAt: startIso } : {}),
            // A due date of "today" needs to mean "through the end of
            // today" — clamping it to the exact instant Submit is clicked
            // instead raced the backend's own clock and made today
            // unselectable for a one-time payment's due date in practice.
            dueAt: dateInputToIso(form.dueDate, { endOfDayIfToday: true, clampToNow: true }),
          }),
      // Root-level, not nested under recurringPlan — applies to one-time
      // plans too. DISABLED is a real enum member (confirmed via the
      // backend's own validation error), so "off" is sent explicitly
      // rather than omitting the field.
      ...(form.reminderEnabled && form.reminderChannels?.length
        ? {
            reminderFrequency: form.reminderFrequency || "EVERY_3_DAYS",
            reminderChannels: form.reminderChannels,
          }
        : { reminderFrequency: "DISABLED" }),
    };
    if (import.meta.env.DEV) console.log("[CreatePlan] payload →", payload);
    const ok = await onCreate(payload);
    if (ok) setSuccess(true);
  }

  // Same rule as the footer's Back/Cancel: step back, or leave on step 1 (and
  // once the plan is created).
  const goBack = () => (step > 1 && !success ? setStep((s) => s - 1) : onClose());

  return (
    // Phone frame (iPhone 16 - 74): a full page, not a pop-up -- page
    // background edge to edge with no backdrop, card or radius, and a round
    // back button in place of the X. z-70 already sits above the dashboard
    // Topbar (z-50), so the page covers it. md+ is the original modal.
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-0 md:p-6 bg-surface-bg md:bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-bg w-full h-full md:h-auto md:rounded-2xl md:max-w-xl md:shadow-2xl md:max-h-[90vh] flex flex-col">
        <div className="px-4 pt-6 md:hidden">
          {/* "Go back", not "Back": the footer already has a "Back" button. */}
          <MobileBackButton aria-label="Go back" onClick={goBack} />
        </div>
        {/* Phone frame (iPhone 16 - 77): the Review step drops the title
            block; the step indicator follows the back button directly. */}
        <div
          className={`${step === 3 && !success ? "hidden md:flex" : "flex"} items-start justify-between px-4 pt-9 md:px-6 md:pt-5`}
        >
          <div>
            {/* Two headings rather than two spans in one: a heading's name is
                its full text, so spans would read "Create PaymentCreate
                Payment Plan" wherever display:none isn't applied. */}
            <h2 className="text-base font-normal text-black md:hidden">Create Payment</h2>
            <h2 className="hidden md:block text-base font-semibold text-black">
              Create Payment Plan
            </h2>
            <p className="text-sm text-gray-500 md:text-xs md:text-gray-400 mt-0.5">
              <span className="md:hidden">You can edit or pause plan at any time.</span>
              <span className="hidden md:inline">You can edit or pause any plan at any time.</span>
            </p>
          </div>
          <span className="hidden md:block">
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
              className=""
            >
              <X size={14} />
            </Button>
          </span>
        </div>
        <div className="px-4 md:px-6 py-4 flex-1 overflow-hidden flex flex-col">
          {success ? (
            <div className="text-center py-10">
              <SuccessBadge
                message="Plan Created!"
                subMessage="Members have been notified."
                className="mb-6"
              />

              <Button variant="primary" size="xs" fullWidth={false} onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <PlanStepIndicator current={step} />
              <div className="flex-1 overflow-y-auto scrollbar-neutral">
                {step === 1 && <Step1 value={planType} onChange={setPlanType} />}
                {step === 2 && (
                  <Step2
                    planType={planType}
                    form={form}
                    onChange={update}
                    slugState={slugState}
                    accounts={accounts}
                    fieldErrors={fieldErrors}
                    onFieldBlur={handleFieldBlur}
                    communityId={communityId}
                  />
                )}
                {step === 3 && (
                  <Step3
                    planType={planType}
                    form={form}
                    slug={slugState.slug}
                    accounts={accounts}
                    memberCount={(form.memberIds ?? []).length}
                    groupCount={(form.groupIds ?? []).length}
                  />
                )}
              </div>
              {createError && <p className="text-xs text-danger mt-2">{createError}</p>}
            </>
          )}
        </div>
        {!success && (
          // Phone (owner, 2026-11-09): no footer Back/Cancel -- the round
          // button at the top does the same job -- and Continue spans the
          // full width. Desktop keeps both, right-aligned.
          <div className="flex items-center justify-end gap-4 px-4 md:px-6 py-4 border-t border-gray-100">
            {/* Wrapped, not `hidden` on the Button: Button's own inline-flex
                would collide with it. */}
            <span className="hidden md:inline-flex">
              <Button
                variant="tertiary"
                size="xs"
                fullWidth={false}
                onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
              >
                <ArrowLeft size={15} /> {step > 1 ? "Back" : "Cancel"}
              </Button>
            </span>
            <Button
              onClick={() => {
                if (step === 2) {
                  handleStep2Continue();
                  return;
                }
                step < 3 ? setStep((s) => s + 1) : handleSubmit();
              }}
              disabled={
                !canContinue || creating || slugState.checking || slugState.available === false
              }
              loading={creating}
              fullWidth={false}
              size="sm"
              className="w-full md:w-auto px-14"
            >
              {creating ? "Creating…" : step === 3 ? "Create Plan" : "Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
