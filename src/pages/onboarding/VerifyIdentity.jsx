import { useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, History } from "lucide-react";
import useKycFlow from "../../components/kyc/useKycFlow";
import { isMobileDevice } from "../../utils/deviceRedirect";
import { KYC_SUBMITTABLE_ID_TYPE_OPTIONS, idTypeLabel } from "../../utils/kycStatus";

// Desktop "Choose ID" (Figma "Identity Verification · Choose ID", node
// 1067:34982): card subtitles spell the acronym out.
const ID_TYPE_DESCRIPTIONS = {
  BVN: "Bank Verification Number",
  NIN_V2: "National Identification Number",
};

// Desktop only (lg+) and only for the first step: the Figma frame's layout,
// driven by the very same flow state the shared IdTypeStep + footer use
// (kyc.idType, setStep("next-up"), onDismiss), so behaviour is identical --
// only the presentation differs. Phones and the later steps keep the shared
// flow UI. Under 800px tall the vertical gaps tighten so it still fits.
function DesktopChooseId({ flow, onNotNow }) {
  const { kyc, busy } = flow;
  return (
    <div className="hidden lg:flex flex-col items-center w-[792px] max-w-full mx-auto">
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="m-0 text-[32px] leading-10 font-semibold text-ink">
            Choose how to verify your identity
          </h2>
          <p className="m-0 text-[18px] leading-7 text-black/60">
            You&apos;ll need to verify your identity to create or manage a community.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-[752px] max-w-full">
          <p className="m-0 text-sm leading-5 font-medium text-ink">Step 1 of 3</p>
          <div
            className="h-1 w-full rounded-[2px] bg-brand-100 overflow-hidden"
            role="progressbar"
            aria-label="Verification progress"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={1}
          >
            <div className="h-full w-1/3 bg-brand" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full mt-12 [@media(max-height:800px)]:mt-8">
        {/* Real radio inputs (visually hidden) inside labels: native radio
            semantics and arrow-key movement, no raw <button>. */}
        <div className="flex gap-5 w-full" role="radiogroup" aria-label="ID type">
          {KYC_SUBMITTABLE_ID_TYPE_OPTIONS.map((opt) => {
            const selected = kyc.idType === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex-1 min-w-0 flex flex-col gap-4 h-[184px] [@media(max-height:800px)]:h-[160px] p-6 rounded-g-1 bg-white border-2 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${selected ? "border-brand" : "border-hairline hover:border-hairline-strong"}`}
              >
                <input
                  type="radio"
                  name="desktop-kyc-id-type"
                  value={opt.value}
                  checked={selected}
                  disabled={busy}
                  onChange={() => kyc.setIdType(opt.value)}
                  className="sr-only"
                />
                {selected ? (
                  <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full border-2 border-hairline-disabled"
                  />
                )}
                <span className="flex flex-col gap-1 w-full">
                  <span className="text-[18px] leading-6 font-medium text-ink">{opt.label}</span>
                  <span className="text-base leading-6 text-black/60">
                    {ID_TYPE_DESCRIPTIONS[opt.value]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {/* Design-system Banner (docs/design-system.md §9.4). */}
        <div className="flex items-center gap-6 px-6 py-4 rounded-g-1 bg-brand-100 border border-brand/20">
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-full bg-brand text-white text-sm font-semibold flex items-center justify-center flex-shrink-0"
          >
            !
          </span>
          <p className="m-0 text-sm leading-5 text-ink">
            You&apos;ll enter your ID number directly with Smile ID. Glass never sees or stores it.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full mt-12 [@media(max-height:800px)]:mt-8">
        <Button
          fullWidth={false}
          onClick={() => flow.setStep("next-up")}
          disabled={busy}
          className="w-[460px] max-w-full h-16! py-5! px-10!"
        >
          Continue with {idTypeLabel(kyc.idType)}
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={onNotNow}
          className="h-auto! px-0! py-0! text-[16px]! leading-6 hover:bg-transparent!"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

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
  const chooseIdOnDesktop = flow.step === "id-type";
  useEffect(() => {
    if (summaryFailed) toPayingMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryFailed]);

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      {/* Desktop header per the Figma frame: a 48px back target with the 24px
          chevron and "Identity Verification" in Title/Small, 36px from the
          top and 48px in. */}
      <header className="relative flex items-center px-6 lg:px-12 py-5 lg:pt-9 lg:pb-0 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="tertiary"
            size="icon-md"
            onClick={() => navigate("/onboarding/choose-path", { state: { email } })}
            aria-label="Back to choose path"
            className="flex-shrink-0 lg:w-12 lg:h-12"
          >
            <ArrowLeft size={17} strokeWidth={2} className="lg:hidden" />
            <ChevronLeft size={24} strokeWidth={1.5} className="hidden lg:block text-ink" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 m-0 lg:text-base lg:leading-6 lg:font-medium lg:text-ink">
              Identity Verification
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 m-0 lg:hidden">
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

      {/* On desktop the first step is the Figma "Choose ID" layout, centred
          on the page (pb offsets the header so it centres on the viewport,
          as the frame does). Phones -- and every later step -- render the
          shared flow below unchanged. */}
      <main
        className={`relative flex-1 px-6 lg:px-8 pb-10 ${chooseIdOnDesktop ? "lg:flex lg:items-center lg:pb-[84px] lg:[@media(max-height:800px)]:pb-6!" : ""}`}
      >
        {chooseIdOnDesktop && (
          <DesktopChooseId
            flow={flow}
            onNotNow={() => navigate("/onboarding/choose-path", { state: { email } })}
          />
        )}
        <div
          className={`flex flex-col gap-3 w-full max-w-[640px] mx-auto ${chooseIdOnDesktop ? "lg:hidden" : ""}`}
        >
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
