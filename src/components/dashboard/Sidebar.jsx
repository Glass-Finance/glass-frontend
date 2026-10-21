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

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "../ui/Button";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useInvites } from "../../hooks/useInvites";
import { useRegisterShortcutGroup } from "../../hooks/useKeyboardShortcuts";
import {
  LayoutDashboard,
  CreditCard,
  BookOpen,
  Users,
  UsersRound,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  Smartphone,
  X,
  Check,
  ChevronDown,
  Home,
  HelpCircle,
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
import { Skeleton } from "../common/SkeletonUI";

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
  { icon: BookOpen, label: "Records", segment: "records", path: "records" },
  {
    icon: Users,
    label: "Members",
    segment: "members",
    path: "members",
    shortcut: "m",
  },
  {
    // NO `shortcut`, unlike most items here. "Groups" wants `g`, but `g`
    // is the chord prefix itself -- `g g` technically resolves, but a
    // same-letter chord reads as a mistake and would be the only binding here
    // that does. "Records" also has none, for the same reason. Adding a
    // binding means picking a new prefix or reworking the scheme for every
    // item, which is a separate call from shipping either page.
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

// Help stays in the mobile drawer because the phone topbar prioritizes current
// page/community context; it supplements the non-modal first-run tour prompt.
// Deliberately not a Figma row: it keeps an existing feature reachable.
function MobileTourRow({ onOpenTour, onDismiss }) {
  if (!onOpenTour) return null;
  return (
    <div className="px-2 pb-2 md:hidden">
      <button
        onClick={() => {
          onOpenTour();
          onDismiss?.();
        }}
        className="w-full flex items-center gap-2 p-2.5 rounded-g-1 tracking-normal text-sm border-none bg-transparent cursor-pointer text-ink-muted hover:bg-surface-sunken"
      >
        <HelpCircle size={20} className="flex-shrink-0" />
        <span className="text-left">Take the tour</span>
      </button>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar({ mobileOpen, onCloseMobile, onOpenTour }) {
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
  // Mobile-only community switcher. The blue rail below carries the switcher
  // on desktop, but Figma's mobile drawer (node 326:18701) has no rail at all
  // -- its community row carries a dropdown chevron (node 393:20237) that
  // stands in for the rail's avatar tiles. Without this, hiding the rail on
  // mobile would strand every community but the active one.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Every dismissal path -- nav click, scrim, the close ✕, a completed
  // switch, a keyboard shortcut -- goes through here, so the mobile switcher
  // never outlives the drawer it belongs to. Memoised only because it feeds
  // navShortcuts' dep array; the rest of the file doesn't care.
  const closeDrawer = useCallback(() => {
    setSwitcherOpen(false);
    onCloseMobile?.();
  }, [onCloseMobile]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: mobileOpen }));
    return () => {
      if (mobileOpen) {
        window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: false }));
      }
    };
  }, [mobileOpen]);

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
          closeDrawer();
        },
      };
    }).filter(Boolean);
  }, [isPlatformAdmin, activeCommunity, activeCommunityIsPaying, navigate, closeDrawer]);
  useRegisterShortcutGroup(navShortcuts, "Navigation");

  // ── Switch the active community ────────────────────────────────────────────
  // One handler for both switchers: the desktop rail's avatar tiles and the
  // mobile drawer's chevron dropdown. Persisting first is what the rest of the
  // app reads back through useActiveCommunityId(), so it has to happen before
  // the navigation that the new community's pages will scope themselves to.
  const switchToCommunity = async (c) => {
    localStorage.setItem("glass_community", JSON.stringify(c));
    const isPaying = await resolveIsPayingAdmin(c.slug);
    navigate(communityPath(c.slug, "admin", isPaying));
    closeDrawer();
  };

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
        <MobileOverlay mobileOpen={mobileOpen} onClose={closeDrawer} />
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
                closeDrawer();
              }}
            />

            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Platform Admin"
              onClick={() => {
                navigate("/dashboard/admin-panel");
                closeDrawer();
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
                      closeDrawer();
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

            <MobileTourRow onOpenTour={onOpenTour} onDismiss={closeDrawer} />

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
      <MobileOverlay mobileOpen={mobileOpen} onClose={closeDrawer} />
      {/* h-dvh, not h-screen -- see DashboardLayout.jsx for why: 100vh on iOS
          Safari sits behind the address bar, so this fixed drawer rendered
          taller than the real visible viewport and cut off Member View /
          the user info strip pinned to its bottom. */}
      <div
        className={`fixed md:sticky top-0 left-0 h-dvh z-[60] w-[min(320px,84vw)] md:w-auto flex-shrink-0 flex transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* ── Blue rail ───────────────────────────────────────────────────────
            Desktop only. Figma's mobile drawer (node 326:18701) is a single
            panel with no rail: its nav pills start at x=18, which the rail's
            56px would swallow whole, and the community row's own
            chevron (node 393:20237) is what carries the switcher down here.
            `hidden md:flex`, never `flex hidden` -- both set display, and
            Tailwind v4 gives same-property utilities no guaranteed order. */}
        <div className="hidden md:flex flex-shrink-0 bg-brand flex-col items-center pt-3.5 pb-5 w-14">
          {/* Logo — goes to communities overview */}
          <SidebarLogo
            title="Your Communities"
            onClick={() => {
              navigate("/dashboard/home");
              closeDrawer();
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
                closeDrawer();
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
            <div
              data-tour="community-switcher"
              aria-busy={loading || undefined}
              className="flex flex-col gap-2 items-center w-full"
            >
              {loading ? (
                // Skeleton. Translucent white rather than the neutral
                // SkeletonUI grey, because this rail is dark -- hence the
                // explicit `tone`. Decorative, so the wrapper carries
                // aria-busy and Skeleton sets aria-hidden on itself.
                <div className="flex flex-col gap-2 items-center w-full">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} tone="bg-white/10" className="w-9 h-9 rounded-sm" />
                  ))}
                </div>
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
                        onClick={() => switchToCommunity(c)}
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
                closeDrawer();
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
          <div className="bg-white md:bg-surface-container md:w-[220px] w-full md:border-r md:border-surface-container-border flex flex-col overflow-hidden transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]">
            {/* Org header
            Mobile geometry comes straight from Figma's drawer (node
            326:18669): a 44px row -- 6px vertical padding against a 32px
            community logo -- with 18px insets, closed by a full-bleed
            hairline at y=92. Desktop keeps py-3.5/min-h-14/px-3 exactly as
            they were; only the paddings carry a md: variant here. */}
            <div className="relative py-1.5 md:py-3.5 md:pb-[13px] px-4 md:px-3 border-b border-[var(--color-hairline)] flex items-center justify-between gap-2 min-h-11 md:min-h-14">
              {activeCommunity ? (
                <div className="min-w-0 flex-1 flex items-start gap-2 md:items-center">
                  {/* Community logo -- 32x32, radius 4 (node 326:18711). The
                  desktop panel never had one, so this stays mobile-only. */}
                  <span className="md:hidden flex-shrink-0 w-8 h-8 rounded-g-1 overflow-hidden bg-surface-sunken">
                    <PulseImg
                      src={activeCommunity.logo?.url}
                      alt=""
                      className="w-full h-full object-cover"
                      skeletonClassName="bg-black/5"
                      fallback={
                        <span className="w-full h-full flex items-center justify-center text-brand text-xs font-bold">
                          {getInitials(activeCommunity.name)}
                        </span>
                      }
                    />
                  </span>
                  {/* Figma's mobile drawer reads the community name at 14/500
                  and the role badge at 12/500 (nodes 326:18712 / I354:19439).
                  The desktop rail keeps the original 12px -- the comment below
                  records why that was scaled back from the inspector's literal
                  reading. */}
                  <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-2">
                    <div className="max-w-full text-sm md:text-xs font-medium text-black leading-[1.3] break-words">
                      {activeCommunity.name}
                    </div>
                    <div className="flex items-center gap-1 md:contents">
                      {/* Keep the role and community switcher below the name
                          on phones so neither control steals heading width. */}
                      <span
                        className={`flex-shrink-0 text-xs md:text-[10px] font-bold rounded-g-1 py-0.5 px-2 ${isCommunityAdmin(activeCommunity) ? "text-[#e85d04] bg-[#FFF1D6]" : "text-success-strong bg-success-wash"}`}
                      >
                        {activeCommunity.owned
                          ? "Owner"
                          : isCommunityAdmin(activeCommunity)
                            ? "Admin"
                            : "Member"}
                      </span>
                      <Button
                        variant="tertiary"
                        size="icon-sm"
                        aria-label="Switch community"
                        title="Switch community"
                        aria-expanded={switcherOpen}
                        onClick={() => setSwitcherOpen((v) => !v)}
                        className="flex-shrink-0 md:hidden text-ink/60"
                      >
                        <ChevronDown size={18} />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="text-sm md:text-xs font-bold text-black leading-[1.3]">
                    Your Communities
                  </div>
                </div>
              )}
              {/* Figma's mobile drawer carries its own close affordance (node
              326:18673) because the scrim alone is a small target. Desktop
              has no drawer to close, so the control is mobile-only. */}
              <Button
                variant="tertiary"
                size="icon-sm"
                aria-label="Close menu"
                title="Close menu"
                onClick={closeDrawer}
                className="flex-shrink-0 md:hidden text-ink/60"
              >
                <X size={16} />
              </Button>

              {/* Mobile community switcher. Anchored inside the header rather
              than the panel so the panel's overflow-hidden can't clip it, and
              z-20 so the nav below doesn't paint over it. */}
              {switcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[59] md:hidden"
                    aria-hidden="true"
                    onClick={() => setSwitcherOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label="Communities"
                    className="absolute left-2 right-2 top-full z-20 mt-1 rounded-g-2 border border-surface-container-border bg-white p-1.5 shadow-lg md:hidden"
                  >
                    <button
                      onClick={() => {
                        setSwitcherOpen(false);
                        navigate("/dashboard/home");
                        closeDrawer();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-g-1 border-none bg-transparent cursor-pointer text-sm font-medium text-black text-left hover:bg-surface-sunken"
                    >
                      <Home size={16} className="flex-shrink-0" />
                      Your Communities
                    </button>
                    <div className="h-px bg-[var(--color-hairline)] my-1" />
                    {adminCommunities.length === 0 ? (
                      <div className="px-2 py-2 text-sm text-ink-faint">No communities yet</div>
                    ) : (
                      adminCommunities.map((c) => {
                        const isActive = c.slug === urlSlug || String(c.id) === String(urlSlug);
                        return (
                          <button
                            key={c.id}
                            role="menuitem"
                            onClick={() => {
                              setSwitcherOpen(false);
                              switchToCommunity(c);
                            }}
                            title={c.name}
                            className={`w-full flex items-center gap-2 p-2 rounded-g-1 border-none cursor-pointer text-sm text-left ${isActive ? "bg-brand-tint text-brand font-medium" : "bg-transparent text-black hover:bg-surface-sunken"}`}
                          >
                            <span className="flex-shrink-0 w-6 h-6 rounded-g-1 overflow-hidden bg-surface-sunken">
                              <PulseImg
                                src={c.logo?.url}
                                alt=""
                                className="w-full h-full object-cover"
                                skeletonClassName="bg-black/5"
                                fallback={
                                  <span className="w-full h-full flex items-center justify-center text-brand text-[10px] font-bold">
                                    {getInitials(c.name)}
                                  </span>
                                }
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{c.name}</span>
                            {isActive && <Check size={15} className="flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
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
                          closeDrawer();
                        }
                      }}
                      disabled={isDisabled}
                      // Icon/label are left-anchored regardless of state, so
                      // varying the button's own width doesn't shift or misalign
                      // anything -- only the background's right edge moves.
                      // Simpler than an inner wrapper element, and avoids the
                      // negative-margin trap from the last attempt at this. Per
                      // direct visual feedback against the rendered Figma design:
                      // full-width rows keep the active state aligned with
                      // every other destination in the narrower mobile drawer.
                      //
                      // Mobile reads Figma's drawer pills (node 326:18652): r4,
                      // an 8px icon/label gap, a 14/500 label and a 20px glyph,
                      // sitting on a 48px pitch (mb-3 against Figma's 24px pill).
                      // The row keeps p-2.5 rather than Figma's 2px so the tap
                      // target stays ~40px. Desktop is untouched: 14px gap,
                      // 13px glyph, 12/500.
                      className={`flex items-center gap-2 md:gap-3.5 p-2.5 rounded-g-1 tracking-normal text-sm md:text-xs mb-2 md:mb-1.5 transition-all duration-150 whitespace-nowrap font-medium border-none w-full ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"} ${
                        isDisabled
                          ? "bg-transparent text-ink-faint"
                          : isActive
                            ? "bg-brand-100 text-brand"
                            : "bg-transparent text-ink-muted hover:bg-surface-sunken"
                      }`}
                    >
                      {/* lucide's size prop writes width/height *attributes*,
                          which every CSS declaration outranks -- so one glyph
                          scales with the breakpoint instead of needing two. */}
                      <Icon size={13} className="flex-shrink-0 w-5 h-5 md:w-[13px] md:h-[13px]" />
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

            <MobileTourRow onOpenTour={onOpenTour} onDismiss={closeDrawer} />

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
                    closeDrawer();
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
                    closeDrawer();
                    return;
                  }
                  const pendingInvites = invites.filter(
                    (i) => (i.status ?? "").toUpperCase() === "PENDING",
                  );
                  if (pendingInvites.length > 0) {
                    navigate("/member/invites");
                    closeDrawer();
                    return;
                  }
                  // Nothing actionable — show hint
                  setMemberViewHint(true);
                  setTimeout(() => setMemberViewHint(false), 3500);
                }}
                className="w-full flex items-center gap-2 md:gap-2.5 py-2.5 px-2.5 rounded-g-1 border-none cursor-pointer bg-transparent text-ink-muted font-medium text-sm md:text-xs transition-all duration-150 whitespace-nowrap hover:bg-surface-sunken hover:text-brand"
              >
                <Smartphone size={13} className="flex-shrink-0 w-5 h-5 md:w-[13px] md:h-[13px]" />
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

            {/* Figma's mobile drawer ends on a labelled red Log Out row
            (node 326:18675: #db0000, 14/500, no stroke). The desktop rail has
            always been icon-only here and the topbar account block is a
            profile link, not a sign-out entry, so this row exists only under
            the drawer. Tertiary with a danger label is a documented §2.1 label
            colour, not a bespoke button. */}
            <div className="px-2 pb-3 md:hidden">
              <Button
                variant="tertiary"
                size="sm"
                fullWidth={false}
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-danger"
                title="Log out"
              >
                <LogOut size={18} className="flex-shrink-0" />
                Log Out
              </Button>
            </div>
          </div>
        )}
        {onCommunitiesOverview && mobileOpen && (
          <div className="bg-white w-full md:hidden flex flex-col overflow-hidden">
            <div className="relative py-1.5 px-4 border-b border-[var(--color-hairline)] flex items-center justify-between gap-2 min-h-11">
              <h2 className="min-w-0 flex-1 m-0 text-sm font-bold text-black leading-[1.3]">
                Your Communities
              </h2>
              <Button
                variant="tertiary"
                size="icon-sm"
                aria-label="Close menu"
                title="Close menu"
                onClick={closeDrawer}
                className="flex-shrink-0 text-ink/60"
              >
                <X size={16} />
              </Button>
            </div>
            <nav
              aria-label="Your communities"
              aria-busy={loading || undefined}
              className="flex-1 py-2.5 px-2 overflow-y-auto"
            >
              {loading ? (
                <div className="space-y-2 p-2" aria-label="Loading communities">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-g-1" />
                  ))}
                </div>
              ) : adminCommunities.length === 0 ? (
                <p className="px-2 py-3 text-sm text-ink-faint">No communities to manage yet.</p>
              ) : (
                <div className="space-y-1">
                  {adminCommunities.map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => switchToCommunity(community)}
                      title={community.name}
                      className="w-full flex items-center gap-3 p-2.5 rounded-g-1 border-none cursor-pointer bg-transparent text-left text-ink-muted hover:bg-surface-sunken"
                    >
                      <span
                        aria-hidden="true"
                        className="flex-shrink-0 w-9 h-9 rounded-g-1 overflow-hidden bg-surface-sunken"
                      >
                        <PulseImg
                          src={community.logo?.url}
                          alt=""
                          className="w-full h-full object-cover"
                          skeletonClassName="bg-black/5"
                          fallback={
                            <span className="w-full h-full flex items-center justify-center text-brand text-xs font-bold">
                              {getInitials(community.name)}
                            </span>
                          }
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {community.name}
                      </span>
                      <span className="flex-shrink-0 text-xs text-ink-faint">
                        {community.owned ? "Owner" : "Admin"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
