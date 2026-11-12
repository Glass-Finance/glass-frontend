import { StepIcon } from "./OnboardingStepsSidebar";

// Phone-only (below lg) stepper for the three community-setup screens,
// replacing the old "Step X of 5" bar there. Figma "iPhone 16 - 108 /
// 109 / 111": three 48px circles with the step glyph, the label under each,
// and a 1px connector level with the circles' bottom edge.
//
//   completed → solid brand circle, white glyph, ink label
//   active    → brand ring, brand glyph, ink label
//   upcoming  → black @60% ring, glyph and label
//
// A connector turns brand once the step on its left is done. The desktop
// sidebar (OnboardingStepsSidebar) keeps the full five-step list; this only
// shows the three steps the phone frames draw, reusing the sidebar's glyphs.
const STEPS = [
  { id: "organization", label: "Organization Profile" },
  { id: "payment", label: "Payment Profile" },
  { id: "members", label: "Members" },
];

export default function OnboardingMobileStepper({ activeStepId, completedStepIds = [] }) {
  return (
    <ol aria-label="Setup progress" className="lg:hidden flex items-start w-full">
      {STEPS.map((step, i) => {
        const isCompleted = completedStepIds.includes(step.id);
        const isActive = step.id === activeStepId;
        const circle = isCompleted
          ? "bg-brand text-white"
          : isActive
            ? "border border-brand text-brand"
            : "border border-black/60 text-black/60";
        return (
          // flex-auto (not flex-1): each step grows from its own width, so the
          // spare room -- and with it the connector -- is split evenly.
          <li key={step.id} className={`flex items-start ${i > 0 ? "flex-auto" : ""}`}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`flex-1 h-px mt-12 mx-1 ${
                  completedStepIds.includes(STEPS[i - 1].id) ? "bg-brand" : "bg-black/60"
                }`}
              />
            )}
            {/* The first label wraps under its circle, the other two stay
                on one line -- exactly how the frames set them. */}
            <div
              className={`flex flex-col items-center gap-2 flex-shrink-0 ${i === 0 ? "w-[92px]" : "whitespace-nowrap"}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className={`w-12 h-12 rounded-full flex items-center justify-center ${circle}`}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <StepIcon id={step.id} />
                </svg>
              </span>
              <span
                className={`text-sm text-center leading-5 ${isCompleted || isActive ? "text-ink" : "text-black/60"}`}
              >
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
