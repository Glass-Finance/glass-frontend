/**
 * ChoosePath.jsx — no API calls, pure navigation
 * Receives email from router state (set by SignUp's OTP step)
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CloudImage from "../../components/common/CloudImage";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";
import { MobileBackButton } from "../../components/ui/MobileBackButton";
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
      // Figma sets "Join Now." on its own line on desktop; phones wrap freely.
      description: (
        <>
          Your community already exists. <br className="max-lg:hidden" />
          Join Now.
        </>
      ),
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

      {/* Desktop logo per Figma "MacBook Pro 14" - 24" (node 1:3917): 42px
          mark + 24px wordmark, 49px from the top. */}
      <header className="relative hidden lg:flex items-center px-6 lg:px-7 py-5 lg:pt-[49px] lg:[@media(max-height:800px)]:pt-5! lg:pb-0 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CloudImage
            publicId="glass/Glass"
            alt="Glass"
            width={84}
            objectFit="contain"
            className="w-7 h-7 lg:w-[42px] lg:h-[42px]"
          />
          <span className="font-medium text-gray-900 text-base lg:text-[24px]">Glass</span>
        </div>
      </header>

      {/* Phones (Figma "iPhone 16 - 118"): no logo bar -- a round back
          button instead, which exits to the dashboard like Skip does (this
          is the first onboarding screen, so there is no earlier step). */}
      <div className="lg:hidden px-4 pt-12">
        <MobileBackButton aria-label="Go back" onClick={() => navigate("/dashboard/home")} />
      </div>

      {/* Desktop (lg+) follows Figma "MacBook Pro 14" - 24": no step label
          (the phone frame dropped it too), Headline/Large title at y=148, a
          938px column of two 300px cards, the blue "isn't final" banner and a
          420px, 64px Continue. Every desktop value is lg:, so the phone
          layout is untouched. */}
      <main className="relative flex-1 flex flex-col items-center justify-start px-4 lg:px-8 pt-6 lg:pt-[57px] lg:[@media(max-height:800px)]:pt-5! pb-10 lg:[@media(max-height:800px)]:pb-4!">
        <div className="text-center mb-20 lg:mb-[66px] lg:[@media(max-height:800px)]:mb-7!">
          <h1 className="text-base font-medium text-ink mb-1 lg:text-[32px] lg:leading-10 lg:font-semibold lg:text-ink">
            What would you like to do?
          </h1>
          <p className="text-sm text-gray-500 lg:text-[18px] lg:leading-7 lg:text-black/60">
            Are you setting up a community, or joining one you've been invited to?
          </p>
        </div>

        {/* Phone frame only (Figma "iPhone 16 - 118"); desktop has no such
            line above its cards. */}
        <p className="lg:hidden w-full max-w-[500px] text-left text-sm text-ink mb-4">
          Choose the type of plan you want to create
        </p>
        <div className="flex flex-col lg:flex-row lg:justify-center gap-4 lg:gap-6 mb-4 lg:mb-6 lg:[@media(max-height:800px)]:mb-4! w-full max-w-[500px] lg:max-w-[938px] items-stretch">
          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`relative flex flex-col items-center text-center gap-0 px-6 pt-16 pb-6 lg:justify-center lg:h-[300px] lg:pt-[60px] lg:pb-12 lg:[@media(max-height:800px)]:h-[220px]! lg:[@media(max-height:800px)]:pt-[52px]! lg:[@media(max-height:800px)]:pb-6! rounded-g-1 lg:rounded-lg transition-all duration-200 cursor-pointer w-full lg:w-auto lg:flex-1 border bg-white ${isSelected ? "border-2 border-brand" : "border-hairline-neutral max-lg:border-2 lg:border-2 lg:border-hairline"}`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 mb-4">
                  <CloudImage
                    publicId={option.icon}
                    alt={option.title}
                    width={112}
                    objectFit="contain"
                    className="w-7 h-7 lg:w-8 lg:h-8"
                  />
                </div>
                <div className="flex-none min-w-0">
                  <h3 className="font-medium text-ink text-lg mb-1 lg:text-[24px] lg:leading-[29px]">
                    {option.title}
                  </h3>
                  <p className="text-base text-gray-500 leading-relaxed lg:text-[18px] lg:leading-[22px] lg:tracking-[0.5px] lg:text-black/60">
                    {option.description}
                  </p>
                </div>
                <div className="flex-shrink-0 absolute top-6 left-6">
                  {isSelected ? (
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center bg-brand">
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
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full border-2 border-hairline-disabled" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop only (not in the phone frame): the design-system Banner
            (docs/design-system.md §9.4 -- #ccdaff fill, brand @20% stroke,
            r=4) with the info icon, 48px above Continue. */}
        <div className="hidden lg:flex items-center gap-6 px-6 py-4 lg:[@media(max-height:800px)]:py-3 mb-12 lg:[@media(max-height:800px)]:mb-6 w-full max-w-[938px] rounded-g-1 bg-brand-100 border border-brand/20">
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-full bg-brand text-white text-sm font-semibold flex items-center justify-center flex-shrink-0"
          >
            !
          </span>
          <p className="text-sm leading-5 text-ink text-left">
            This choice isn't final — whichever option you pick now, you can still create or join
            additional communities later from your dashboard.
          </p>
        </div>

        {/* Phones: Skip and Continue share one row, Skip on the left (row-
            reverse keeps Continue first in tab order, as on desktop). */}
        <div className="flex flex-row-reverse lg:flex-col items-center gap-4 lg:gap-6 lg:[@media(max-height:800px)]:gap-3! w-full max-w-[500px]">
          {/* Create is gated: while the KYC summary resolves the button
              holds (never "still loading ⇒ let them through") and Continue
              then routes to the verify step or straight past it (see
              handleContinue). Join has no gate and stays immediate. */}
          <Button
            onClick={handleContinue}
            loading={selected === "create" && kycGate.isLoading}
            className="max-lg:flex-[2] max-lg:h-12 max-lg:py-3 max-lg:px-6 max-lg:text-[14px] lg:w-[420px] lg:h-16 lg:[@media(max-height:800px)]:h-14! lg:py-5 lg:[@media(max-height:800px)]:py-4! lg:px-10"
          >
            Continue
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => navigate("/dashboard/home")}
            className="max-lg:flex-1 max-lg:text-brand lg:text-brand lg:text-[16px] lg:h-auto lg:px-0 lg:py-0 lg:hover:bg-transparent"
          >
            Skip
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </main>
    </div>
  );
}
