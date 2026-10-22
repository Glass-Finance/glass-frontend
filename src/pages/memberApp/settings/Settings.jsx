import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { IdCard, LogOut } from "lucide-react";
import { useAuth } from "../../../store/AuthContext";
import GlassLogoGlow from "../../../components/memberApp/GlassLogoGlow";
import InstallAppSetting from "../../../components/memberApp/InstallAppSetting";
import { toastSuccess } from "../../../utils/toast";
import { useKycSummary } from "../../../hooks/useKyc";
import KycStatusBadge from "../../../components/memberApp/KycStatusBadge";
import KycWizardModal from "../../../components/kyc/KycWizardModal";
import { kycDisabled } from "../../../lib/flags";
import MemberPageHeader from "../../../components/memberApp/MemberPageHeader";
import {
  IconUserProfile,
  IconSecurity,
  IconNotification,
  IconPayments,
  IconAutopay,
  IconCommunity,
  IconDropdown,
} from "../../../components/ui/icons/SettingsIcons";

// Row icons are the file's own glyphs (docs/design-system.md §3), not lucide
// stand-ins. Identity Verification is the one app-added row Figma does not
// draw, so it keeps a lucide glyph -- there is no Figma icon to match.
const SECTIONS = [
  {
    label: "Account",
    items: [
      {
        Icon: IconUserProfile,
        label: "Profile",
        desc: "Your name, email and phone number",
        to: "/member/profile",
      },
      {
        Icon: IdCard,
        label: "Identity Verification",
        desc: "Verify your identity with Smile ID",
        to: "/member/verify-identity",
        kyc: true,
      },
      {
        Icon: IconSecurity,
        label: "Security",
        desc: "Password and login protection",
        to: "/member/security",
      },
      {
        Icon: IconNotification,
        label: "Notifications",
        desc: "What you get notified about",
        to: "/member/notification-settings",
      },
    ],
  },
  {
    label: "Payments",
    items: [
      {
        Icon: IconPayments,
        label: "Payment Methods",
        desc: "Saved banks and auto-pay methods",
        to: "/member/saved-cards",
      },
      {
        Icon: IconAutopay,
        label: "Auto-Pay",
        desc: "Plans set to charge automatically",
        to: "/member/auto-pay",
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        Icon: IconCommunity,
        label: "My Communities",
        desc: "Communities you belong to",
        to: "/member/communities",
      },
    ],
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const hideKyc = kycDisabled();
  const { data: kycSummary } = useKycSummary();
  // The Identity Verification row opens the wizard modal in place instead
  // of routing to the verify page (same flow, no context switch).
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  const sections = hideKyc
    ? SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((item) => !item.kyc),
      }))
    : SECTIONS;

  async function handleLogout() {
    await logout();
    toastSuccess("Signed out");
    // Not /sign-in -- that's the org/admin sign-in page. This is the member
    // app's own Settings, so the sign-up link there needs to point back at
    // /member/join, not /sign-up (see SignIn.jsx's isMemberSignIn check).
    navigate("/member/app-sign-in");
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <MemberPageHeader
        title="Settings"
        description="Manage your account, payment preferences, and communities."
        onBack={() => navigate(-1)}
      />

      <div className="px-4 md:mx-auto md:w-full md:max-w-3xl md:px-0">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            {/* Figma section header: 14px/500 at #000000 @ 0.6. */}
            <p className="text-[14px] font-medium text-black/60 mt-0 mx-1 mb-2">{section.label}</p>
            {/* Figma settings card: r=12, fill #ffffff@0.6, 1px #000000@0.1. */}
            <div className="rounded-xl bg-surface-container border border-black/10 overflow-hidden">
              {section.items.map(({ Icon, label, desc, to, kyc }, i) => (
                <button
                  key={label}
                  onClick={() => (kyc ? setKycWizardOpen(true) : navigate(to))}
                  className={`flex items-center gap-3 w-full text-left py-3.5 px-4 bg-transparent border-none cursor-pointer transition-colors hover:bg-black/[0.03] ${i < section.items.length - 1 ? "border-b border-black/10" : "border-b-0"}`}
                >
                  {/* Bare Figma glyph, no tile -- 24px, #000000. */}
                  <Icon size={24} className="text-ink flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink m-0">{label}</p>
                    <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">{desc}</p>
                  </div>
                  {kyc && kycSummary?.status && (
                    <KycStatusBadge
                      status={kycSummary.status}
                      showLabel={false}
                      className="flex-shrink-0"
                    />
                  )}
                  <IconDropdown size={20} className="text-black/40 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <InstallAppSetting />

        <Button
          variant="outline-neutral"
          size="sm"
          onClick={handleLogout}
          fullWidth={false}
          className="w-full"
        >
          <LogOut size={16} className="text-brand" />
          <span className="text-sm font-medium text-brand">Log Out</span>
        </Button>
      </div>

      <KycWizardModal
        open={kycWizardOpen}
        onClose={() => setKycWizardOpen(false)}
        historyPath="/member/verify-identity/history"
      />
    </div>
  );
}
