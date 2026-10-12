import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useNavigate, Navigate } from "react-router-dom";
import {
  ChevronDown,
  Clock,
  AlertCircle,
  Grid,
  List,
  Mail,
  Check,
  X as XIcon,
  Bell,
  CreditCard,
  ChevronRight,
  Loader2,
  // The "No communities yet" empty state renders <Users> below. It was never
  // imported, so that branch threw `ReferenceError: Users is not defined` for
  // every user with zero communities -- the first-run state for a new member.
  Users,
} from "lucide-react";
import { formatNaira as sharedFormatNaira, formatDateShort, toTitleCase } from "../../utils/format";
import { useCommunitiesWithMetrics } from "../../hooks/useCommunities";
import { useInvites } from "../../hooks/useInvites";
import { useGlobalOverview } from "../../hooks/usePayments";
import { useAllNotifications } from "../../hooks/useNotifications";
import { useCommunityMap } from "../../hooks/useCommunityMap";
import {
  extractNotificationDetails,
  formatNairaAmount,
  resolveCommunity as resolveNotificationCommunity,
} from "../../utils/notificationContent";
import { notificationsListDestination } from "../../utils/notificationRouting";
import { useAuth } from "../../store/AuthContext";
import { resolveIsPayingAdmin, isCommunityAdmin } from "../../utils/communityRole";
import { usePageTitle } from "../../hooks/usePageTitle";
import LoadingState from "../../components/common/LoadingState";
import { Skeleton } from "../../components/common/SkeletonUI";
import { AdminPaymentModal } from "../../components/dashboard/AdminPaymentModal";
import { CommunityCard } from "./CommunitiesHomeSections";
import KycWizardModal from "../../components/kyc/KycWizardModal";
import KycStatusBadge from "../../components/memberApp/KycStatusBadge";
import { useKycGate } from "../../hooks/useKycGate";
import { kycDisabled } from "../../lib/flags";

function formatNaira(amount) {
  return sharedFormatNaira(amount, { emptyDash: true });
}

const SORT_OPTIONS = ["Recently Viewed", "A-Z", "Z-A", "Newest First"];

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CardSkeleton() {
  // Decorative placeholder: hidden from assistive tech, and the grid that
  // renders these carries aria-busy (see the communities grid below) so a
  // screen-reader user hears that the region is loading rather than a set of
  // bare grey bars.
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-lg border border-surface-container-border overflow-hidden animate-pulse"
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3 rounded w-3/4 mb-2" />
            <Skeleton className="h-2.5 rounded w-1/2" />
          </div>
          <Skeleton className="w-14 h-5 rounded" />
        </div>
        <Skeleton className="w-full h-28 rounded-sm" />
      </div>
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50 flex justify-between">
        <Skeleton className="h-2.5 rounded w-1/3" />
        <Skeleton className="h-2.5 rounded w-1/4" />
      </div>
    </div>
  );
}

// ── Global overview ──────────────────────────────────────────────────────────
// Cross-community rollup above the community grid: the user's own upcoming
// payments, recent transactions, and latest notifications — regardless of
// which community they belong to.

function obligationStatusChip(o) {
  const days = o.dueDate ? Math.ceil((new Date(o.dueDate) - new Date()) / 86400000) : null;
  if (days != null && days < 0) return { label: "Overdue", cls: "bg-danger-wash text-danger" };
  if (days != null && days <= 7) return { label: "Due soon", cls: "bg-warning-wash text-warning" };
  return { label: "Upcoming", cls: "bg-brand-wash text-brand" };
}

function OverviewCard({ icon, title, badge, children, footerLabel, onFooter }) {
  return (
    <div className="bg-surface-container rounded-lg border border-surface-container-border flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 border-b border-hairline">
        {icon}
        <p className="text-xs font-semibold text-gray-900">{title}</p>
        {badge != null && badge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-brand-wash text-brand border border-blue-100">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 divide-y divide-gray-50">{children}</div>
      {footerLabel && (
        <Button
          variant="tertiary"
          size="xs"
          onClick={onFooter}
          className="w-full justify-start border-t border-gray-50"
        >
          {footerLabel} <ChevronRight size={12} />
        </Button>
      )}
    </div>
  );
}

function OverviewEmpty({ text }) {
  return <p className="text-[11px] text-gray-400 px-4 py-5 text-center">{text}</p>;
}

function GlobalOverview() {
  const navigate = useNavigate();
  const { upcoming, recentActivity, isLoading } = useGlobalOverview();
  const { notifications, unreadCount } = useAllNotifications();
  const communityMap = useCommunityMap();
  const [payingItem, setPayingItem] = useState(null);

  const upcomingTop = upcoming.slice(0, 4);
  const activityTop = recentActivity.slice(0, 4);
  const notifTop = notifications.slice(0, 3);

  // This page spans every community the admin belongs to, not one route's
  // worth — so it can't lean on /member/pay/:id the way a single-community
  // context can. Member-app routes are permanently mobile-gated by
  // MemberDeviceGuard (never device-gated, always a QR handoff on desktop),
  // which meant clicking "Pay Now" here from a desktop dashboard bounced to
  // a "scan this on your phone" screen instead of paying. AdminPaymentModal
  // (same one AdminDashboard.jsx's paying-admin view already uses) is
  // desktop-native and takes the exact obligation shape useGlobalOverview
  // already returns, so no data reshaping is needed.
  function handlePay(o) {
    setPayingItem(o);
  }

  // Nothing to roll up yet (brand-new account) — the community grid and its
  // empty state carry the page fine on their own.
  if (!isLoading && !upcomingTop.length && !activityTop.length && !notifTop.length) {
    return null;
  }

  return (
    <>
      <div
        data-tour="global-overview"
        className="px-4 md:px-7 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* Upcoming payments across all communities */}
        <OverviewCard
          icon={<Clock size={14} className="text-brand" />}
          title="Upcoming Payments"
          badge={upcoming.length}
          // No desktop-native page exists yet for "my dues across every
          // community" (only /member/upcoming, which is permanently
          // mobile-gated) — hiding the footer link rather than pointing it at
          // Payments.jsx, which is a single active community's admin
          // payment-plan management view, not a personal cross-community list.
          footerLabel={null}
        >
          {isLoading ? (
            <LoadingState className="py-5" />
          ) : upcomingTop.length === 0 ? (
            <OverviewEmpty text="No payments due — you're all caught up." />
          ) : (
            upcomingTop.map((o) => {
              const chip = obligationStatusChip(o);
              return (
                <button
                  key={o.id}
                  onClick={() => handlePay(o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-transparent border-none text-left cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {toTitleCase(o.name)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {[o.communityName, o.dueDate ? `Due ${formatDateShort(o.dueDate)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-900">
                      {formatNaira(o.amount)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${chip.cls}`}
                    >
                      {chip.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </OverviewCard>

        {/* Recent activity */}
        <OverviewCard
          icon={<CreditCard size={14} className="text-brand" />}
          title="Recent Activity"
          // Same gap as Upcoming Payments above — no desktop page for this yet.
          footerLabel={null}
        >
          {isLoading ? (
            <LoadingState className="py-5" />
          ) : activityTop.length === 0 ? (
            <OverviewEmpty text="No transactions yet." />
          ) : (
            activityTop.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {toTitleCase(t.description)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {[t.communityName, t.date ? formatDateShort(t.date) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-900">
                    {formatNaira(t.amount)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      t.status === "success"
                        ? "text-emerald-600"
                        : t.status === "failed"
                          ? "text-danger"
                          : "text-amber-600"
                    }`}
                  >
                    {t.status === "success"
                      ? "Successful"
                      : t.status === "failed"
                        ? "Failed"
                        : "Pending"}
                  </span>
                </div>
              </div>
            ))
          )}
        </OverviewCard>

        {/* Notifications */}
        <OverviewCard
          icon={<Bell size={14} className="text-brand" />}
          title="Notifications"
          badge={unreadCount}
          // No page-level "view all" for this card: it aggregates every
          // community's activity, and there's no single community page that
          // "view all" could correctly deep-link into.
          footerLabel={null}
        >
          {notifTop.length === 0 ? (
            <OverviewEmpty text="No notifications yet." />
          ) : (
            notifTop.map((n) => {
              const details = extractNotificationDetails(n, { communityMap });
              const amount = formatNairaAmount(details.amount);
              const messageText = n.message ?? n.description ?? n.bodyText ?? null;
              // Scoped to the community this notification actually came from
              // (same resolution + routing the topbar bell dropdown uses) --
              // not whatever community happens to be active/last-visited.
              const destination = notificationsListDestination(
                n,
                resolveNotificationCommunity(n, communityMap),
              );
              return (
                <button
                  key={n.id}
                  onClick={() => navigate(destination)}
                  className="w-full flex items-start gap-2.5 px-4 py-2.5 bg-transparent border-none text-left cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {!(n.readFlag ?? false) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs truncate ${(n.readFlag ?? false) ? "text-gray-500" : "text-gray-900 font-medium"}`}
                    >
                      {n.title ?? n.subject ?? "Notification"}
                    </p>
                    {messageText && (
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{messageText}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {[
                        amount,
                        details.communityName,
                        n.createdAt ? formatDateShort(n.createdAt) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </OverviewCard>
      </div>
      {payingItem && <AdminPaymentModal item={payingItem} onClose={() => setPayingItem(null)} />}
    </>
  );
}

export default function CommunitiesHome() {
  usePageTitle("Your Communities");
  const navigate = useNavigate();
  const { user, isPlatformAdmin } = useAuth();
  const { data, isLoading, error } = useCommunitiesWithMetrics();
  const kycGate = useKycGate();
  // The header badge is a second entry point that opens the wizard directly,
  // alongside the gate — same split the member Home header uses.
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  // Show every state, approved included: this is the screen where the user
  // decides whether to create a community, so the status is worth reading
  // even when nothing is blocking them. Hidden under the kill switch and for
  // platform staff, who are backend-exempt and cannot start an attempt, and
  // held back while the summary is still unknown — a failed summary must not
  // masquerade as "Not started". A settled summary with no record is exactly
  // that, so it falls through to NOT_STARTED below (same fallback
  // useKycVerification already applies).
  const showKycBadge = !kycDisabled() && !isPlatformAdmin && !kycGate.isLoading && !kycGate.isError;
  const closeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.closeGate();
  };
  // Done-after-approval: resume whatever the gate interrupted (create a
  // community, open an owned community) instead of parking on the dashboard.
  const completeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.completeGate();
  };
  const {
    invites,
    isLoading: invitesLoading,
    accept,
    reject,
    isAccepting,
    isRejecting,
  } = useInvites();
  const [respondingId, setRespondingId] = useState(null);
  const [sort, setSort] = useState("Recently Viewed");
  const [sortOpen, setSortOpen] = useState(false);
  const [view, setView] = useState("grid");

  if (isPlatformAdmin) {
    return <Navigate to="/dashboard/admin-panel" replace />;
  }

  const communities = data?.communities ?? [];
  const pendingInvites = invites.filter((i) => (i.status ?? "PENDING").toUpperCase() === "PENDING");

  async function handleAcceptInvite(inviteId) {
    setRespondingId(inviteId);
    try {
      await accept(inviteId);
    } finally {
      setRespondingId(null);
    }
  }

  async function handleRejectInvite(inviteId) {
    setRespondingId(inviteId);
    try {
      await reject(inviteId);
    } finally {
      setRespondingId(null);
    }
  }

  const sorted = [...communities].sort((a, b) => {
    if (sort === "A-Z") return (a.name ?? "").localeCompare(b.name ?? "");
    if (sort === "Z-A") return (b.name ?? "").localeCompare(a.name ?? "");
    if (sort === "Newest First") return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    return 0; // Recently Viewed — keep API order
  });

  async function handleCommunityClick(community) {
    // Everything after the gate is the continuation: the gate stores it
    // and re-runs it when verification completes, so resume lands exactly
    // where this click was headed instead of re-deriving a destination.
    const enterCommunity = async () => {
      // Route by role, not ownership — a member promoted to ADMIN/MANAGER
      // administers this community without owning it, and previously got
      // bounced to the member app with no way into the dashboard.
      if (!isCommunityAdmin(community)) {
        try {
          localStorage.setItem(
            "glass_member_community",
            JSON.stringify({
              id: community.id,
              slug: community.slug,
              name: community.name,
            }),
          );
        } catch {
          /* ignore */
        }
        navigate("/member/home");
        return;
      }
      const id = community.slug ?? community.id;
      localStorage.setItem("glass_community", JSON.stringify(community));
      const isPaying = await resolveIsPayingAdmin(id);
      navigate(`/dashboard/${isPaying ? "admin/paying" : "admin"}?community=${id}`);
    };

    // Gate community admin entry until KYC is APPROVED (backend also
    // enforces — this is the UX interstitial, not the authority).
    // enforce runs enterCommunity itself when allowed, stores it when the
    // wizard opens, and holds it while the summary is still loading —
    // either way nothing after this line should run again.
    if (community?.owned || isCommunityAdmin(community)) {
      kycGate.enforce(enterCommunity);
      return;
    }
    await enterCommunity();
  }

  return (
    <div className="relative flex flex-col min-h-full">
      {/* Header. On phones the KYC chip rides on the title line, pushed to its
          right edge, and the two actions take the full width below it — sharing
          one row squeezed the labels onto two lines ("Join / Community").
          From md up the actions stay right-aligned and the title block (chip
          included) stays left. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3 px-4 pt-7 pb-5 md:items-center md:px-7">
        {/* Title and KYC chip travel together: full width on phones, so
            justify-between parks the chip at the right edge of the title line.
            The chip is a bare transparent button, not the design-system Button —
            wrapping a status pill in one put that variant's focus ring and box
            around what is otherwise a plain read-out. */}
        <div className="flex w-full min-w-0 items-start justify-between gap-3 md:w-auto">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">Your Communities</h1>
            {user?.firstName && (
              <p className="text-xs text-gray-400 mt-0.5">Welcome back, {user.firstName}</p>
            )}
          </div>

          {showKycBadge && (
            <button
              type="button"
              onClick={() => setKycWizardOpen(true)}
              className="bg-transparent border-none cursor-pointer p-0 flex-shrink-0"
              aria-label="Identity verification status"
            >
              <KycStatusBadge status={kycGate.status ?? "NOT_STARTED"} />
            </button>
          )}
        </div>

        <div
          data-tour="communities-home-actions"
          className="flex w-full gap-3 md:w-auto md:items-center"
        >
          {/* Figma 1:7274 -- 189x56, white fill, #000000 stroke, black label,
              32px padding and a trailing dropdown chevron. The label dropped
              to 12px and the box to h40 (sm-tight) with the 2026-10-12
              button-sizing sweep: 16px read too large against "Your
              Communities" and the pair crowded the header. */}
          <Button
            variant="outline-neutral"
            size="sm-tight"
            fullWidth={false}
            onClick={() => navigate("/onboarding/choose-path", { state: { intent: "join" } })}
          >
            Join Community
            <ChevronDown size={16} />
          </Button>
          {/* Figma 1:7277 -- 208x56, #002FA7 fill, 32px padding; same
              sm-tight exception as the Join button above. */}
          <Button
            variant="primary"
            size="sm-tight"
            fullWidth={false}
            onClick={() => {
              kycGate.enforce(() => navigate("/onboarding/choose-path"));
            }}
            disabled={kycGate.isLoading}
            aria-busy={kycGate.isLoading}
          >
            {kycGate.isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Checking…
              </>
            ) : (
              "Create Community"
            )}
          </Button>
        </div>
      </div>

      <KycWizardModal
        open={kycWizardOpen || kycGate.gateOpen}
        onClose={closeKycWizard}
        onComplete={completeKycWizard}
        historyPath="/dashboard/verify-identity/history"
      />

      {!invitesLoading && pendingInvites.length > 0 && (
        <div className="px-4 md:px-7 pb-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
              <Mail size={14} className="text-brand" />
              <p className="text-xs font-semibold text-gray-900">
                Pending Invitations ({pendingInvites.length})
              </p>
            </div>
            <div className="flex flex-col divide-y divide-blue-100">
              {pendingInvites.map((invite) => {
                const isResponding = respondingId === invite.id && (isAccepting || isRejecting);
                return (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {invite.community?.name ?? invite.community?.slug ?? "A community"}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        invited you to join
                        {invite.roleCode ? ` as ${invite.roleCode.toLowerCase()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="xs"
                        fullWidth={false}
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={isResponding}
                      >
                        <Check size={12} /> Accept
                      </Button>
                      <Button
                        variant="outline-neutral"
                        size="xs"
                        fullWidth={false}
                        onClick={() => handleRejectInvite(invite.id)}
                        disabled={isResponding}
                      >
                        <XIcon size={12} /> Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global overview — payments, activity, notifications across all communities */}
      <GlobalOverview />

      {/* Filters */}
      <div
        data-tour="communities-view-controls"
        className="flex items-center gap-5 px-4 md:px-7 pb-5 w-fit"
      >
        <div className="relative">
          <Button
            variant="outline-neutral"
            size="xs"
            fullWidth={false}
            onClick={() => setSortOpen((o) => !o)}
          >
            {sort} <ChevronDown size={13} />
          </Button>
          {sortOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white rounded-xl border border-surface-container-border shadow-lg z-50 min-w-40 overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSort(opt);
                    setSortOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-xs transition-all ${
                    sort === opt ? "bg-blue-50 font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex rounded-sm border border-gray-200 overflow-hidden">
          {[
            { id: "grid", icon: <Grid size={15} /> },
            { id: "list", icon: <List size={15} /> },
          ].map((v, i) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`w-8 h-8 flex items-center justify-center transition-all ${i === 0 ? "border-0 border-r border-gray-200" : "border-none"} ${
                view === v.id ? "bg-blue-50 text-brand" : "bg-white text-gray-600"
              }`}
            >
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 md:mx-7 mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-danger">Couldn't load communities. Please refresh.</p>
        </div>
      )}

      {/* Grid / List */}
      <div
        data-tour="communities-grid"
        aria-busy={isLoading || undefined}
        className={`px-4 md:px-7 pb-10 grid gap-4 ${
          view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        }`}
      >
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : sorted.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <Users size={24} className="text-brand" />
            </div>
            <p className="text-sm font-medium text-gray-700">No communities yet</p>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Create or join a community to get started.
            </p>
          </div>
        ) : (
          sorted.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              onClick={() => handleCommunityClick(community)}
            />
          ))
        )}
      </div>
    </div>
  );
}
