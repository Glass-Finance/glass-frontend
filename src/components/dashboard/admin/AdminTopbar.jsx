/**
 * AdminTopbar.jsx — top bar of the platform-admin shell (design:
 * Overview@1x): the jump-to search over users, communities and
 * transaction references (⌘K / Ctrl+K focuses it), the help button and
 * the notifications bell with its unread dot. No "Production" badge —
 * the current design dropped it. Rendered only on the admin chrome routes
 * (see DashboardLayout).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, HelpCircle, Loader2, Menu, Search } from "lucide-react";
import { Button } from "../../ui/Button";
import NotificationsPanel from "../NotificationsPanel";
import { useAdminSearch } from "../../../hooks/useAdminSearch";
import { useAllNotifications } from "../../../hooks/useNotifications";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { useCommunities } from "../../../hooks/useCommunities";
import { useDebounce } from "../../../hooks/useDebounce";
import { formatNaira, toPascalCaseName } from "../../../utils/format";

const RESULT_ROW = "w-full justify-start! px-4! text-gray-900! hover:bg-gray-50!";

export default function AdminTopbar({ onMenuClick, onOpenTour }) {
  const navigate = useNavigate();

  // Same all-community panel the member topbar opens — the bell is the
  // design's only notifications affordance on this shell.
  const { notifications, isLoading, unreadCount, markRead, markAllRead, clearAll, isClearingAll } =
    useAllNotifications();
  const { data: communitiesData } = useCommunities();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  useClickOutside(panelRef, () => setPanelOpen(false), panelOpen);

  const communityMap = useMemo(() => {
    const map = new Map();
    for (const c of communitiesData?.communities ?? []) {
      if (c.id) map.set(c.id, c);
      if (c.slug) map.set(c.slug, c);
    }
    return map;
  }, [communitiesData]);

  // ── Jump-to search: debounced term → three parallel capped lists. ────────
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  // Which search the user dismissed by clicking outside (member topbar's
  // pattern, flattened to one term since there's a single input here): a
  // new keystroke reopens, the same search stays closed.
  const [dismissed, setDismissed] = useState(false);
  const setTermDebounced = useDebounce(setTerm, 300);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const { users, communities, transactions, isSearching, hasSearched } = useAdminSearch(term);
  const hasResults = users.length + communities.length + transactions.length > 0;
  const open = term.trim().length >= 2 && !dismissed && (hasResults || hasSearched);
  useClickOutside(searchRef, () => setDismissed(true), open);

  // ⌘K / Ctrl+K — registered as a plain listener rather than through
  // KeyboardShortcutsProvider, whose dispatcher deliberately ignores any
  // combo carrying meta/ctrl/alt so it never shadows OS shortcuts.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setDismissed(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lands on the target section with the typed term as its ?q= — sections
  // seed their SearchBar from it on mount (initialSearchFromUrl).
  function jump(tab) {
    const params = new URLSearchParams({ tab });
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    setQuery("");
    setTerm("");
    setDismissed(true);
    navigate(`/dashboard/admin-panel?${params.toString()}`);
  }

  return (
    <header className="h-14 bg-surface-container border-b border-surface-container-border flex items-center gap-4 md:gap-6 px-3 md:px-8 sticky top-0 z-50 flex-shrink-0">
      {/* Hamburger — mobile only (the rail is an off-canvas drawer below md) */}
      <Button
        variant="tertiary"
        size="icon-lg"
        data-tour="mobile-menu-button"
        onClick={onMenuClick}
        className="flex-shrink-0 md:hidden"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </Button>

      {/* Jump-to search */}
      <div
        ref={searchRef}
        data-tour="topbar-search"
        className="relative flex-1 max-w-[540px] hidden md:block"
      >
        <div className="flex items-center gap-2 bg-gray-100 rounded-g-1 px-3.5 py-2.5 border border-transparent focus-within:border-brand transition-colors">
          {isSearching ? (
            <Loader2 size={14} className="text-gray-400 flex-shrink-0 animate-spin" />
          ) : (
            <Search size={14} className="text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            aria-label="Jump to a user, community or transaction reference"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDismissed(false);
              setTermDebounced(e.target.value);
            }}
            placeholder="Jump to a user, community or transaction reference"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-gray-700 placeholder-gray-400"
          />
          <kbd className="hidden lg:inline-flex items-center flex-shrink-0 text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 rounded-g-1 px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>

        {open && (
          <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-g-1 border border-surface-container-border shadow-lg z-50 max-h-[420px] overflow-y-auto">
            {!hasResults ? (
              <p className="m-0 text-xs text-gray-400 px-4 py-4">No results for "{term.trim()}"</p>
            ) : (
              <>
                {users.length > 0 && (
                  <div className="py-2">
                    <p className="m-0 px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Users
                    </p>
                    {users.map((u) => (
                      <Button
                        key={u.id}
                        variant="tertiary"
                        size="xs"
                        onClick={() => jump("users")}
                        className={RESULT_ROW}
                      >
                        <span className="flex-1 min-w-0 text-left truncate text-xs font-medium">
                          {toPascalCaseName(`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()) ||
                            u.email}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">{u.email}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {communities.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <p className="m-0 px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Communities
                    </p>
                    {communities.map((c) => (
                      <Button
                        key={c.id}
                        variant="tertiary"
                        size="xs"
                        onClick={() => jump("communities")}
                        className={RESULT_ROW}
                      >
                        <span className="flex-1 min-w-0 text-left truncate text-xs font-medium">
                          {c.name}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">{c.slug}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {transactions.length > 0 && (
                  <div className="py-2 border-t border-gray-50">
                    <p className="m-0 px-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Transactions
                    </p>
                    {transactions.map((t) => (
                      <Button
                        key={t.id}
                        variant="tertiary"
                        size="xs"
                        onClick={() => jump("transactions")}
                        className={RESULT_ROW}
                      >
                        <span className="flex-1 min-w-0 text-left truncate text-xs font-medium">
                          {t.internalReference ?? t.description ?? "Transaction"}
                        </span>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">
                          {formatNaira(t.amount)}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right cluster — help + bell. Help stays visible on mobile: unlike the
          member topbar (whose phone header prioritises page context and keeps
          the tour in the drawer), this shell has no drawer extras of its own. */}
      <div className="relative ml-auto flex items-center gap-1 md:gap-2" ref={panelRef}>
        <Button
          variant="tertiary"
          size="icon-md"
          onClick={onOpenTour}
          aria-label="Take the dashboard tour"
          title="Take the dashboard tour"
        >
          <HelpCircle size={17} />
        </Button>

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
      </div>
    </header>
  );
}
