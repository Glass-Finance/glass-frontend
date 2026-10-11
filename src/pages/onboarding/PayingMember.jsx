/**
 * PayingMember.jsx — pure UI, no API.
 * Passes isPaying flag to OrganizationProfile via router state.
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import StepIndicator from "../../components/onboarding/StepIndicator";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";

export default function PayingMember() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const email = location.state?.email;
  const [selected, setSelected] = useState("yes");

  const options = [
    { id: "yes", label: "Yes, I Will pay dues", icon: "glass/auth/paying-dues" },
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
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-14 lg:py-0 bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      <div className="absolute top-5 left-6 lg:left-8 flex items-center gap-2">
        <CloudImage
          publicId="glass/Glass"
          alt="Glass"
          width={56}
          objectFit="contain"
          className="w-7 h-7"
        />
        <span className="font-medium text-gray-900">Glass</span>
      </div>

      <div className="w-full max-w-lg flex flex-col items-center">
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          type="button"
          onClick={handleBack}
          className="self-start mb-4 -ml-1"
        >
          <ArrowLeft size={15} />
          {isAuthenticated ? "Back to dashboard" : "Back"}
        </Button>
        <StepIndicator stepId="paying-member" />
        <div className="text-center mb-8">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
            Are you a paying member of this community?
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Some admins manage communities without contributing financially. Let us know so we set
            up your account correctly.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 mb-8 w-full">
          {options.map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`flex-1 relative flex flex-row lg:flex-col items-center text-left lg:text-center gap-4 lg:gap-0 px-5 lg:px-6 py-5 lg:py-8 rounded-2xl bg-white transition-all duration-200 cursor-pointer border ${isSelected ? "border-2 border-brand" : "border-white"}`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[10px] bg-brand-wash lg:bg-transparent lg:rounded-none lg:w-12 lg:h-12 lg:mb-3 lg:mt-2">
                  <CloudImage
                    publicId={opt.icon}
                    alt={opt.label}
                    width={96}
                    objectFit="contain"
                    className="w-6 h-6 lg:w-12 lg:h-12"
                  />
                </div>
                <span className="flex-1 min-w-0 lg:flex-none text-sm font-medium text-gray-900">
                  {opt.label}
                </span>
                <div className="flex-shrink-0 lg:absolute lg:top-3 lg:left-3">
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
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button onClick={() => go()} className="max-w-sm">
          Continue
        </Button>
        <Button variant="tertiary" size="sm" fullWidth={false} onClick={() => go(true)}>
          Skip
        </Button>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  );
}
