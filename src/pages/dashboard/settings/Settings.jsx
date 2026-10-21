import { useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useNavigate, useLocation, Outlet, Navigate } from "react-router-dom";
import { usePageTitle } from "../../../hooks/usePageTitle";
import { Search, ChevronRight, Building2 } from "lucide-react";
import { useAuth } from "../../../store/AuthContext";
import { useActiveCommunityId } from "../../../hooks/useActiveCommunityId";
import { useCommunities } from "../../../hooks/useCommunities";
import { isCommunityAdmin } from "../../../utils/communityRole";
import EmptyState from "../../../components/common/EmptyState";
import { useKycSummary } from "../../../hooks/useKyc";
import KycStatusBadge from "../../../components/memberApp/KycStatusBadge";
import KycWizardModal from "../../../components/kyc/KycWizardModal";
import {
  IconNavUser,
  IconNavRole,
  IconNavSecurity,
  IconNavPayments,
  IconNavAutopay,
  IconNavPayoutAccount,
  IconNavCommunity,
  IconNavMembers,
  IconNavNotifications,
  IconNavIdentity,
} from "../../../components/ui/icons/AdminMenuIcons";
import { kycDisabled } from "../../../lib/flags";

// The communities overview owns the "pick one community" empty state -- the
// guard redirects unresolved community-scoped routes back here.
const COMMUNITIES_HOME = "/dashboard/home";

// Community-scoped Settings destinations are the ones wrapped in
// CommunityAdminGuard (see App.jsx). Marked explicitly so this page can tell
// the user up front when one isn't usable, instead of offering a link that
// silently bounces them back to the communities overview.
const TABS = [
  { label: "Account", defaultPath: "/dashboard/settings/account", match: "account" },
  { label: "Finance", defaultPath: "/dashboard/settings/finance", match: "finance" },
  {
    label: "Community",
    defaultPath: "/dashboard/settings/community",
    match: "community",
    communityScoped: true,
  },
];

const ACCOUNT_ITEMS = [
  {
    label: "Profile",
    desc: "Configure your details to how you want them to appear on Glass.",
    path: "/dashboard/settings/account/profile",
    icon: IconNavUser,
  },
  {
    label: "My Role",
    desc: "Tell us how you participate financially in this community.",
    path: "/dashboard/settings/account/role",
    icon: IconNavRole,
  },
  {
    label: "Security",
    desc: "Keep your account locked down with password and login controls.",
    path: "/dashboard/settings/account/security",
    icon: IconNavSecurity,
  },
  {
    label: "Notifications",
    desc: "Choose which updates you get by email and SMS.",
    path: "/dashboard/settings/account/notifications",
    icon: IconNavNotifications,
  },
  // KYC is personal, not community-scoped: it gates what *you* can create and
  // manage, so it deliberately carries no ?community= and every community
  // owner/admin sees their own status here (see scopedPath). Tapping it opens
  // the wizard in place instead of navigating -- same as the member app --
  // because a full-screen redirect would lose the Settings context the user
  // opened it from.
  {
    label: "Identity Verification",
    desc: "Verify your identity to create and manage communities.",
    path: "/dashboard/verify-identity",
    icon: IconNavIdentity,
    kyc: true,
  },
];

// Finance tab menu items
const FINANCE_ITEMS = [
  {
    label: "Payment Methods",
    desc: "The cards and accounts Glass uses to collect your dues.",
    path: "/dashboard/settings/finance/payment-methods",
    icon: IconNavPayments,
  },
  {
    label: "Auto-Pay",
    desc: "Turn on automatic charging so you never miss a due date.",
    path: "/dashboard/settings/finance/auto-pay",
    icon: IconNavAutopay,
  },
  {
    label: "Payout Account",
    desc: "The account your community's collected dues are settled into.",
    path: "/dashboard/settings/finance/paystack",
    communityScoped: true,
    icon: IconNavPayoutAccount,
  },
];

const COMMUNITY_ITEMS = [
  {
    label: "AI usage & policy",
    desc: "View your community’s AI usage, remaining allowance, and reset time.",
    path: "/dashboard/settings/community/ai-usage",
    communityScoped: true,
    icon: IconNavAutopay,
  },
  {
    label: "Community Profile",
    desc: "How your community looks and behaves to its members.",
    path: "/dashboard/settings/community/profile",
    communityScoped: true,
    icon: IconNavCommunity,
  },
  {
    label: "Member Access",
    desc: "Control who can join, and who else can manage this community.",
    path: "/dashboard/settings/community/member-access",
    communityScoped: true,
    icon: IconNavMembers,
  },
];

const BREADCRUMB_MAP = {
  "account/profile": { parent: "Account", child: "Profile" },
  "account/role": { parent: "Account", child: "My role" },
  "account/notifications": { parent: "Account", child: "Notifications" },
  "account/security": { parent: "Account", child: "Security" },
  "finance/payment-methods": { parent: "Finance", child: "Payment Methods" },
  "finance/auto-pay": { parent: "Finance", child: "Auto-Pay" },
  "finance/paystack": { parent: "Finance", child: "Payout Account" },
  "community/ai-usage": { parent: "Community", child: "AI usage & policy" },
  "community/profile": { parent: "Community", child: "Community Profile" },
  "community/member-access": { parent: "Community", child: "Member Access" },
};

const PARENT_PATH = {
  Account: "/dashboard/settings/account",
  Finance: "/dashboard/settings/finance",
  Community: "/dashboard/settings/community",
};

// Flat index for search — label, description, path, and which tab it lives in
const ALL_SETTINGS = [
  ...ACCOUNT_ITEMS.map((i) => ({ ...i, tab: "Account" })),
  ...FINANCE_ITEMS.map((i) => ({ ...i, tab: "Finance" })),
  ...COMMUNITY_ITEMS.map((i) => ({ ...i, tab: "Community" })),
];

// Community-scoped destinations resolve their community from ?community=,
// falling back to the localStorage snapshot (see useActiveCommunityId), and
// CommunityAdminGuard fails closed when neither yields one the user
// administers. Thread the already-resolved community through explicitly so
// the guard acts on the community this menu advertised instead of on ambient
// state — matching the ?community= convention AdminDashboard/Sidebar use.
//
// Only ever applied to community-scoped destinations: the account-level
// /dashboard/settings root deliberately carries no ?community= (see
// Sidebar.jsx's communityPath), and neither does anything on Account.
function scopedPath(path, community) {
  if (!community) return path;
  const id = community.slug ?? community.id;
  if (!id) return path;
  return `${path}?community=${encodeURIComponent(id)}`;
}

// Parent breadcrumb crumb — click to go back to that tab's menu list.
function BreadcrumbParent({ parent, community }) {
  const navigate = useNavigate();
  return (
    // Figma draws the breadcrumb's parent label in solid #000000 (node
    // 1:5719). The tertiary role renders the muted "Subtle" ink (black @60%),
    // so text-ink lifts it back to full black here.
    <Button
      variant="tertiary"
      size="sm"
      fullWidth={false}
      onClick={() => navigate(scopedPath(PARENT_PATH[parent], community))}
      className="text-ink"
    >
      {parent}
    </Button>
  );
}

// One nav helper for every clickable Settings destination. Only
// community-scoped rows get ?community= threaded on; account-level rows are
// left exactly as they were, and the bare tab paths stay bare.
//
// kycSummary/onOpenKyc are optional and default to inert, so the Finance and
// Community lists keep rendering plain navigation rows with no behaviour
// change.
function MenuList({ items, community, kycSummary, onOpenKyc }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 w-full">
      {items.map((item, i) => {
        const RowIcon = item.icon;
        return (
          <button
            key={i}
            onClick={() => (item.kyc ? onOpenKyc() : navigate(scopedPath(item.path, community)))}
            className="w-full flex items-center gap-4 pl-9 pr-6 py-[23px] bg-surface-container rounded-[4px] text-left hover:bg-gray-50 transition-all cursor-pointer border border-surface-container-border"
          >
            {/* Figma 'navMenuIcons/*' lead glyph. 24px, down from Figma's 32px
              and scaled with the row copy (18/16 -> 14/12). The file only
              draws glyphs for eight of the ten rows; Notifications and
              Identity Verification are drawn in AdminMenuIcons.jsx to match. */}
            <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
              {RowIcon ? <RowIcon size={24} /> : null}
            </div>
            <div className="flex-1 min-w-0">
              {/* Owner-directed divergence from Figma, which specifies 18/500
                + 16/400 here: the row copy read oversized against the 16px
                tab labels and the surrounding chrome, so both step down to
                the 14/12 pair the page's other controls use. */}
              <p className="text-sm leading-5 font-medium text-ink">{item.label}</p>
              <p className="text-xs leading-4 mt-0.5 text-ink">{item.desc}</p>
            </div>
            {/* Live status beside the row. This list is full-width, so the pill
              keeps its label here -- only the phone-width member list drops to
              the icon (KycStatusBadge showLabel). */}
            {item.kyc && kycSummary?.status && (
              <KycStatusBadge status={kycSummary.status} className="flex-shrink-0" />
            )}
            <ChevronRight size={16} className="text-ink flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// Shown in place of community-scoped destinations when no community can be
// resolved (nothing chosen yet, or the stored/URL one is stale or one the
// user doesn't administer). Explains the situation and points back at the
// page that owns the choice, rather than redirecting silently.
function ChooseCommunityState({ onChoose }) {
  return (
    <EmptyState
      icon={Building2}
      title="Choose a community"
      subtitle="These settings apply to one community at a time. Pick a community you manage to change its profile, member access, or payout account."
      action={onChoose}
      actionLabel="Go to my communities"
    />
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { isPlatformAdmin } = useAuth();
  const communityId = useActiveCommunityId();
  const { data: communitiesData, isLoading: communitiesLoading } = useCommunities();

  const titleKey = Object.keys(BREADCRUMB_MAP).find((k) => path.includes(k));
  usePageTitle(titleKey ? BREADCRUMB_MAP[titleKey].child : "Settings");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // KYC launches the wizard in place instead of navigating, so the row is
  // gated on the same feature flag the member app uses -- otherwise a flagged
  // user would tap a row that opens a wizard the gate was meant to suppress.
  const hideKyc = kycDisabled();
  const { data: kycSummary } = useKycSummary();
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  const accountItems = hideKyc ? ACCOUNT_ITEMS.filter((i) => !i.kyc) : ACCOUNT_ITEMS;

  // Platform admins only get Security — redirect other settings paths there.
  // Must come after every hook above: hooks can't be called conditionally,
  // and this early return would otherwise skip them on some renders.
  if (isPlatformAdmin && !path.includes("account/security")) {
    return <Navigate to="/dashboard/settings/account/security" replace />;
  }

  const activeTab = TABS.find((t) => path.includes(t.match))?.label || "Account";

  const isAccountMenu = path === "/dashboard/settings/account";
  const isFinanceMenu = path === "/dashboard/settings/finance";
  const isCommunityMenu = path === "/dashboard/settings/community";

  const crumbKey = Object.keys(BREADCRUMB_MAP).find((k) => path.includes(k));
  const breadcrumb = crumbKey ? BREADCRUMB_MAP[crumbKey] : null;

  // Which community this page is acting on, using the same resolution the
  // guards and Sidebar use (?community=, else the glass_community snapshot) --
  // deliberately no fourth source. In particular there is no first/default/
  // any-community fallback: an admin of several communities who reaches
  // Settings from CommunitiesHome has not chosen one yet, so guessing would
  // silently edit a community they never picked.
  const communities = communitiesData?.communities ?? [];
  const activeCommunity = communityId
    ? (communities.find((c) => c.slug === communityId || String(c.id) === String(communityId)) ??
      null)
    : null;

  // A community-scoped destination is only genuinely usable when the resolved
  // community is one this user actually administers -- a stale localStorage
  // snapshot, or a hand-edited ?community= naming a community they don't
  // manage, is exactly what CommunityAdminGuard rejects. Mirror that check
  // here so the menu never advertises a link that would bounce.
  const resolvedCommunityIsAdmin = isCommunityAdmin(activeCommunity);

  // While the list is still loading, "no community chosen" and "not loaded
  // yet" are indistinguishable. Rendering "choose a community" then would
  // misreport a perfectly valid session on every cold load, so hold off until
  // the context settles -- the guard shows its own loading screen meanwhile.
  const communityContextPending = !!communityId && communitiesLoading;
  const needsCommunityChoice = !communityContextPending && !resolvedCommunityIsAdmin;

  // Thread a community only once it has been resolved AND verified. Nothing is
  // guessed, and nothing is threaded while the context is still unproven.
  const scopedCommunity = resolvedCommunityIsAdmin ? activeCommunity : null;

  const q = searchQuery.trim().toLowerCase();
  const searchResults =
    q.length > 0
      ? ALL_SETTINGS.filter(
          (s) => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q),
          // Don't advertise community-scoped destinations while no community
          // resolves -- selecting one would just bounce back here.
        )
          .filter((s) => !s.communityScoped || !needsCommunityChoice)
          // Same reason the row itself is filtered out of accountItems: never
          // offer a flag-disabled destination from search either.
          .filter((s) => !s.kyc || !hideKyc)
      : [];

  function handleSearchSelect(item) {
    setSearchQuery("");
    setSearchOpen(false);
    if (item.kyc) {
      setKycWizardOpen(true);
      return;
    }
    navigate(scopedPath(item.path, scopedCommunity));
  }

  return (
    <div className="flex flex-col h-full px-4 py-6 md:px-8 md:py-8 overflow-y-auto">
      {/* Heading + Search */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">Settings</h1>
          <p className="text-xs text-gray-500">
            A full picture of your community's financial activity.
          </p>
        </div>

        {/* Search with live results dropdown */}
        <div className="relative" ref={searchRef}>
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            aria-label="Search settings"
            placeholder="Find A Setting"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            className="pl-9 pr-4 py-2 rounded-md text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-brand transition-colors w-full max-w-[220px] border border-hairline-strong bg-white"
          />

          {/* Dropdown results */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg overflow-hidden z-50 border border-surface-container-border w-[280px]">
              {searchResults.map((item) => (
                <button
                  key={item.path}
                  onMouseDown={() => handleSearchSelect(item)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-none bg-transparent cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.tab} · {item.desc}
                    </p>
                  </div>
                  <ChevronRight size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchOpen && q.length > 0 && searchResults.length === 0 && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg z-50 px-4 py-3 border border-surface-container-border w-[240px]">
              <p className="text-xs text-gray-400">No settings match "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar — hidden for platform admins */}
      {!isPlatformAdmin && (
        <div className="flex gap-1 mb-6 bg-stacked-container rounded-[4px] p-1 w-fit">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => navigate(scopedPath(tab.defaultPath, scopedCommunity))}
                aria-current={isActive ? "page" : undefined}
                className={`px-6 py-2 text-base font-medium rounded transition-colors cursor-pointer border-none focus-visible:outline-none
                  ${
                    isActive
                      ? "bg-surface-container text-black"
                      : "bg-transparent text-black/60 hover:text-black"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Breadcrumb — only shown on sub-pages, hidden for platform admins */}
      {breadcrumb && !isPlatformAdmin && (
        <p className="text-sm text-gray-500 mb-5">
          <BreadcrumbParent parent={breadcrumb.parent} community={scopedCommunity} />
          <span className="mx-2 text-gray-400">›</span>
          <span className="font-semibold text-gray-900">{breadcrumb.child}</span>
        </p>
      )}

      {/* Menu lists — platform admins are redirected to Security above */}
      {!isPlatformAdmin && isAccountMenu && (
        <MenuList
          items={accountItems}
          kycSummary={kycSummary}
          onOpenKyc={() => setKycWizardOpen(true)}
        />
      )}
      {!isPlatformAdmin &&
        isFinanceMenu &&
        (!needsCommunityChoice ? (
          <MenuList items={FINANCE_ITEMS} community={activeCommunity} />
        ) : (
          <ChooseCommunityState onChoose={() => navigate(COMMUNITIES_HOME)} />
        ))}
      {!isPlatformAdmin &&
        isCommunityMenu &&
        (!needsCommunityChoice ? (
          <MenuList items={COMMUNITY_ITEMS} community={activeCommunity} />
        ) : (
          <ChooseCommunityState onChoose={() => navigate(COMMUNITIES_HOME)} />
        ))}

      {/* Sub-page content */}
      {(isPlatformAdmin || (!isAccountMenu && !isFinanceMenu && !isCommunityMenu)) && <Outlet />}

      <KycWizardModal
        open={kycWizardOpen}
        onClose={() => setKycWizardOpen(false)}
        historyPath="/dashboard/verify-identity/history"
      />
    </div>
  );
}
