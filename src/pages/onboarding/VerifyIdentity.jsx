import { useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, History } from "lucide-react";
import useKycFlow from "../../components/kyc/useKycFlow";
import { isMobileDevice } from "../../utils/deviceRedirect";

// Onboarding verify step — the navigated counterpart to the wizard modal
// ChoosePath used to open inline at Continue. Pre-create accounts have no
// dashboard or member shell yet, so this page carries its own minimal
// chrome, structurally the same as pages/dashboard/VerifyIdentity.jsx
// around the same shared useKycFlow.
//
// Flow contract:
//   - approved ("Done")  → continue the create path (paying-member)
//   - dismissal          → back to choose-path (nothing lost; the gate at
//                          Continue re-evaluates on the way back in)
//   - summary error      → fail open straight to paying-member, mirroring
//                          useKycGate: a broken GET /kyc must not trap a
//                          brand-new account on this step, and the backend
//                          stays authoritative at create time anyway.
//
// The email passed through location.state from SignUp must ride along to
// paying-member — PayingMember reads it off router state.
export default function VerifyIdentity() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? "";
  const toPayingMember = () => navigate("/onboarding/paying-member", { state: { email } });

  const flow = useKycFlow({
    onDismiss: () => navigate("/onboarding/choose-path", { state: { email } }),
    onHistory: () =>
      navigate(
        isMobileDevice() ? "/member/verify-identity/history" : "/dashboard/verify-identity/history",
      ),
    onComplete: toPayingMember,
  });

  const summaryFailed = Boolean(flow.kyc.isError && !flow.kyc.summary);
  useEffect(() => {
    if (summaryFailed) toPayingMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryFailed]);

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      <header className="relative flex items-center px-6 lg:px-8 py-5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="tertiary"
            size="icon-md"
            onClick={() => navigate("/onboarding/choose-path", { state: { email } })}
            aria-label="Back to choose path"
            className="flex-shrink-0"
          >
            <ArrowLeft size={17} strokeWidth={2} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 m-0">Identity Verification</h1>
            <p className="text-xs text-gray-400 mt-0.5 m-0">
              Required to create and manage communities.
            </p>
          </div>
        </div>
        <Button
          variant="tertiary"
          size="icon-sm"
          aria-label="Attempt history"
          onClick={() =>
            navigate(
              isMobileDevice()
                ? "/member/verify-identity/history"
                : "/dashboard/verify-identity/history",
            )
          }
          className="ml-auto"
        >
          <History size={16} className="text-ink" />
        </Button>
      </header>

      <main className="relative flex-1 px-6 lg:px-8 pb-10">
        <div className="flex flex-col gap-3 w-full max-w-[640px] mx-auto">
          {flow.stepper && (
            <div className="rounded-2xl border border-surface-container-border bg-white/70 backdrop-blur-xl px-4 py-3.5">
              {flow.stepper}
            </div>
          )}
          <div className="flex flex-col gap-3">{flow.body}</div>
          {flow.footer && <div className="mt-1 flex">{flow.footer}</div>}
        </div>
      </main>
    </div>
  );
}
