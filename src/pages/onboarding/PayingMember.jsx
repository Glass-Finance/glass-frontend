/**
 * PayingMember.jsx — pure UI, no API.
 * Passes isPaying flag to OrganizationProfile via router state.
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

export default function PayingMember() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const email = location.state?.email;
  const [selected, setSelected] = useState("yes");

  const options = [
    { id: "yes", label: "Yes, I will pay dues", icon: "glass/auth/paying-dues" },
    { id: "no", label: "No, I'm exempt from payments", icon: "glass/auth/exempt-payments" },
  ];

  const go = (skip = false) =>
    navigate("/onboarding/organization-profile", {
      state: { email, isPaying: skip ? false : selected === "yes" },
    });

  // Same escape hatch as OrganizationProfile.jsx's handleBack: an
  // already-authenticated user (an existing admin creating another
  // community, or one who lands here by accident -- stale bookmark,
  // browser back/forward) goes straight to their dashboard instead of
  // stepping back into the middle of onboarding. This page previously had
  // no way back at all, not even to the previous step.
  const handleBack = () => {
    navigate(isAuthenticated ? "/dashboard/home" : "/onboarding/choose-path", { state: { email } });
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-start px-4 lg:px-6 pt-12 pb-14 lg:pt-[152px] lg:[@media(max-height:800px)]:pt-[72px]! lg:[@media(max-height:800px)]:pb-4! bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      {/* Desktop logo per Figma "MacBook Pro 14" - 35" (node 1:3954): 42px
          mark + 24px wordmark, 49px from the top. */}
      <div className="absolute top-[49px] lg:[@media(max-height:800px)]:top-5 left-7 hidden lg:flex items-center gap-2">
        <CloudImage
          publicId="glass/Glass"
          alt="Glass"
          width={84}
          objectFit="contain"
          className="w-[42px] h-[42px]"
        />
        <span className="font-medium text-gray-900 text-[24px]">Glass</span>
      </div>

      {/* Desktop (lg+) follows Figma "MacBook Pro 14" - 35": no step label,
          a one-line Headline/Large title at y=152, a 938px row of two 300px
          cards and a 460px, 64px Continue with Skip under it. Every desktop
          value is lg:, so the phone layout is untouched. */}
      <div className="w-full max-w-lg lg:max-w-[938px] flex flex-col items-center">
        {/* Phones (Figma "iPhone 16 - 117"): the round back button replaces
            the logo and the text back link; same destination. */}
        <MobileBackButton
          aria-label="Go back"
          onClick={handleBack}
          className="lg:hidden self-start mb-6"
        />
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          type="button"
          onClick={handleBack}
          // Not in the desktop frame, but it is the page's only way back, so
          // it stays -- tucked under the logo, out of the frame's layout.
          className="self-start mb-4 -ml-1 max-lg:hidden lg:absolute lg:top-[104px] lg:[@media(max-height:800px)]:top-[72px]! lg:left-6 lg:mb-0"
        >
          <ArrowLeft size={15} />
          {isAuthenticated ? "Back to dashboard" : "Back"}
        </Button>
        <div className="text-center mb-16 lg:mb-[54px] lg:[@media(max-height:800px)]:mb-7!">
          <h1 className="text-base font-medium text-ink mb-1 lg:text-[32px] lg:leading-10 lg:font-semibold">
            Are you a paying member of this community?
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto lg:max-w-[748px] lg:text-[18px] lg:leading-7 lg:text-black/60">
            Some admins manage communities without contributing financially. Let us know so we set
            up your account correctly.
          </p>
        </div>

        {/* Phone frame only (Figma "iPhone 16 - 117"); desktop has no such
            line above its cards. */}
        <p className="lg:hidden w-full text-left text-sm text-ink mb-4">
          Choose the type of plan you want to create
        </p>
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mb-12 lg:mb-14 lg:[@media(max-height:800px)]:mb-8! w-full">
          {options.map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`flex-1 relative flex flex-col items-center text-center gap-0 px-6 pt-16 pb-10 lg:justify-center lg:h-[300px] lg:pt-[60px] lg:pb-12 lg:[@media(max-height:800px)]:h-[220px]! lg:[@media(max-height:800px)]:pt-[52px]! lg:[@media(max-height:800px)]:pb-6! rounded-g-1 lg:rounded-lg bg-white transition-all duration-200 cursor-pointer border ${isSelected ? "border-2 border-brand" : "border-hairline-neutral max-lg:border-2 lg:border-2 lg:border-hairline"}`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 mb-4 lg:w-11 lg:h-11">
                  <CloudImage
                    publicId={opt.icon}
                    alt={opt.label}
                    width={96}
                    objectFit="contain"
                    className="w-8 h-8 lg:w-11 lg:h-11"
                  />
                </div>
                <span className="flex-none min-w-0 text-base font-normal text-ink lg:text-[24px] lg:leading-[29px] lg:font-medium">
                  {opt.label}
                </span>
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
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full border-2 border-gray-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Phones: Skip and Continue share one row, Skip on the left (row-
            reverse keeps Continue first in tab order). lg:contents hands both
            buttons back to the column above, exactly as before. */}
        <div className="flex flex-row-reverse items-center gap-4 w-full lg:contents">
          <Button
            onClick={() => go()}
            className="max-w-sm max-lg:flex-[2] max-lg:h-12 max-lg:py-3 max-lg:px-6 max-lg:text-[14px] lg:max-w-[460px] lg:h-16 lg:[@media(max-height:800px)]:h-14! lg:py-5 lg:[@media(max-height:800px)]:py-4! lg:px-10"
          >
            Continue
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => go(true)}
            className="max-lg:flex-1 max-lg:text-brand lg:mt-6 lg:[@media(max-height:800px)]:mt-3! lg:text-brand lg:text-[16px] lg:h-auto lg:px-0 lg:py-0 lg:hover:bg-transparent"
          >
            Skip
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  );
}
