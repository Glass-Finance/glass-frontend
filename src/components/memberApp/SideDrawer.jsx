import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../ui/Button";
import {
  Home as HomeIcon,
  CreditCard,
  Mail,
  Settings,
  LogOut,
  X,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { toastSuccess } from "../../utils/toast";

// No Profile entry here: the member app header now carries the profile
// photo (components/memberApp/ProfileAvatar.jsx), which links straight to
// /member/profile — a second way into the same page was redundant.
const NAV_ITEMS = [
  { Icon: HomeIcon, label: "Home", to: "/member/home" },
  { Icon: CreditCard, label: "Manage Payments", to: "/member/manage-payments" },
  { Icon: Mail, label: "Invitations", to: "/member/invites" },
  { Icon: Settings, label: "Settings", to: "/member/settings" },
];

// Shared across the whole member app (rendered once by MemberAppLayout) so
// every page — not just Home — has a way to reach Settings.
export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAdmin } = useAuth();

  async function handleLogout() {
    onClose();
    await logout();
    toastSuccess("Signed out");
    navigate("/member/app-sign-in", { replace: true });
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-[280ms] ease-[ease] ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[300px] z-50 bg-[#D9D9D9] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pt-5 px-5 pb-4">
          <div className="flex items-center gap-1.5">
            <div>
              <img src="/Glass.webp" alt="Glass" className="w-[30px] h-[30px]" />
            </div>
            <span className="text-lg font-medium text-ink">Glass</span>
          </div>

          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close menu"
            onClick={onClose}
            className=""
          >
            <X size={20} strokeWidth={2} />
          </Button>
        </div>

        <div className="h-px bg-[#0000000D] mx-0 my-0" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pt-2 px-4 pb-2 flex flex-col gap-1">
          {NAV_ITEMS.map(({ Icon, label, to }) => {
            // Figma's Navigation Menu marks the current row with a light-blue
            // #ccdaff container and brand-coloured icon+label (§3). Exact
            // prefix match so /member/settings/account also lights Settings.
            const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <button
                key={label}
                onClick={() => {
                  onClose();
                  navigate(to);
                }}
                className={`flex items-center gap-3 py-3.5 px-3 rounded-xl border-none cursor-pointer w-full text-left transition-colors ${
                  isActive ? "bg-brand-100 text-brand" : "bg-transparent text-ink hover:bg-black/5"
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.6}
                  className={isActive ? "text-brand" : "text-ink-strong"}
                />
                <span
                  className={`text-[15px] ${isActive ? "font-medium text-brand" : "font-normal text-ink"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}

          {isAdmin && (
            <>
              <div className="h-px bg-[#0000000D] my-1 mx-0" />
              <button
                onClick={() => {
                  onClose();
                  navigate("/dashboard/home");
                }}
                className="flex items-center gap-3 py-3.5 px-3 rounded-xl border-none bg-transparent cursor-pointer w-full text-left"
              >
                <LayoutDashboard size={20} strokeWidth={1.6} className="text-brand" />
                <span className="text-[15px] font-normal text-brand">Admin Dashboard</span>
              </button>
            </>
          )}
        </nav>

        {/* Log out — pinned to bottom */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 pt-5 px-6 border-none bg-transparent cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus pb-[max(env(safe-area-inset-bottom,0px)_+_32px,56px)]"
        >
          <LogOut size={18} strokeWidth={1.8} className="text-danger" />
          <span className="text-[15px] font-medium text-danger">Log Out</span>
        </button>
      </div>
    </>
  );
}
