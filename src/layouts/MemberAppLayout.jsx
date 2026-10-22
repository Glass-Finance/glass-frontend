import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Bell,
  CalendarClock,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  UsersRound,
} from "lucide-react";
import InvitePopup from "../components/memberApp/InvitePopup";
import ProfileAvatar from "../components/memberApp/ProfileAvatar";
import { Button } from "../components/ui/Button";
import { useAuth } from "../store/AuthContext";
import { toPascalCaseName } from "../utils/format";
import { toastSuccess } from "../utils/toast";

const TABS = [
  { to: "/member/home", label: "Home", Icon: Home },
  { to: "/member/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { to: "/member/upcoming", label: "Upcoming", Icon: CalendarClock },
  { to: "/member/notifications", label: "Notifications", Icon: Bell },
];

const DESKTOP_LINKS = [
  { to: "/member/home", label: "Overview", Icon: Home, match: ["/member/home"] },
  {
    to: "/member/transactions",
    label: "Payment history",
    Icon: ArrowLeftRight,
    match: ["/member/transactions"],
  },
  {
    to: "/member/upcoming",
    label: "Upcoming payments",
    Icon: CalendarClock,
    match: ["/member/upcoming"],
  },
  {
    to: "/member/manage-payments",
    label: "Manage payments",
    Icon: CreditCard,
    match: ["/member/manage-payments", "/member/pay/", "/member/auto-pay", "/member/saved-cards"],
  },
  {
    to: "/member/notifications",
    label: "Notifications",
    Icon: Bell,
    match: ["/member/notifications"],
  },
  {
    to: "/member/invites",
    label: "Invitations",
    Icon: Mail,
    match: ["/member/invites"],
  },
  {
    to: "/member/communities",
    label: "My communities",
    Icon: UsersRound,
    match: ["/member/communities"],
  },
  {
    to: "/member/settings",
    label: "Settings",
    Icon: Settings,
    match: [
      "/member/settings",
      "/member/profile",
      "/member/security",
      "/member/verify",
      "/member/update-email",
      "/member/notification-settings",
    ],
  },
];

function MemberDesktopSidebar({ user, isAdmin, onLogout }) {
  const location = useLocation();
  const name = toPascalCaseName(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Member",
  );

  return (
    <aside
      aria-label="Member app navigation"
      className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-surface-container-border bg-white md:flex"
    >
      <Link
        to="/member/home"
        aria-label="Glass member home"
        className="flex h-[76px] items-center gap-2.5 border-0 border-b border-surface-container-border bg-white px-6 text-left no-underline"
      >
        <img src="/Glass.webp" alt="" className="h-8 w-8 object-contain" />
        <span className="text-lg font-semibold text-ink">Glass</span>
        <span className="ml-auto rounded-g-1 bg-brand-tint px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
          Member
        </span>
      </Link>

      <nav aria-label="Member navigation" className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 mt-0 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Your account
        </p>
        <div className="flex flex-col gap-1">
          {DESKTOP_LINKS.map(({ to, label, Icon, match }) => {
            const isActive = match.some((path) =>
              path.endsWith("/")
                ? location.pathname.startsWith(path)
                : location.pathname === path || location.pathname.startsWith(`${path}/`),
            );
            return (
              <NavLink
                key={to}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-g-2 px-3 py-2.5 text-sm no-underline transition-colors ${
                  isActive
                    ? "bg-brand-tint font-semibold text-brand"
                    : "font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.7} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-6 border-t border-surface-container-border pt-4">
            <Link
              to="/dashboard/home"
              className="flex w-full items-center gap-3 rounded-g-2 px-3 py-2.5 text-left text-sm font-medium text-ink-muted no-underline hover:bg-surface-sunken hover:text-ink"
            >
              <LayoutDashboard size={18} strokeWidth={1.7} />
              Admin dashboard
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-surface-container-border p-4">
        <Link
          to="/member/profile"
          className="mb-3 flex w-full items-center gap-3 rounded-g-2 p-2 text-left no-underline hover:bg-surface-sunken"
        >
          <ProfileAvatar user={user} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{name}</span>
            <span className="block truncate text-xs text-ink-faint">{user?.email}</span>
          </span>
        </Link>
        <Button
          variant="tertiary"
          size="sm"
          onClick={onLogout}
          className="justify-start px-3 text-danger hover:bg-danger-tint/40"
        >
          <LogOut size={18} />
          Log out
        </Button>
      </div>
    </aside>
  );
}

export default function MemberAppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const isFocusedFlow =
    location.pathname.startsWith("/member/pay/") ||
    /^\/member\/transactions\/[^/]+$/.test(location.pathname);
  const outletWidth = isFocusedFlow ? "max-w-3xl" : "max-w-6xl";

  async function handleLogout() {
    await logout();
    toastSuccess("Signed out");
    navigate("/member/app-sign-in", { replace: true });
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-surface-bg bg-cover bg-center bg-no-repeat bg-mobile-auth-default md:justify-start">
      <MemberDesktopSidebar user={user} isAdmin={isAdmin} onLogout={handleLogout} />
      <div className="relative min-h-dvh w-full max-w-[390px] md:ml-[260px] md:max-w-none md:flex-1 md:bg-surface-bg">
        <main className="pb-[88px] md:min-h-dvh md:pb-8">
          <div
            className={`member-app-page-content mx-auto w-full px-0 md:px-8 md:py-8 xl:px-10 ${outletWidth}`}
          >
            <Outlet />
          </div>
        </main>

        <InvitePopup />

        <nav
          className="fixed bottom-0 inset-x-0 z-30 bg-[linear-gradient(180deg,rgba(249,249,251,0)_0%,var(--color-surface-bg)_28%)] md:hidden"
          aria-label="Main navigation"
        >
          <div className="mx-auto max-w-[390px] px-3 pb-3">
            <div className="rounded-2xl border border-surface-container-border bg-white shadow-[0_2px_20px_rgba(0,0,0,0.1)]">
              <ul className="flex items-center justify-around px-2 py-2">
                {TABS.map(({ to, label, Icon }) => {
                  const isActive =
                    location.pathname === to ||
                    (to !== "/member/home" && location.pathname.startsWith(to));

                  return (
                    <li key={to} className="flex-1">
                      <NavLink
                        to={to}
                        aria-label={label}
                        aria-current={isActive ? "page" : undefined}
                        className="flex flex-col items-center gap-1 rounded-xl py-1.5 transition-all duration-200"
                      >
                        <span
                          className={`relative flex h-7 w-10 items-center justify-center rounded-xl transition-all duration-200 ${isActive ? "bg-black/7" : ""}`}
                        >
                          <Icon
                            size={18}
                            strokeWidth={isActive ? 2.2 : 1.6}
                            className={`transition-colors duration-200 ${isActive ? "text-ink" : "text-black/35"}`}
                          />
                          {isActive && (
                            <span
                              className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ink"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span
                          className={`select-none text-[10px] leading-none tracking-wide transition-colors duration-200 ${isActive ? "font-semibold text-ink" : "font-normal text-black/35"}`}
                        >
                          {label}
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
              <div className="h-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
