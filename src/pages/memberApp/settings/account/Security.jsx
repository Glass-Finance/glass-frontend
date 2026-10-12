import { useNavigate } from "react-router-dom";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { Lock } from "lucide-react";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";
import { IconSecurity, IconDropdown } from "../../../../components/ui/icons/SettingsIcons";

// Figma draws no distinct leading glyph for these two rows, so Password keeps
// a lucide Lock; Multi-Factor Authentication uses the file's own Security
// glyph (navMenuIcons/Security). Both render bare at 24px like the landing
// rows -- no tile.
const ITEMS = [
  {
    Icon: Lock,
    label: "Password",
    desc: "Change your account password",
    to: "/member/security/password",
  },
  {
    Icon: IconSecurity,
    label: "Multi-Factor Authentication",
    desc: "Secure your account with an authenticator app",
    to: "/member/security/authentication",
  },
];

export default function Security() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Security</h1>
      </div>

      <div className="px-4">
        <div className="rounded-xl bg-surface-container border border-black/10 overflow-hidden">
          {ITEMS.map(({ Icon, label, desc, to }, i) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className={`flex items-center gap-3 w-full text-left py-3.5 px-4 bg-transparent border-none cursor-pointer transition-colors hover:bg-black/[0.03] ${i < ITEMS.length - 1 ? "border-b border-black/10" : "border-b-0"}`}
            >
              <Icon size={24} className="text-ink flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink m-0">{label}</p>
                <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">{desc}</p>
              </div>
              <IconDropdown size={20} className="text-black/40 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
