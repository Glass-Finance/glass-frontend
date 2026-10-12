import { useState, useMemo, useCallback } from "react";
import { Button } from "../../components/ui/Button";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, AlertCircle, ChevronRight } from "lucide-react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMe } from "../../hooks/useMyAccount";
import { useCommunityDashboard } from "../../hooks/useCommunityDashboard";
import { usePaymentPlans } from "../../hooks/usePaymentPlans";
import { useCommunityAccount } from "../../hooks/useCommunityAccount";
import {
  usePayments,
  useManagePayments,
  usePendingPaymentVerification,
} from "../../hooks/usePayments";
import { useExportJob } from "../../hooks/useExportJob";
import { exportCommunityTransactions } from "../../api/exports";
import totalMembersIcon from "../../assets/dashboard/total-members.webp";
import inactiveMembersIcon from "../../assets/dashboard/inactive-members.webp";
import totalContribIcon from "../../assets/dashboard/total-contributions.webp";
import activePlansIcon from "../../assets/dashboard/active-plans.webp";
import { formatNaira } from "./admin-dashboard/helpers";
import { toTitleCase } from "../../utils/format";
import { isMemberRoleOwner } from "../../utils/communityRole";
import { isPaidObligationStatus } from "../../utils/paymentStatus";
import { AdminPaymentModal } from "../../components/dashboard/AdminPaymentModal";
import AddMemberModal from "./admin-dashboard/AddMemberModal";
import CreatePlanModal from "./payments/CreatePlanModal";
import { getErrorMessage, notifyError } from "../../utils/errorHandler";
import GettingStartedChecklist from "./admin-dashboard/sections/GettingStartedChecklist";
import WelcomeEmptyState from "./admin-dashboard/sections/WelcomeEmptyState";
import DashboardStats from "./admin-dashboard/sections/DashboardStats";
import UnpaidObligationAlert from "./admin-dashboard/sections/UnpaidObligationAlert";
import YourPaymentsSection from "./admin-dashboard/sections/YourPaymentsSection";
import PaymentPlansCard from "./admin-dashboard/sections/PaymentPlansCard";
import RecentActivityCard from "./admin-dashboard/sections/RecentActivityCard";
import MemberPaymentsSection from "./admin-dashboard/sections/MemberPaymentsSection";

// Stable reference for the "no upcoming dues yet" fallback below -- `?? []`
// inline would create a brand-new array every render, which defeats the
// myUpcomingFiltered useMemo's dependency check (it'd see a "changed" input
// and recompute every render even though there's nothing to recompute).
const EMPTY_UPCOMING = [];

function DashboardContent({ isPaying, communityId }) {
  usePageTitle("Community Dashboard");
  const navigate = useNavigate();
  const { run: runExport, isExporting } = useExportJob();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [alertVisible, setAlertVisible] = useState(true);
  const [payingItem, setPayingItem] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [gsDismissed, setGsDismissed] = useState(() => {
    try {
      return localStorage.getItem(`gs_done_${communityId}`) === "1";
    } catch {
      return false;
    }
  });

  const { balances, members, transactions, activity, community, isLoading, error } =
    useCommunityDashboard(communityId);
  const { data: currentUser } = useMe();
  const {
    plans,
    isLoading: plansLoading,
    error: plansError,
    create: createPlan,
  } = usePaymentPlans(communityId);

  async function handleCreatePlan(payload) {
    try {
      await createPlan.mutateAsync(payload);
      return true;
    } catch (err) {
      notifyError(err, { context: "Create payment plan" });
      return false;
    }
  }
  // The Payment Plans widget below is an at-a-glance preview, not the full
  // list (that's Payments.jsx, which has its own status filters/badges) --
  // archived/expired plans no longer need attention and would otherwise
  // clutter it indefinitely.
  const visiblePlans = plans.filter((p) => p.status !== "ARCHIVED" && p.status !== "EXPIRED");

  // Paying admin's own dues, as a member of this community -- scoped to
  // whichever community this dashboard is currently showing, not whatever
  // community the admin last visited as a member (see usePayments.js).
  const { data: myPayments } = usePayments(communityId);
  const myUpcoming = myPayments?.upcoming ?? EMPTY_UPCOMING;
  const { data: myAuthorisations } = useManagePayments();
  // Catches payers who came back from Paystack without hitting the callback
  // page — verifies the stored pending reference so Paid shows immediately.
  usePendingPaymentVerification();

  // "Your Payments" table controls — small local list, so sort/filter run
  // client-side rather than round-tripping to the server.
  const [myPaymentsSort, setMyPaymentsSort] = useState("desc"); // desc = soonest due first
  const [myPaymentsFilter, setMyPaymentsFilter] = useState(null); // null | "paid" | "unpaid"
  const [myPaymentsFilterOpen, setMyPaymentsFilterOpen] = useState(false);

  const myUpcomingFiltered = useMemo(() => {
    let rows = [...myUpcoming];
    if (myPaymentsFilter) {
      rows = rows.filter((row) => {
        const isPaid = isPaidObligationStatus(row.status);
        return myPaymentsFilter === "paid" ? isPaid : !isPaid;
      });
    }
    rows.sort((a, b) => {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return myPaymentsSort === "desc" ? ta - tb : tb - ta;
    });
    return rows;
  }, [myUpcoming, myPaymentsFilter, myPaymentsSort]);

  // Auto-pay is "on" for a recurring plan when a non-revoked authorisation
  // consent exists for it — same match rule as settings/finance/AutoPay.jsx.
  function hasActiveAutoPay(item) {
    return (myAuthorisations ?? []).some((auth) =>
      auth.consents.some(
        (c) =>
          !c.revoked && c.paymentLinkTitle === item.name && c.communityName === item.communityName,
      ),
    );
  }

  // Open the confirmation modal instead of calling the API directly
  function handlePayMine(item) {
    setPayingItem(item);
  }

  // ── Getting started checklist ─────────────────────────────────────────────
  const { account: payoutAccount, isLoading: payoutLoading } = useCommunityAccount(communityId);
  const gsHasPlans = plans.length > 0;
  // members.total counts everyone, including the owner -- who is auto-added
  // as a member the moment the community is created. Counting them made
  // this true before any real member was ever added, so WelcomeEmptyState/
  // the checklist's "Add Your First Members" step could never actually
  // trigger. isMemberRoleOwner (see communityRole.js, and its tests) filters
  // the owner's own row out so this reflects real members only.
  const gsHasMembers = (members?.list ?? []).some((m) => !isMemberRoleOwner(m));
  // A submitted account isn't necessarily a *usable* one -- it still needs
  // to clear ACTIVE/VERIFIED on our side (see errorHandler.js's rewrite of
  // "community account is not active" for the other end of this same gap).
  // Treating any submitted account as "done" hid that pending/rejected
  // state entirely: the checklist showed a green check and the whole card
  // disappeared once dismissed, with nothing telling the owner their
  // account was still being reviewed until they hit a wall trying to
  // create a payment plan.
  const payoutAccountStatus = payoutAccount?.status?.toUpperCase() ?? null;
  const gsHasPayoutAccount = ["ACTIVE", "VERIFIED"].includes(payoutAccountStatus);
  const gsPayoutAccountRejected = ["FAILED", "REJECTED"].includes(payoutAccountStatus);
  const gsPayoutAccountPending = !!payoutAccount && !gsHasPayoutAccount && !gsPayoutAccountRejected;
  const showGettingStarted =
    !isLoading &&
    !plansLoading &&
    !payoutLoading &&
    !gsDismissed &&
    (!gsHasPlans || !gsHasMembers || !gsHasPayoutAccount);
  // The very-first-load state -- nothing at all yet. Distinct from (and
  // takes priority over) showGettingStarted's banner, which still shows
  // stats/tables alongside it once at least one of plans/members exists.
  const isFreshCommunity = !isLoading && !plansLoading && !gsHasPlans && !gsHasMembers;

  function dismissGs() {
    setGsDismissed(true);
    try {
      localStorage.setItem(`gs_done_${communityId}`, "1");
    } catch {
      /* ignore */
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activePlanCount = plans.filter((p) => p.status === "ACTIVE").length;
  const stats = useMemo(
    () => [
      {
        label: "Total Members",
        value: isLoading ? "—" : String(members?.total ?? 0),
        icon: totalMembersIcon,
      },
      {
        label: "Inactive Members",
        value: isLoading ? "—" : String(members?.inactive ?? 0),
        icon: inactiveMembersIcon,
      },
      {
        label: "Overdue Members",
        value: isLoading ? "—" : String(members?.overdue ?? 0),
        icon: inactiveMembersIcon,
      },
      {
        label: "Total Contributions",
        value: isLoading ? "—" : formatNaira(balances?.totalContributions ?? 0),
        icon: totalContribIcon,
      },
      {
        label: "Active Plans",
        value: plansLoading ? "—" : String(activePlanCount),
        icon: activePlansIcon,
      },
    ],
    [isLoading, plansLoading, members, balances, activePlanCount],
  );

  // ── Member name lookup — transactions only carry email, not full name ────────
  // Build two maps (by member ID and by user ID) so we can resolve the display
  // name regardless of which ID the transaction's member object contains.
  const memberNameMap = useMemo(() => {
    const byMemberId = {};
    const byUserId = {};
    for (const m of members.list ?? []) {
      const first = m.user?.firstName ?? m.firstName ?? "";
      const last = m.user?.lastName ?? m.lastName ?? "";
      const raw = `${first} ${last}`.trim() || m.user?.email || m.email || null;
      const name = raw ? toTitleCase(raw) : null;
      if (!name) continue;
      if (m.id) byMemberId[String(m.id)] = name;
      if (m.user?.id) byUserId[String(m.user.id)] = name;
    }
    return { byMemberId, byUserId };
  }, [members.list]);

  const resolveMemberName = useCallback(
    (tx) => {
      // 1. Try the members list (most reliable — has proper first/last name)
      const mid = tx.member?.id ?? tx.memberId;
      if (mid && memberNameMap.byMemberId[String(mid)])
        return memberNameMap.byMemberId[String(mid)];
      const uid = tx.member?.user?.id ?? tx.user?.id ?? tx.userId;
      if (uid && memberNameMap.byUserId[String(uid)]) return memberNameMap.byUserId[String(uid)];
      // 2. Fall back to whatever name fields the transaction itself carries
      const u = tx.member?.user ?? tx.user ?? tx.payer ?? tx.member ?? {};
      const f = u.firstName ?? tx.firstName ?? "";
      const l = u.lastName ?? tx.lastName ?? "";
      const full = `${f} ${l}`.trim();
      return full ? toTitleCase(full) : null;
    },
    [memberNameMap],
  );

  // ── Filter payments by search ─────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => {
        const name = (resolveMemberName(t) ?? "").toLowerCase();
        const plan = (t.planName ?? t.paymentLink?.title ?? t.description ?? "").toLowerCase();
        const email = (
          t.member?.user?.email ??
          t.user?.email ??
          t.payer?.email ??
          t.member?.email ??
          t.email ??
          ""
        ).toLowerCase();
        return name.includes(q) || plan.includes(q) || email.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return sortDir === "desc" ? tb - ta : ta - tb;
    });
  }, [transactions, search, sortDir, resolveMemberName]);

  // ── Recent activity — real audit-log feed (event/description/actor/result) ──
  const recentActivity = activity.list;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-gray-500">Couldn't load dashboard data. Please refresh.</p>
      </div>
    );
  }

  if (isFreshCommunity) {
    return (
      <>
        <main className="flex-1 px-4 md:px-6 py-5 overflow-y-auto">
          <WelcomeEmptyState
            onCreatePlan={() => setCreatePlanOpen(true)}
            onAddMember={() => setAddMemberOpen(true)}
          />
        </main>

        {/* Add member modal */}
        {addMemberOpen && (
          <AddMemberModal
            communityId={communityId}
            communitySlug={community?.slug}
            onClose={() => setAddMemberOpen(false)}
          />
        )}

        {createPlanOpen && (
          <CreatePlanModal
            communityId={communityId}
            onClose={() => setCreatePlanOpen(false)}
            onCreate={handleCreatePlan}
            creating={createPlan.isPending}
            createError={createPlan.error ? getErrorMessage(createPlan.error) : null}
          />
        )}
      </>
    );
  }

  return (
    <>
      <main className="flex-1 px-4 md:px-6 py-5 overflow-y-auto">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-black">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              A full picture of your community's financial activity.
            </p>
          </div>
          <div data-tour="dashboard-header-actions" className="flex gap-2.5">
            <Button
              variant="outline-neutral"
              size="lg-tight"
              fullWidth={false}
              onClick={() => navigate(`/dashboard/payments?community=${communityId ?? ""}`)}
            >
              Create Payment Plan
            </Button>
            <Button
              variant="primary"
              size="lg-tight"
              fullWidth={false}
              onClick={() => setAddMemberOpen(true)}
            >
              <Plus size={14} /> Add Member
            </Button>
          </div>
        </div>

        {/* "Add Your Phone Number" nudge — only once the admin has left the
            empty state (real members/plans exist), not on first login. */}
        {currentUser && !currentUser.phoneVerified && (
          <button
            onClick={() => navigate(`/dashboard/settings/account/profile?verify=phone`)}
            className="w-full flex items-center justify-between gap-3 text-left bg-brand-mist rounded px-6 py-3 mb-5 border border-hairline cursor-pointer"
          >
            <div>
              <p className="text-sm font-semibold text-brand m-0">Add Your Phone Number</p>
              <p className="text-xs text-brand/80 mt-0.5 mb-0">
                We will use it for payment reminders and account security.
              </p>
            </div>
            <ChevronRight size={18} className="text-brand flex-shrink-0" />
          </button>
        )}

        {/* Getting started checklist — shown until both a plan and members exist */}
        {showGettingStarted && (
          <GettingStartedChecklist
            communityId={communityId}
            hasPlans={gsHasPlans}
            hasMembers={gsHasMembers}
            hasPayoutAccount={gsHasPayoutAccount}
            payoutAccountRejected={gsPayoutAccountRejected}
            payoutAccountPending={gsPayoutAccountPending}
            onDismiss={dismissGs}
            onAddMember={() => setAddMemberOpen(true)}
          />
        )}

        {/* Alert — paying admin with an unpaid obligation */}
        {isPaying && alertVisible && (
          <UnpaidObligationAlert
            myUpcoming={myUpcoming}
            onPayNow={handlePayMine}
            onDismiss={() => setAlertVisible(false)}
            hasActiveAutoPay={hasActiveAutoPay}
          />
        )}

        {/* Stats */}
        <DashboardStats stats={stats} isLoading={isLoading} error={error} />

        {/* Your Payments — paying admin's own dues in this community */}
        {isPaying && (
          <YourPaymentsSection
            rows={myUpcomingFiltered}
            sortDir={myPaymentsSort}
            onToggleSort={() => setMyPaymentsSort((d) => (d === "desc" ? "asc" : "desc"))}
            filter={myPaymentsFilter}
            filterOpen={myPaymentsFilterOpen}
            onToggleFilterOpen={() => setMyPaymentsFilterOpen((o) => !o)}
            onFilterSelect={(key) => {
              setMyPaymentsFilter(key);
              setMyPaymentsFilterOpen(false);
            }}
            onPayNow={handlePayMine}
          />
        )}

        {/* Payment Plans + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
          <PaymentPlansCard
            plans={visiblePlans}
            plansLoading={plansLoading}
            error={plansError}
            onManageAll={() => navigate(`/dashboard/payments?community=${communityId ?? ""}`)}
          />
          <RecentActivityCard
            isLoading={activity.isLoading}
            error={activity.error}
            items={recentActivity}
          />
        </div>

        {/* Member Payments table */}
        <MemberPaymentsSection
          transactions={filteredTransactions}
          isLoading={isLoading}
          error={error}
          search={search}
          onSearchChange={setSearch}
          sortDir={sortDir}
          onToggleSort={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          onExport={() => runExport(() => exportCommunityTransactions(communityId, {}, "CSV"))}
          isExporting={isExporting}
          communityId={communityId}
          resolveMemberName={resolveMemberName}
          community={community}
          onRowClick={(txId) =>
            navigate(`/dashboard/transactions/${txId}?community=${communityId ?? ""}`)
          }
        />
      </main>

      {/* Payment confirmation modal */}
      {payingItem && <AdminPaymentModal item={payingItem} onClose={() => setPayingItem(null)} />}

      {/* Add member modal */}
      {addMemberOpen && (
        <AddMemberModal
          communityId={communityId}
          communitySlug={community?.slug}
          onClose={() => setAddMemberOpen(false)}
        />
      )}
    </>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  // Read communityId from URL ?community= or fall back to localStorage
  const communityId =
    searchParams.get("community") ??
    (() => {
      try {
        return (
          JSON.parse(localStorage.getItem("glass_community") ?? "{}").slug ??
          JSON.parse(localStorage.getItem("glass_community") ?? "{}").id ??
          null
        );
      } catch {
        return null;
      }
    })();

  return <DashboardContent isPaying={false} communityId={communityId} />;
}

export function PayingAdminDashboard() {
  const [searchParams] = useSearchParams();
  const communityId =
    searchParams.get("community") ??
    (() => {
      try {
        return (
          JSON.parse(localStorage.getItem("glass_community") ?? "{}").slug ??
          JSON.parse(localStorage.getItem("glass_community") ?? "{}").id ??
          null
        );
      } catch {
        return null;
      }
    })();

  return <DashboardContent isPaying={true} communityId={communityId} />;
}
