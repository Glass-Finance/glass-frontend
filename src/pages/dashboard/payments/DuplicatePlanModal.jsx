import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { X, Check, Loader2 } from "lucide-react";
import { useSlug } from "../../../hooks/useSlug";
import { dateInputToIso } from "../../../utils/date";
import { inputCls } from "./constants";
import { toDateInput } from "./helpers";
import { useEscapeToClose } from "../../../hooks/useKeyboardShortcuts";

export default function DuplicatePlanModal({ plan, onClose, onDuplicate, duplicating }) {
  useEscapeToClose(onClose);
  const [title, setTitle] = useState(`${plan.name ?? ""} (Copy)`.trim());
  const [startDate, setStartDate] = useState(toDateInput(new Date().toISOString()));
  const [dueDate, setDueDate] = useState("");
  const slugState = useSlug("PAYMENT_LINK");
  const { slug, setSlug, available, checking, suggesting, suggestFrom } = slugState;
  const isRecurring = plan.type === "RECURRING";

  useEffect(() => {
    if (!slug) suggestFrom(title);
    // Only want this once, on mount -- suggestFrom itself is stable per
    // render and re-running it on every keystroke would fight manual edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReady =
    title.trim().length > 0 && slug && available !== false && startDate && (isRecurring || dueDate);

  function handleSubmit() {
    const startIso = dateInputToIso(startDate, { clampToNow: true });
    const payload = {
      title: title.trim(),
      slug,
      startAt: startIso,
      ...(isRecurring
        ? {
            recurringPlan: {
              frequency: plan.frequency ?? plan.recurringPlan?.frequency,
              interval: plan.recurringPlan?.interval ?? 1,
              startAt: startIso,
              ...(plan.frequency !== "DAILY" && plan.recurringPlan?.billingDay
                ? { billingDay: plan.recurringPlan.billingDay }
                : {}),
              ...(plan.recurringPlan?.endAt ? { endAt: plan.recurringPlan.endAt } : {}),
              retryPolicy: plan.recurringPlan?.retryPolicy ?? "NO_RETRY",
              graceDays: plan.recurringPlan?.graceDays ?? 0,
            },
          }
        : {
            dueAt: dateInputToIso(dueDate, { endOfDayIfToday: true, clampToNow: true }),
          }),
    };
    onDuplicate(plan.id, payload);
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-bg rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-black">Duplicate Payment Plan</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Creates a new plan with {plan.name}'s settings. Amount, audience, and community
              account carry over automatically.
            </p>
          </div>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className=""
          >
            <X size={14} />
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="duplicate-plan-name"
              className="block text-xs font-medium text-gray-700 mb-1.5"
            >
              New Plan Name
            </label>
            <input
              id="duplicate-plan-name"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !slug && suggestFrom(title)}
              placeholder="Plan name"
            />
          </div>

          <div>
            <label
              htmlFor="duplicate-plan-slug"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              URL slug
            </label>
            <div className="relative">
              <input
                id="duplicate-plan-slug"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="duplicate-plan-start-date"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Start Date <span className="text-danger">*</span>
              </label>
              <input
                id="duplicate-plan-start-date"
                type="date"
                className={inputCls}
                value={startDate}
                min={toDateInput(new Date().toISOString())}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!isRecurring && (
              <div>
                <label
                  htmlFor="duplicate-plan-due-date"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Due Date <span className="text-danger">*</span>
                </label>
                <input
                  id="duplicate-plan-due-date"
                  type="date"
                  className={inputCls}
                  value={dueDate}
                  min={startDate || toDateInput(new Date().toISOString())}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            variant="primary"
            size="xs"
            fullWidth={false}
            onClick={handleSubmit}
            disabled={!isReady || duplicating}
          >
            {duplicating ? "Duplicating…" : "Duplicate Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
