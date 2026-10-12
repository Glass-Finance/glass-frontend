import { useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { goBackInApp } from "../../../../utils/memberBack";
import { History } from "lucide-react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import useKycFlow from "../../../../components/kyc/useKycFlow";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

function StepHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-center relative pt-6 px-5 pb-6">
      {onBack && (
        <MobileBackButton aria-label="Back" onClick={onBack} className="absolute left-5" />
      )}
      <h1 className="text-lg font-medium text-ink m-0">{title}</h1>
      {right && <div className="absolute right-5">{right}</div>}
    </div>
  );
}

// Member-app identity verification (mobile-only — the device gate keeps
// desktop traffic on the dashboard-styled page). Thin chrome wrapper around
// the shared KYC flow (useKycFlow) — same stepper/steps/footer as the
// dashboard page and the KycWizardModal; the Smile ID state machine stays
// in useKycVerification.
export default function VerifyIdentity() {
  const navigate = useNavigate();
  const flow = useKycFlow({
    onDismiss: () => goBackInApp(navigate, "/member/profile"),
    onHistory: () => navigate("/member/verify-identity/history"),
  });

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <StepHeader
        title="Identity Verification"
        onBack={() => goBackInApp(navigate, "/member/profile")}
        right={
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Attempt history"
            onClick={() => navigate("/member/verify-identity/history")}
            className=""
            aria-label="Attempt history"
          >
            <History size={16} className="text-ink" />
          </Button>
        }
      />

      <div className="px-4 flex flex-col gap-3">
        {flow.stepper && (
          <div className="rounded-2xl border border-surface-container-border bg-white/70 backdrop-blur-xl px-4 py-3.5">
            {flow.stepper}
          </div>
        )}
        <div className="flex flex-col gap-3">{flow.body}</div>
        {flow.footer && <div className="mt-1 flex">{flow.footer}</div>}
      </div>
    </div>
  );
}
