/**
 * ChoosePath.jsx — no API calls, pure navigation
 * Receives email from router state (set by SignUp's OTP step)
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Info } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import StepIndicator from "../../components/onboarding/StepIndicator";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";
import { useKycGate } from "../../hooks/useKycGate";

export default function ChoosePath() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const kycGate = useKycGate();
  const email = location.state?.email ?? "";
  // Entry points that specifically mean "join" (e.g. Communities Home's
  // Join Community button) pass this so the option isn't stuck defaulting
  // to Create -- see CommunitiesHome.jsx.
  const [selected, setSelected] = useState(location.state?.intent === "join" ? "join" : "create");

  const options = [
    {
      id: "create",
      title: "Create Community",
      description: "No existing members or records. Start building your community on Glass.",
      icon: "glass/auth/create-community",
    },
    {
      id: "join",
      title: "Join Community",
      description: "Your community already exists. Join Now.",
      icon: "glass/auth/join-community",
    },
  ];

  const handleContinue = () => {
    if (selected === "create") {
      // Navigated gate — Continue routes to the verify step instead of
      // opening the wizard modal inline. The step is skipped exactly when
      // the modal gate would have let the action through:
      //   - summary still loading → hold (the Button spins above; no guess)
      //   - approved / exempt (platform staff, kill switch) / summary
      //     failed (fail open — backend stays authoritative) / settled
      //     summary with no KYC record → straight to paying-member
      //   - known not-approved → /onboarding/verify-identity
      if (kycGate.isLoading) return;
      const skip = kycGate.exempt || kycGate.isError || kycGate.isApproved || !kycGate.status;
      navigate(skip ? "/onboarding/paying-member" : "/onboarding/verify-identity", {
        state: { email },
      });
      return;
    }
    if (isAuthenticated) {
      // Join.jsx (below) is a full account-registration form -- fine for a
      // brand-new visitor, but an already-authenticated user (e.g. an admin
      // clicking Join Community from Communities Home, or someone who just
      // finished SignUp's own registration+OTP a moment ago) already has a
      // real account. Routing them through registration again just gets a
      // 409 "you already have an account" and dead-ends at sign-in instead
      // of actually joining anything. Take them straight to browsing
      // communities to request to join with the account they already have.
      navigate("/member/communities/search");
    } else {
      // This account was just created by the community-owner signup flow.
      // Preserve the email shortcut to passwordless sign-in, but let the
      // user complete it on the device they're already using.
      const target = email ? `/member/join?email=${encodeURIComponent(email)}` : "/member/join";
      navigate(target);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-contain bg-center lg:bg-page-default">
      {/* Mobile-only backdrop, matching AuthLayout's single-layer background --
          no GlassLogoGlow stacked on top here: both it and this background
          anchor their glow to the same bottom-left corner, and stacking them
          compounded into a much more saturated blue than every other mobile
          screen (auth pages, Communities Home) shows. */}
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      <header className="relative flex items-center px-6 lg:px-8 py-5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CloudImage
            publicId="glass/Glass"
            alt="Glass"
            width={56}
            objectFit="contain"
            className="w-7 h-7"
          />
          <span className="font-medium text-gray-900 text-base">Glass</span>
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-6 lg:px-8 pb-10">
        <StepIndicator stepId="choose-path" />
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            What would you like to do?
          </h1>
          <p className="text-sm text-gray-500">
            Are you setting up a community, or joining one you've been invited to?
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:justify-center gap-3 lg:gap-5 mb-8 w-full max-w-[500px] lg:max-w-none items-stretch">
          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`relative flex flex-row lg:flex-col items-center text-left lg:text-center gap-4 lg:gap-0 px-5 lg:px-10 py-5 lg:py-8 rounded-2xl transition-all duration-200 cursor-pointer w-full lg:w-[380px] border bg-white ${isSelected ? "border-2 border-brand" : "border-white"}`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[10px] bg-brand-wash lg:bg-transparent lg:rounded-none lg:w-14 lg:h-14 lg:mt-6 lg:mb-5">
                  <CloudImage
                    publicId={option.icon}
                    alt={option.title}
                    width={112}
                    objectFit="contain"
                    className="w-6 h-6 lg:w-14 lg:h-14"
                  />
                </div>
                <div className="flex-1 min-w-0 lg:flex-none">
                  <h3 className="font-semibold text-gray-900 text-base mb-1 lg:mb-2">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{option.description}</p>
                </div>
                <div className="flex-shrink-0 lg:absolute lg:top-4 lg:left-4">
                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-brand">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-hairline-disabled" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-1.5 mb-6 w-full max-w-[500px]">
          <Info size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-snug text-left">
            This choice isn't final — whichever option you pick now, you can still create or join
            additional communities later from your dashboard.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-[500px]">
          {/* Create is gated: while the KYC summary resolves the button
              holds (never "still loading ⇒ let them through") and Continue
              then routes to the verify step or straight past it (see
              handleContinue). Join has no gate and stays immediate. */}
          <Button onClick={handleContinue} loading={selected === "create" && kycGate.isLoading}>
            Continue
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => navigate("/dashboard/home")}
          >
            Skip
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </main>
    </div>
  );
}
