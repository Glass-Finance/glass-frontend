import { ONBOARDING_STEPS } from "../../utils/onboardingSteps";

// The desktop sidebar equivalent of StepIndicator.jsx's mobile progress
// bar — used by the three onboarding screens detailed enough to warrant a
// full step list (OrganizationProfile, PaymentProfile, AddMembers).
//
// This used to be copy-pasted independently into all three of those files,
// each with its own small drift: OrganizationProfile.jsx's copy dropped the
// gray-600 label color for a completed-but-inactive step (so a done step's
// label looked identical to an upcoming one), and two of the three files
// had independently reinvented a local StepIcon with slightly different
// prop shapes. Consolidated here as the single correct version so a future
// change (a new step, a color tweak) only has to happen once.
export function StepIcon({ id }) {
  switch (id) {
    case "organization":
      return (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      );
    case "payment":
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </>
      );
    case "members":
      return (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    default:
      return null;
  }
}

/**
 * activeStepId: the current screen's step id (e.g. "payment").
 * completedStepIds: array of step ids already done by the time this screen
 * is reached — this genuinely differs per screen (a later screen has more
 * completed steps behind it), so it stays a prop rather than something this
 * component guesses.
 */
export default function OnboardingStepsSidebar({ activeStepId, completedStepIds }) {
  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 bg-surface-container border-r border-outline-on-surface flex-col pt-10 px-6">
      {ONBOARDING_STEPS.map((step, i) => {
        const isActive = step.id === activeStepId;
        const isCompleted = completedStepIds.includes(step.id);
        const isLast = i === ONBOARDING_STEPS.length - 1;
        return (
          <div key={step.id} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? "bg-brand text-white"
                    : isActive
                      ? "bg-white border-2 border-brand text-brand"
                      : "bg-white border border-outline-on-surface text-gray-400"
                }`}
                style={
                  isActive && !isCompleted
                    ? { boxShadow: "0 0 0 4px rgba(0,47,167,0.15)" }
                    : undefined
                }
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <StepIcon id={step.id} />
                  </svg>
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-px my-1 min-h-10 ${isCompleted ? "bg-brand" : "bg-outline-on-surface"}`}
                />
              )}
            </div>
            <div className="pt-1.5 pb-10">
              <span
                className={`text-sm font-medium ${isActive ? "text-ink" : isCompleted ? "text-gray-600" : "text-gray-400"}`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
