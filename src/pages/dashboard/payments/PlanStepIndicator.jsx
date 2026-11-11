import { Check } from "lucide-react";

// Numbered-circle wizard step indicator for CreatePlanModal's 3-step flow
// -- named PlanStepIndicator (not StepIndicator) to avoid colliding with
// components/onboarding/StepIndicator.jsx, a differently-shaped component
// (linear progress bar) that happens to share the generic name.
export default function PlanStepIndicator({ current }) {
  const steps = [
    { n: 1, label: "Plan Type" },
    { n: 2, label: "Plan Details" },
    { n: 3, label: "Review" },
  ];
  return (
    <div className="flex items-center mb-[32px] md:mb-6">
      {steps.map((s, i) => {
        const done = s.n < current,
          active = s.n === current;
        return (
          <div key={s.n} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                // Phone frame (iPhone 16 - 74): 32px circles, 14px labels and
                // thin dark connectors. Desktop keeps 28px / 11px / gray-200.
                className={`w-8 h-8 text-sm md:w-7 md:h-7 md:text-xs rounded-full flex items-center justify-center font-medium border
                ${done ? "bg-brand border-brand text-white" : active ? "border-brand text-brand bg-white" : "border-gray-300 text-gray-400 bg-white"}`}
              >
                {done ? <Check size={13} /> : s.n}
              </div>
              <span
                className={`text-sm md:text-[11px] whitespace-nowrap ${active ? "font-normal md:font-semibold text-brand" : done ? "text-gray-600" : "text-gray-400"}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px md:h-0.5 mx-2 mb-6 md:mb-4 ${done ? "bg-brand" : "bg-black md:bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
