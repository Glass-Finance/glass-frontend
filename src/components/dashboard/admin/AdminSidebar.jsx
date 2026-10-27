/**
 * AdminSidebar.jsx — left rail of the platform-admin shell (design:
 * Overview@1x). Rendered only on /dashboard/admin-panel and
 * /dashboard/system-config (DashboardLayout's isAdminChrome swap), so the
 * member Sidebar — including its own stripped platform-admin branch — is
 * untouched on every other route.
 *
 * Nav groups/labels/renames live in ./adminNav.js, shared with
 * PlatformAdmin.jsx's digit shortcuts. The six row counts come from
 * useAdminNavCounts (pageSize:1 totalElements per list endpoint).
 */
import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "../../ui/Button";
import { MobileOverlay } from "../SidebarPrimitives";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_TOP } from "./adminNav";
import { useAdminNavCounts } from "../../../hooks/useAdminNavCounts";
import { useAuth } from "../../../store/AuthContext";
import { getInitials } from "../../../utils/getInitials";
import { toPascalCaseName } from "../../../utils/format";
import { toastSuccess } from "../../../utils/toast";

export default function AdminSidebar({ mobileOpen, onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { data: counts } = useAdminNavCounts();
  const [loggingOut, setLoggingOut] = useState(false);

  // /dashboard/system-config is also a standalone route (App.jsx) — it
  // renders the same SystemConfig section, so it lights up the same row.
  const activeTab =
    location.pathname === "/dashboard/system-config"
      ? "system-config"
      : (searchParams.get("tab") ?? "overview");

  function goToTab(id) {
    // Fresh search string: switching sections drops any ?q= the ⌘K palette
    // seeded, so a stale search term can't leak into the next tab.
    navigate({ pathname: "/dashboard/admin-panel", search: `?tab=${id}` });
    onCloseMobile();
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      toastSuccess("Signed out");
      navigate("/sign-in", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const displayName = user?.firstName
    ? toPascalCaseName(`${user.firstName} ${user.lastName ?? ""}`.trim())
    : (user?.email ?? "");

  function renderRow({ id, label, Icon, count }) {
    const active = activeTab === id;
    return (
      // Nav rows are full-width left-aligned text rows rather than
      // any Figma button role, hence the layout/color overrides on
      // top of the tertiary variant.
      <Button
        key={id}
        variant="tertiary"
        size="sm"
        onClick={() => goToTab(id)}
        aria-current={active ? "page" : undefined}
        className={`w-full justify-start! px-3! rounded-g-1! ${
          active
            ? "bg-brand-tint! text-brand! font-medium hover:bg-brand-tint!"
            : "text-ink! font-normal hover:bg-surface-sunken!"
        }`}
      >
        <Icon size={15} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        {count && counts?.[id] != null && (
          <span className="text-[11px] font-normal text-gray-400">
            {counts[id].toLocaleString()}
          </span>
        )}
      </Button>
    );
  }

  return (
    <>
      <MobileOverlay mobileOpen={mobileOpen} onClose={onCloseMobile} />
      <div
        className={`fixed md:sticky top-0 left-0 h-dvh z-[60] w-[min(300px,84vw)] md:w-[264px] flex-shrink-0 flex flex-col bg-white md:border-r md:border-surface-container-border transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5">
          <img
            src="/Glass.webp"
            alt="Glass"
            className="w-8 h-8 object-contain flex-shrink-0 select-none"
          />
          <div className="min-w-0 flex items-center gap-1.5">
            <p className="m-0 text-sm font-bold text-ink leading-tight">Glass</p>
            <span className="px-1.5 py-[3px] rounded-full bg-brand-tint text-brand text-[9px] font-bold uppercase tracking-wide whitespace-nowrap leading-none">
              Platform Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Platform admin">
          {/* Overview — landing row above the group headers */}
          <div className="mt-1">{renderRow(ADMIN_NAV_TOP)}</div>
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="m-0 px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              {group.items.map(renderRow)}
            </div>
          ))}
        </nav>

        {/* Identity → own account settings; logout pinned right (design footer).
            Settings stays reachable here because the admin chrome replaces the
            member sidebar that used to carry the Settings link on this route. */}
        <div className="border-t border-[var(--color-hairline)] px-3 py-2.5 flex items-center gap-2">
          <Link
            to="/dashboard/settings/account/profile"
            title="Account settings"
            className="flex items-center gap-2.5 min-w-0 flex-1 no-underline rounded-g-1 px-1 py-1 -mx-1 hover:bg-surface-sunken"
          >
            <span className="w-8 h-8 rounded-full bg-brand-tint text-brand text-[11px] font-bold flex items-center justify-center flex-shrink-0 select-none">
              {getInitials(user)}
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-xs font-semibold text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                {displayName}
              </span>
              {user?.email && (
                <span className="block text-[11px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  {user.email}
                </span>
              )}
            </span>
          </Link>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Log out"
            title="Log out"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </>
  );
}
