/**
 * Sidebar.jsx — wired to real API
 *
 * Data sources:
 *   GET /api/v1/communities/me  → list of user's communities
 *   useAuth()                   → user, logout
 *
 * URL convention (matches App.jsx routes):
 *   /dashboard/:communitySlug/home
 *   /dashboard/:communitySlug/payments
 *   /dashboard/:communitySlug/members
 *   /dashboard/:communitySlug/settings
 *
 * If there is no communitySlug in the URL (e.g. /dashboard/home — the
 * communities overview page), no community is highlighted and the nav
 * panel shows generic labels.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useInvites } from "../../hooks/useInvites";
import { useRegisterShortcutGroup } from "../../hooks/useKeyboardShortcuts";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  UsersRound,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { useAuth } from "../../store/AuthContext";
import { useCommunities } from "../../hooks/useCommunities";
import { useMyMemberRecord } from "../../hooks/useMyAccount";
import { resolveIsPayingAdmin, isCommunityAdmin } from "../../utils/communityRole";
import { toPascalCaseName } from "../../utils/format";
import { toastSuccess } from "../../utils/toast";
import { MobileOverlay, SidebarLogo, LogoutButton, UserIdentity } from "./SidebarPrimitives";
import PulseImg from "../common/PulseImg";

// ─── Nav items ────────────────────────────────────────────────────────────────
// `path` is the route under /dashboard; "home" maps to the per-community
// admin dashboard ("admin"), which keeps its own URL convention
// (?community=slug — see AdminDashboard.jsx) distinct from the
// /dashboard/home communities-overview page.
// `shortcut` is the second key of a "g <key>" chord (see useKeyboardShortcuts)
// -- picked to be the obvious first letter of each label with no collisions
// within this list.
const NAV = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    segment: "home",
    path: "admin",
    shortcut: "h",
  },
  {
    icon: CreditCard,
    label: "Payments",
    segment: "payments",
    path: "payments",
    shortcut: "p",
  },
  {
    icon: Users,
    label: "Members",
    segment: "members",
    path: "members",
    shortcut: "m",
  },
  {
    // NO `shortcut`, unlike every other item here. "Groups" wants `g`, but `g`
    // is the chord prefix itself -- `g g` technically resolves, but a
    // same-letter chord reads as a mistake and would be the only binding here
    // that does. Adding a binding means picking a new prefix or reworking the
    // scheme for all six items, which is a separate call from shipping Groups.
    icon: UsersRound,
    label: "Groups",
    segment: "groups",
    path: "groups",
  },
  {
    icon: Bell,
    label: "Notifications",
    segment: "notifications",
    path: "notifications",
    shortcut: "n",
  },
  {
    icon: Settings,
    label: "Settings",
    segment: "settings",
    path: "settings",
    shortcut: "s",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Matches the ?community= query-param convention already used by
// AdminDashboard.jsx / CommunitiesHome.jsx — "settings" is genuinely
// account-level (profile/security), so it doesn't need it. Notifications
// used to be exempted here too on the assumption it was also global, but
// it isn't -- each community's Notifications page is meant to show only
// that community's own notifications (the cross-community view lives
// solely in the topbar bell dropdown). Dropping ?community= here made the
// sidebar's own already-resolved active community silently invisible to
// the page it linked to, which fell back to a localStorage snapshot that
// isn't guaranteed to match whatever community is actually on screen —
// reliably reproducing "notifications page shows every community" even
// after Notifications.jsx itself was fixed to respect an active community
// when one is passed to it.
// "admin" has two variants (AdminDashboard.jsx's two exports) depending on
// whether this admin pays dues as a member of their own community — isPaying
// has to be resolved by the caller (see resolveIsPayingAdmin) since it's
// per-community, not derivable from the slug alone.
function communityPath(slug, path, isPaying = false) {
  if (path === "settings") return `/dashboard/${path}`;
  const resolvedPath = path === "admin" && isPaying ? "admin/paying" : path;
  return `/dashboard/${resolvedPath}?community=${slug}`;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { logout, user, isPlatformAdmin } = useAuth();
  const userDisplayName = toPascalCaseName(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "",
  );
  const userInitials =
    user?.firstName || user?.lastName
      ? `${(user?.firstName ?? "")[0] ?? ""}${(user?.lastName ?? "")[0] ?? ""}`.toUpperCase()
      : (user?.email ?? "").slice(0, 2).toUpperCase() || "?";

  const { data: communitiesData, isLoading: loading } = useCommunities();
  // In its own useMemo because `?? []` allocates a fresh array on every render
  // while the query is still loading, and adminCommunities below is memoized
  // on this reference -- an unstable dep there would recompute it each render.
  const communities = useMemo(() => communitiesData?.communities ?? [], [communitiesData]);
  const { unreadCount } = useNotifications();
  const { invites } = useInvites();
  const [loggingOut, setLoggingOut] = useState(false);
  const [memberViewHint, setMemberViewHint] = useState(false);

  // Active route segment: /dashboard/admin → "home", /dashboard/payments →
  // "payments", etc. (matches the flat ?community= convention, not slugs-in-path)
  const pathParts = location.pathname.split("/").filter(Boolean);
  const routeSegment = pathParts[1] ?? "home"; // "home" | "admin" | "payments" | "members" | "settings"
  const activeSegment = routeSegment === "admin" ? "home" : routeSegment;
  const onCommunitiesOverview = location.pathname === "/dashboard/home";

  // Active community: ?community= param, falling back to the last one
  // stashed in localStorage (see useActiveCommunityId.js) — except on the
  // communities overview itself, whose whole purpose is choosing one. The
  // localStorage fallback exists for navigating *between* a community's
  // own pages (Settings doesn't carry ?community= in its URL at all), not
  // for skipping the choice from the one page that's supposed to require it.
  const urlSlug =
    searchParams.get("community") ??
    (onCommunitiesOverview
      ? null
      : (() => {
          try {
            const stored = JSON.parse(localStorage.getItem("glass_community") ?? "{}");
            return stored.slug ?? stored.id ?? null;
          } catch {
            return null;
          }
        })());

  // ?community= may carry either identifier: the other three resolvers of this
  // value -- CommunityAdminGuard, Settings, useNotifications -- all accept a
  // slug *or* a community id, so a UUID that resolves everywhere else used to
  // resolve to nothing here and left the sidebar with no active community
  // (no rail highlight, dead nav links) on a page the rest of the app considered
  // correctly scoped. Same normalization as those three: slug compared as-is,
  // id stringified on both sides so a non-string id can't silently miss.
  const resolvedCommunity = urlSlug
    ? (communities.find((c) => c.slug === urlSlug || String(c.id) === String(urlSlug)) ?? null)
    : null;

  // Computed once and reused by both the community rail and the fallback
  // decision below, instead of re-filtering the same list in each place.
  const adminCommunities = useMemo(() => communities.filter(isCommunityAdmin), [communities]);

  // When neither ?community= nor the localStorage snapshot resolves one, a
  // bare deep link (e.g. Notifications reached from a self-account
  // notification like "Profile image updated", which carries no
  // ?community= at all) would leave every nav link but Home dead -- no
  // community to build a URL against -- so there'd be no way out except the
  // logo/overview button or the notification's own action button.
  //
  // Only the *unambiguous* case is filled in. With exactly one community this
  // admin manages, [0] is order-independent: it can't pick "the wrong one"
  // because there is only one candidate, so using it is a presentation
  // default rather than a guess. With two or more, [0] is whatever the
  // backend happened to order first, which says nothing about what the user
  // wanted -- acting on it would quietly drop a multi-community admin into an
  // arbitrary community. Those users get the honest no-community state
  // instead, which the header and disabled nav links below already render.
  const singleAdminFallback =
    !onCommunitiesOverview && resolvedCommunity === null && adminCommunities.length === 1
      ? adminCommunities[0]
      : null;

  const activeCommunity = resolvedCommunity ?? singleAdminFallback;

  // Whether `activeCommunity` reflects context that was actually *chosen* --
  // an explicit ?community=, or a previously stored selection that still
  // resolves. Only that may be persisted, because glass_community is not a
  // per-component cache: useActiveCommunityId() reads it as the session-wide
  // active community, and CommunityAdminGuard / Notifications / Settings all
  // resolve from it. Persisting a synthesized fallback would therefore spread
  // an unchosen community past this sidebar into every community-scoped
  // surface, which is exactly what the 2+ case above refuses to pick.
  const communityWasChosen = resolvedCommunity !== null;

  // Keeps localStorage's "last active community" snapshot in sync with the
  // chosen community above -- other pages read the same key directly
  // (useActiveCommunityId.js) and would otherwise silently disagree with what
  // this sidebar just highlighted. A bare fallback is deliberately skipped:
  // it must never overwrite a real prior selection (which would be a
  // regression, since the fallback only ever runs when nothing resolved) nor
  // establish one for pages that would then treat it as explicit.
  useEffect(() => {
    if (!activeCommunity || !communityWasChosen) return;
    try {
      const stored = JSON.parse(localStorage.getItem("glass_community") ?? "{}");
      if (stored.slug === activeCommunity.slug) return;
    } catch {
      /* fall through and (re)write it */
    }
    localStorage.setItem("glass_community", JSON.stringify(activeCommunity));
  }, [activeCommunity, communityWasChosen]);

  // Use the cached member record to derive paying status — same data source
  // as Role.jsx, so no extra network call and no race condition.
  const { data: myMemberRecord } = useMyMemberRecord(activeCommunity?.slug ?? null);
  const activeCommunityIsPaying = myMemberRecord?.billingExempt === false;

  // "g h"/"g p"/etc. — mirrors exactly what a click on each nav item does,
  // including staying disabled (no binding at all) when there's no active
  // community to resolve a URL against, same as the button being disabled
  // below. Registered unconditionally (before the isPlatformAdmin early
  // return) since hooks can't run conditionally -- platform admins simply
  // get an empty list, since this stripped rail has no community nav at all.
  const navShortcuts = useMemo(() => {
    if (isPlatformAdmin) return [];
    return NAV.map(({ label, segment, path, shortcut }) => {
      const href = activeCommunity
        ? communityPath(activeCommunity.slug, path, activeCommunityIsPaying)
        : segment === "home"
          ? "/dashboard/home"
          : null;
      if (!href) return null;
      // No `shortcut` means this item deliberately has no binding (Groups --
      // see the note on its NAV entry). Registering `g undefined` would be a
      // dead entry that still shows up in the `?` shortcuts overlay.
      if (!shortcut) return null;
      return {
        keys: `g ${shortcut}`,
        description: `Go to ${label}`,
        handler: () => {
          navigate(href);
          onCloseMobile?.();
        },
      };
    }).filter(Boolean);
  }, [isPlatformAdmin, activeCommunity, activeCommunityIsPaying, navigate, onCloseMobile]);
  useRegisterShortcutGroup(navShortcuts, "Navigation");

  // ── Handle logout ──────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toastSuccess("Signed out");
      navigate("/sign-in", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Platform admin: stripped-down sidebar, no community nav ───────────────
  if (isPlatformAdmin) {
    return (
      <>
        <MobileOverlay mobileOpen={mobileOpen} onClose={onCloseMobile} />
        <div
          className={`fixed md:sticky top-0 left-0 h-dvh z-[60] flex-shrink-0 flex transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Blue rail */}
          <div className="flex-shrink-0 bg-brand flex flex-col items-center pt-3.5 pb-5 w-14">
            <SidebarLogo
              title="Platform Admin"
              onClick={() => {
                navigate("/dashboard/admin-panel");
                onCloseMobile?.();
              }}
            />

            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Platform Admin"
              onClick={() => {
                navigate("/dashboard/admin-panel");
                onCloseMobile?.();
              }}
              title="Platform Admin"
              className="text-white"
            >
              <ShieldCheck size={15} />
            </Button>

            <div className="flex-1" />

            <LogoutButton onClick={handleLogout} loggingOut={loggingOut} />
          </div>

          {/* White panel */}
          <div className="bg-white md:bg-surface-container md:border-r md:border-surface-container-border w-[220px] flex flex-col">
            <div className="py-3.5 px-3 pb-[13px] border-b border-[var(--color-hairline)] min-h-14 flex items-center">
              <div>
                <div className="text-xs font-bold text-brand leading-[1.3]">Platform Admin</div>
                <span className="inline-block mt-[3px] text-[9px] font-bold text-accent-purple bg-[#f5f3ff] rounded-full py-px px-[7px]">
                  Platform Admin
                </span>
              </div>
            </div>

            <nav className="flex-1 py-2.5 px-2">
              {[
                {
                  icon: ShieldCheck,
                  label: "Admin Panel",
                  path: "/dashboard/admin-panel",
                  match: "/dashboard/admin-panel",
                },
                {
                  icon: Bell,
                  label: "Notifications",
                  path: "/dashboard/notifications",
                  match: "/dashboard/notifications",
                },
                {
                  icon: Settings,
                  label: "Settings",
                  path: "/dashboard/settings/account/security",
                  match: "/dashboard/settings",
                },
              ].map(({ icon: Icon, label, path, match }) => {
                const isActive = location.pathname.startsWith(match);
                const badge = label === "Notifications" && unreadCount > 0 ? unreadCount : 0;
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center gap-2 py-2.5 px-2.5 rounded-lg border-none cursor-pointer tracking-normal text-xs whitespace-nowrap mb-1.5 transition-all duration-150 ${
                      isActive
                        ? "bg-brand-tint text-brand font-bold"
                        : "bg-transparent text-ink-muted font-medium hover:bg-surface-sunken"
                    }`}
                  >
                    <Icon size={13} className="flex-shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {badge > 0 && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-danger-bright text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="py-2.5 px-3 border-t border-[var(--color-hairline)] flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,var(--color-accent-purple),var(--color-brand))] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                SA
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold m-0 whitespace-nowrap overflow-hidden text-ellipsis">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileOverlay mobileOpen={mobileOpen} onClose={onCloseMobile} />
      {/* h-dvh, not h-screen -- see DashboardLayout.jsx for why: 100vh on iOS
          Safari sits behind the address bar, so this fixed drawer rendered
          taller than the real visible viewport and cut off Member View /
          the user info strip pinned to its bottom. */}
      <div
        className={`fixed md:sticky top-0 left-0 h-dvh z-[60] flex-shrink-0 flex transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* ── Blue rail ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-brand flex flex-col items-center pt-3.5 pb-5 w-14">
          {/* Logo — goes to communities overview */}
          <SidebarLogo
            title="Your Communities"
            onClick={() => {
              navigate("/dashboard/home");
              onCloseMobile?.();
            }}
          />

          {/* Home (communities overview) -- same active-indicator pattern as
            the community tiles below: a pill riding the rail's outer edge
            beside whichever one is active, not just a restyled tile. */}
          <div className="relative mb-3">
            {onCommunitiesOverview && (
              <span
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-white -left-2.5"
                aria-hidden="true"
              />
            )}
            <button
              onClick={() => {
                navigate("/dashboard/home");
                onCloseMobile?.();
              }}
              title="Your Communities"
              className="w-9 h-9 rounded-lg border-none cursor-pointer flex items-center justify-center transition-all bg-transparent text-white hover:bg-white/15"
            >
              {onCommunitiesOverview ? (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 18,
                    backgroundColor: "white",
                    WebkitMaskImage: "url(/home-solid.webp)",
                    maskImage: "url(/home-solid.webp)",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
              ) : (
                <img src="/home-outline.webp" alt="" className="w-4 h-[18px] object-contain" />
              )}
            </button>
          </div>

          <div className="w-5 h-px bg-white/20 mb-3" />

          {/* Community avatar list */}
          <div className="flex flex-col gap-2 items-center flex-1 overflow-y-auto w-full px-2">
            {/* data-tour lives on this inner wrapper, not the scrollable outer
              div -- the outer div is flex-1 so it stretches to fill whatever
              space is left in the rail, which made the tour's spotlight
              highlight that entire empty area instead of just the avatar
              list. This wrapper shrinks to fit its actual content. */}
            <div data-tour="community-switcher" className="flex flex-col gap-2 items-center w-full">
              {loading ? (
                // Skeleton
                [0, 1].map((i) => (
                  <div key={i} className="w-9 h-9 rounded-sm bg-white/10 animate-pulse" />
                ))
              ) : adminCommunities.length === 0 ? (
                <div className="w-9 h-9 rounded-sm bg-white/10 flex items-center justify-center">
                  <span className="text-white/40 text-[10px]">—</span>
                </div>
              ) : (
                // Role-based, not ownership-based: promoted ADMIN/MANAGER
                // members administer communities they don't own and need them
                // reachable from this rail too.
                adminCommunities.map((c) => {
                  // Same id-or-slug match as the resolution above, so the rail
                  // still highlights the right tile when ?community= carries a
                  // community id rather than a slug.
                  const isActive = c.slug === urlSlug || String(c.id) === String(urlSlug);
                  const initials = getInitials(c.name);
                  return (
                    <div key={c.id} className="relative flex-shrink-0">
                      {/* Active indicator — a pill riding the rail's outer edge,
                      not a change to the tile itself. This is what actually
                      shows which community is selected; it shifts to sit
                      beside whichever tile is active instead of restyling
                      the tile (a restyled tile is what "ruins" a logo that
                      has its own white/colored background). */}
                      {isActive && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-white -left-2.5"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        onClick={async () => {
                          localStorage.setItem("glass_community", JSON.stringify(c));
                          const isPaying = await resolveIsPayingAdmin(c.slug);
                          navigate(communityPath(c.slug, "admin", isPaying));
                          onCloseMobile?.();
                        }}
                        title={c.name}
                        className="w-9 h-9 rounded-sm border-none cursor-pointer flex items-center justify-center font-bold text-[11px] transition-all select-none overflow-hidden flex-shrink-0 bg-white"
                      >
                        {/* The old handler set display:none on a failed image,
                            which left an empty white tile in the rail -- the
                            initials were only rendered when there was no URL.
                            PulseImg renders them for a failed load too. */}
                        <PulseImg
                          src={c.logo?.url}
                          alt={c.name}
                          className="w-full h-full"
                          skeletonClassName="bg-black/5"
                          fallback={<span className="text-brand">{initials || "?"}</span>}
                        />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Platform-admin shortcut */}
          {isPlatformAdmin && (
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Platform Admin"
              onClick={() => {
                navigate("/dashboard/admin-panel");
                onCloseMobile?.();
              }}
              title="Platform Admin"
              className="mt-2 text-white"
            >
              <ShieldCheck size={14} />
            </Button>
          )}

          {/* Logout button pinned to bottom of rail */}
          <div className="mt-2">
            <LogoutButton onClick={handleLogout} loggingOut={loggingOut} />
          </div>
        </div>

        {/* ── White nav panel ────────────────────────────────────────────────── */}
        {!onCommunitiesOverview && (
          <div className="bg-white md:bg-surface-container w-[220px] border-r border-surface-container-border flex flex-col overflow-hidden transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
            {/* Org header */}
            <div className="py-3.5 px-3 pb-[13px] border-b border-[var(--color-hairline)] flex items-center justify-between gap-2 min-h-14">
              {activeCommunity ? (
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <div className="text-xs font-medium text-black leading-[1.3] break-words">
                    {activeCommunity.name}
                  </div>
                  {/* The Figma inspector's literal 69x32/text-sm reading was
                  measured on the badge in isolation -- applied verbatim next
                  to this sidebar's much smaller 12px community name, it read
                  as oversized and out of place rather than matching Figma
                  "by eye". Scaled back down; kept the radius-4px/#FFF1D6 fix
                  from that same spec, since neither of those was in question. */}
                  <span
                    className={`flex-shrink-0 text-[10px] font-bold rounded py-0.5 px-2 ${isCommunityAdmin(activeCommunity) ? "text-[#e85d04] bg-[#FFF1D6]" : "text-success-strong bg-success-wash"}`}
                  >
                    {activeCommunity.owned
                      ? "Owner"
                      : isCommunityAdmin(activeCommunity)
                        ? "Admin"
                        : "Member"}
                  </span>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-black leading-[1.3]">Your Communities</div>
                </div>
              )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 py-2.5 px-2 overflow-y-auto">
              {/* data-tour lives on this inner wrapper, not the scrollable <nav>
              itself -- <nav> is flex-1 so it stretches to fill whatever
              space is left in the sidebar, which made the tour's spotlight
              highlight that entire empty area instead of just the nav
              items. This wrapper shrinks to fit its actual content. */}
              <div data-tour="sidebar-nav">
                {NAV.map(({ icon: Icon, label, segment, path }) => {
                  const isActive = activeSegment === segment;
                  // Every nav item except "Dashboard" (which points at the
                  // communities overview when none is selected) requires an
                  // active community — matches the blue-rail community picker
                  // being the only way to get into a community's admin area.
                  const href = activeCommunity
                    ? communityPath(activeCommunity.slug, path, activeCommunityIsPaying)
                    : segment === "home"
                      ? "/dashboard/home"
                      : null;
                  const isDisabled = !href;
                  const badge = segment === "notifications" && unreadCount > 0 ? unreadCount : 0;

                  return (
                    <button
                      key={segment}
                      onClick={() => {
                        if (href) {
                          navigate(href);
                          onCloseMobile?.();
                        }
                      }}
                      disabled={isDisabled}
                      // Icon/label are left-anchored regardless of state, so
                      // varying the button's own width doesn't shift or misalign
                      // anything -- only the background's right edge moves.
                      // Simpler than an inner wrapper element, and avoids the
                      // negative-margin trap from the last attempt at this. Per
                      // direct visual feedback against the rendered Figma design:
                      // roughly 70% of the row when active, not edge to edge (an
                      // earlier "Fill" reading of an isolated inspector panel) and
                      // not content-hugging either (an even earlier attempt).
                      className={`flex items-center gap-3.5 p-2.5 rounded tracking-normal text-xs mb-1.5 transition-all duration-150 whitespace-nowrap font-medium border-none ${isActive ? "w-[70%]" : "w-full"} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"} ${
                        isDisabled
                          ? "bg-transparent text-ink-faint"
                          : isActive
                            ? "bg-brand-100 text-brand"
                            : "bg-transparent text-ink-muted hover:bg-surface-sunken"
                      }`}
                    >
                      <Icon size={13} className="flex-shrink-0" />
                      <span className="text-left">{label}</span>
                      {badge > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-danger-bright text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Member View switch */}
            <div className="px-2 pb-2 relative">
              <div className="h-px bg-[var(--color-hairline)] mb-2" />
              <button
                onClick={() => {
                  // If the admin is also a member of the community they're
                  // currently viewing, that's the "own Member View" they'd
                  // expect this button to open — not some unrelated community
                  // they happen to belong to. Only fall back to searching for
                  // any other membership (or the invites hint) when there's no
                  // such same-community membership to switch into.
                  if (activeCommunity && myMemberRecord) {
                    try {
                      localStorage.setItem(
                        "glass_member_community",
                        JSON.stringify({
                          id: activeCommunity.id,
                          slug: activeCommunity.slug,
                          name: activeCommunity.name,
                        }),
                      );
                    } catch {
                      /* ignore */
                    }
                    navigate("/member/home");
                    onCloseMobile?.();
                    return;
                  }
                  const memberCommunity = communities.find((c) => !c.owned);
                  if (memberCommunity) {
                    // Set the active member community so Home loads the right one
                    try {
                      localStorage.setItem(
                        "glass_member_community",
                        JSON.stringify({
                          id: memberCommunity.id,
                          slug: memberCommunity.slug,
                          name: memberCommunity.name,
                        }),
                      );
                    } catch {
                      /* ignore */
                    }
                    navigate("/member/home");
                    onCloseMobile?.();
                    return;
                  }
                  const pendingInvites = invites.filter(
                    (i) => (i.status ?? "").toUpperCase() === "PENDING",
                  );
                  if (pendingInvites.length > 0) {
                    navigate("/member/invites");
                    onCloseMobile?.();
                    return;
                  }
                  // Nothing actionable — show hint
                  setMemberViewHint(true);
                  setTimeout(() => setMemberViewHint(false), 3500);
                }}
                className="w-full flex items-center gap-2 py-2.5 px-2.5 rounded-lg border-none cursor-pointer bg-transparent text-ink-muted font-medium text-xs transition-all duration-150 whitespace-nowrap hover:bg-surface-sunken hover:text-brand"
              >
                <Smartphone size={13} className="flex-shrink-0" />
                <span className="flex-1 text-left">Member View</span>
              </button>

              {memberViewHint && (
                <div className="absolute left-2 right-2 bg-[#1f2937] text-surface-sunken text-[11px] leading-relaxed py-2 px-2.5 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-10 pointer-events-none [bottom:calc(100%-4px)]">
                  Ask another admin to invite you to their community, then come back here.
                  <div className="absolute -bottom-[5px] left-[18px] w-2.5 h-2.5 bg-[#1f2937] rotate-45 rounded-sm" />
                </div>
              )}
            </div>

            {/* Bottom — user info strip */}
            <UserIdentity user={user} initials={userInitials} displayName={userDisplayName} />
          </div>
        )}
      </div>
    </>
  );
}
