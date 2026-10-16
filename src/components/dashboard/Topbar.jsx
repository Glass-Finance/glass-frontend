/**
 * Topbar.jsx
 * Wired to real auth + notifications.
 *
 * Reads:  useAuth() → user, logout
 *         useNotifications() → GET /api/v1/notifications, GET .../unread-count
 * Actions: Bell → opens notification dropdown panel
 *          User avatar → profile menu (Settings / Log out)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { MobileBackButton } from "../ui/MobileBackButton";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Loader2,
  Menu,
  HelpCircle,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { useAllNotifications } from "../../hooks/useNotifications";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useCommunities } from "../../hooks/useCommunities";
import { searchCommunity } from "../../api/communities";
import NotificationsPanel from "./NotificationsPanel";
import { formatNaira, toPascalCaseName } from "../../utils/format";
import { useClickOutside } from "../../hooks/useClickOutside";
import PulseImg from "../common/PulseImg";
import { Skeleton } from "../common/SkeletonUI";
import { getInitials } from "../../utils/getInitials";
import { resolveIsPayingAdmin, isCommunityAdmin } from "../../utils/communityRole";

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Formats a hydrated user only. The pre-hydration case (`user` is undefined
// until AuthContext's GET /user/me resolves) is handled at the render site
// with placeholder bars -- this used to return the literal string "Loading..."
// and paint that into the header as if it were the member's name. getInitials
// already handles the same gap by design ("?" from the email), so the two
// halves of the account menu no longer disagree about what "no user yet" means.
function getDisplayName(user) {
  if (user?.firstName) {
    // Pascal-cased: this is the signed-in member's own name, and whatever
    // they typed at registration isn't guaranteed to be capitalised.
    return toPascalCaseName(`${user.firstName} ${user.lastName ?? ""}`.trim());
  }
  return user?.email ?? "";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Topbar({
  searchPlaceholder = "Search members, payments, receipts...",
  // Communities Home lists every community the user belongs to rather than
  // one active one -- the member/transaction/receipt search below only
  // knows how to search inside a single community (useActiveCommunityId's
  // stale "last community you clicked into" fallback), which would silently
  // search the wrong thing here. Swaps in a name search over the already-
  // loaded community list instead, matching what this page actually shows.
  isCommunitiesHome = false,
  onMenuClick,
  onOpenTour,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const communityId = useActiveCommunityId();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Panel uses all-community notifications so the dropdown is universal
  const { notifications, isLoading, unreadCount, markRead, markAllRead, clearAll, isClearingAll } =
    useAllNotifications();

  // Build a communityId/slug → community lookup for the panel cards
  const { data: communitiesData } = useCommunities();
  const communityMap = useMemo(() => {
    const map = new Map();
    for (const c of communitiesData?.communities ?? []) {
      if (c.id) map.set(c.id, c);
      if (c.slug) map.set(c.slug, c);
    }
    return map;
  }, [communitiesData]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);

  const initials = getInitials(user);
  const displayName = getDisplayName(user);
  const email = user?.email ?? "";

  // Close the dropdown on outside click
  useClickOutside(panelRef, () => setPanelOpen(false), panelOpen);
  useClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/sign-in", { replace: true });
    } finally {
      setLoggingOut(false);
      setUserMenuOpen(false);
    }
  }

  // ── Search — GET /communities/{id}/search, debounced (backend requires
  // 2+ chars and returns a capped top-10 preview per category). ───────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useClickOutside(searchRef, () => setSearchOpen(false), searchOpen);

  useEffect(() => {
    // Communities Home uses the client-side community-name filter below
    // instead -- skip the single-community API search entirely so it
    // doesn't fire against whatever community happened to be cached.
    if (isCommunitiesHome) return;
    const q = query.trim();
    if (!communityId || q.length < 2) {
      // Reset branch of the same debounced-search effect below, not a
      // derived-during-render value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await searchCommunity(communityId, { search: q, pageSize: 5 });
        setResults(data?.data ?? null);
        setSearchOpen(true);
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, communityId, isCommunitiesHome]);

  function goToResult(path) {
    setSearchOpen(false);
    setQuery("");
    navigate(path);
  }

  const searchMembers = results?.members?.content ?? [];
  const searchTransactions = results?.transactions?.content ?? [];
  const searchPaymentLinks = results?.paymentLinks?.content ?? [];
  const searchSettlements = results?.settlements?.content ?? [];
  const hasSearchResults =
    searchMembers.length ||
    searchTransactions.length ||
    searchPaymentLinks.length ||
    searchSettlements.length;

  // ── Communities Home: filter the already-loaded community list by name,
  // no API call needed. Query open state is driven the same way as the API
  // search (2+ chars) for a consistent feel, just synchronous. ──────────────
  const matchedCommunities = useMemo(() => {
    if (!isCommunitiesHome) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const allCommunities = communitiesData?.communities ?? [];
    return allCommunities.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [isCommunitiesHome, communitiesData, query]);

  useEffect(() => {
    if (!isCommunitiesHome) return;
    // Mirrors the API-search effect's own setSearchOpen(true) on a match --
    // genuinely reacting to the query changing, not a derived render value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchOpen(query.trim().length >= 2);
  }, [isCommunitiesHome, query]);

  const hasCommunityResults = matchedCommunities.length > 0;

  // Same role-based routing as CommunitiesHome's own community tiles
  // (handleCommunityClick) -- a member (not admin/owner) goes to the member
  // app, not the dashboard.
  async function goToCommunity(community) {
    setSearchOpen(false);
    setQuery("");
    if (!isCommunityAdmin(community)) {
      try {
        localStorage.setItem(
          "glass_member_community",
          JSON.stringify({ id: community.id, slug: community.slug, name: community.name }),
        );
      } catch {
        /* ignore */
      }
      navigate("/member/home");
      return;
    }
    const id = community.slug ?? community.id;
    try {
      localStorage.setItem("glass_community", JSON.stringify(community));
    } catch {
      /* ignore */
    }
    const isPaying = await resolveIsPayingAdmin(id);
    navigate(`/dashboard/${isPaying ? "admin/paying" : "admin"}?community=${id}`);
  }

  return (
    // 48px below md, 56px from md up. Figma's mobile topbar (node 352:19421)
    // is exactly 48 tall; the desktop header stays at the shipped h-14.
    <header className="h-12 md:h-14 bg-surface-container border-b border-surface-container-border flex items-center gap-6 px-4 md:px-8 sticky top-0 z-50 flex-shrink-0">
      {/* Hamburger — mobile only (sidebar is off-canvas below md) */}
      <Button
        variant="tertiary"
        size="icon-md"
        data-tour="mobile-menu-button"
        onClick={onMenuClick}
        className="flex-shrink-0 md:hidden"
        aria-label="Open menu"
      >
        <Menu size={19} />
      </Button>

      {/* Glass wordmark — mobile only, centred. Figma's mobile topbar is
      burger · mark+wordmark · round bell with the brand block sitting in the
      middle; the desktop header carries no brand of its own because the rail
      already does. Same 28px mark + text pairing as memberApp/SideDrawer. */}
      <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
        <button
          type="button"
          onClick={() => navigate("/dashboard/home")}
          aria-label="Glass — your communities"
          className="flex items-center gap-1 p-0 bg-transparent border-none cursor-pointer"
        >
          <img src="/Glass.webp" alt="" className="w-7 h-7 object-contain block" />
          <span className="text-base font-normal text-ink">Glass</span>
        </button>
      </div>

      {/* Search */}
      <div
        data-tour="topbar-search"
        className="relative flex-1 max-w-[420px] hidden md:block"
        ref={searchRef}
      >
        <div className="flex items-center gap-2 bg-gray-100 rounded-md px-3.5 py-2.5 border border-transparent focus-within:border-[#002FA7] transition-colors">
          {searching ? (
            <Loader2 size={13} className="text-gray-400 flex-shrink-0 animate-spin" />
          ) : (
            <Search size={13} className="text-gray-400 flex-shrink-0" />
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results || isCommunitiesHome) setSearchOpen(true);
            }}
            placeholder={isCommunitiesHome ? "Search your communities..." : searchPlaceholder}
            className="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 placeholder-gray-400"
          />
        </div>

        {searchOpen && query.trim().length >= 2 && isCommunitiesHome && (
          <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl border border-surface-container-border shadow-lg z-50 max-h-[420px] overflow-y-auto">
            {!hasCommunityResults ? (
              <p className="text-xs text-gray-400 px-4 py-4">
                No communities match "{query.trim()}"
              </p>
            ) : (
              <div className="py-2">
                <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Communities
                </p>
                {matchedCommunities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => goToCommunity(c)}
                    className="w-full flex items-center justify-between gap-2.5 px-4 py-2 hover:bg-gray-50 text-left bg-transparent border-none cursor-pointer"
                  >
                    <span className="text-xs font-medium text-gray-900 truncate">{c.name}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {c.owned ? "Owner" : isCommunityAdmin(c) ? "Admin" : "Member"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {searchOpen && query.trim().length >= 2 && !isCommunitiesHome && (
          <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl border border-surface-container-border shadow-lg z-50 max-h-[420px] overflow-y-auto">
            {!hasSearchResults ? (
              <p className="text-xs text-gray-400 px-4 py-4">No results for "{query.trim()}"</p>
            ) : (
              <>
                {searchMembers.length > 0 && (
                  <div className="py-2">
                    <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Members
                    </p>
                    {searchMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          goToResult(`/dashboard/members/${m.id}?community=${communityId}`)
                        }
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-2 hover:bg-gray-50 text-left bg-transparent border-none cursor-pointer"
                      >
                        <span className="text-xs font-medium text-gray-900">
                          {toPascalCaseName(`${m.firstName ?? ""} ${m.lastName ?? ""}`.trim())}
                        </span>
                        <span className="text-[11px] text-gray-400">{m.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchTransactions.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Transactions
                    </p>
                    {searchTransactions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => goToResult(`/dashboard/payments?community=${communityId}`)}
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-2 hover:bg-gray-50 text-left bg-transparent border-none cursor-pointer"
                      >
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {t.memberName ?? t.paymentLinkTitle ?? t.internalReference}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatNaira(t.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchPaymentLinks.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Payment Links
                    </p>
                    {searchPaymentLinks.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => goToResult(`/dashboard/payments?community=${communityId}`)}
                        className="w-full flex items-center justify-between gap-2.5 px-4 py-2 hover:bg-gray-50 text-left bg-transparent border-none cursor-pointer"
                      >
                        <span className="text-xs font-medium text-gray-900">{p.title}</span>
                        <span className="text-[11px] text-gray-400">{p.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchSettlements.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <p className="px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Settlements
                    </p>
                    {searchSettlements.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2.5 px-4 py-2"
                      >
                        <span className="text-xs font-medium text-gray-900">{s.status}</span>
                        <span className="text-[11px] text-gray-400">
                          {formatNaira(s.netAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="relative ml-auto flex items-center gap-4" ref={panelRef}>
        {/* Help — replay the first-launch dashboard tour. Hidden below md:
        Figma's mobile topbar (node 352:19421) carries only burger, brand and
        bell, and nothing else. The tour button is the only trigger for the
        dashboard tour, so it is not dropped on a phone -- it moves into both
        drawers as a "Take the tour" row (Sidebar.jsx, MobileTourRow). */}
        <div className="hidden md:block">
          <Button
            variant="tertiary"
            size="icon-sm"
            onClick={onOpenTour}
            className=""
            aria-label="Take the dashboard tour"
            title="Take the dashboard tour"
          >
            <HelpCircle size={18} />
          </Button>
        </div>

        {/* Bell */}
        {/* Mobile: Figma's 48x48 glass circle (node 352:19429) -- an instance
        of the MobileBackButton shell with the chevron swapped for a bell, so
        the four geometry values stay declared once. The unread badge sits on
        this wrapper rather than the button so the button's own classes are
        untouched. */}
        <div className="relative md:hidden">
          <MobileBackButton
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
            title="Notifications"
          >
            <Bell size={16} />
          </MobileBackButton>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger border-2 border-white flex items-center justify-center text-white text-[9px] font-bold px-0.5 pointer-events-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {/* Desktop bell */}
        <div className="relative hidden md:flex md:items-center">
          <Button
            variant="tertiary"
            size="icon-md"
            onClick={() => setPanelOpen((o) => !o)}
            className="relative"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger border-2 border-white flex items-center justify-center text-white text-[9px] font-bold px-0.5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </div>

        {panelOpen && (
          <NotificationsPanel
            notifications={notifications}
            isLoading={isLoading}
            unreadCount={unreadCount}
            communityMap={communityMap}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onClearAll={clearAll}
            isClearingAll={isClearingAll}
            onClose={() => setPanelOpen(false)}
          />
        )}

        {/* Divider + account menu — desktop only. Figma's mobile topbar (node
        352:19421) ends at the bell, and below md the drawer's own labelled
        Log Out row is the sign-out path, so the avatar menu would only
        duplicate it. */}
        <div className="hidden md:flex md:items-center md:gap-4">
          {/* Divider */}
          <div className="w-px h-6 bg-[var(--color-hairline)]" />

          {/* User menu — Settings + Log out (POST /auth/logout lives in AuthContext) */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Account menu"
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity p-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-accent-indigo flex items-center justify-center text-white font-bold text-xs flex-shrink-0 select-none overflow-hidden">
                {user?.profileImage?.url ? (
                  <PulseImg src={user.profileImage.url} alt="" className="w-full h-full" />
                ) : (
                  initials
                )}
              </div>
              <div aria-busy={!user || undefined} className="text-left hidden sm:block">
                {user ? (
                  <>
                    <p className="text-xs font-bold text-ink leading-tight">{displayName}</p>
                    <p className="text-[11px] text-gray-400 leading-tight">{email}</p>
                  </>
                ) : (
                  // Sized to the two lines above so the header keeps its height
                  // across the hydration gap. Decorative (Skeleton is
                  // aria-hidden), with aria-busy on this container doing the
                  // announcing.
                  <>
                    <Skeleton className="h-3 w-[92px] rounded" />
                    <Skeleton className="h-2.5 w-[120px] rounded mt-1" />
                  </>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-400 hidden sm:block transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1.5 z-50"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/dashboard/settings");
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-transparent border-none cursor-pointer hover:bg-gray-50 text-left"
                >
                  <Settings size={14} className="text-gray-400" />
                  Settings
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-danger bg-transparent border-none cursor-pointer hover:bg-danger-wash text-left disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {loggingOut ? "Signing out…" : "Log out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
