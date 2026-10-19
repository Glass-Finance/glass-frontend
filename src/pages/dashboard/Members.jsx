import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  RotateCcw,
  UserMinus,
  X,
  Users,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  UserCheck,
  ChevronRight,
  Download,
} from "lucide-react";
import EmptyState from "../../components/common/EmptyState";
import addMembersIllustration from "../../assets/dashboard/empty-states/add-members-illustration.webp";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useCommunity } from "../../hooks/useCommunity";
import { APP_ORIGIN } from "../../utils/deviceRedirect";
import { useMembersWithPayments } from "../../hooks/useMembersWithPayments";
import { useCommunityMembers, useRoles } from "../../hooks/useCommunityMembers";
import { useJoinRequests, requesterOf, requestStatusOf } from "../../hooks/useJoinRequests";
import { getErrorMessage } from "../../utils/errorHandler";
import { exportCommunityObligations } from "../../api/exports";
import { useExportJob } from "../../hooks/useExportJob";
import { SkeletonTableRows } from "../../components/common/SkeletonUI";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import KycStateBadge from "../../components/dashboard/KycStateBadge";
import StatCard from "../../components/dashboard/StatCard";
import { formatDate } from "../../utils/format";
import { resolveDisplayName, resolveEmail } from "../../utils/memberName";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { roleKeyword, isCommunityAdmin } from "../../utils/communityRole";
import { useKycGate } from "../../hooks/useKycGate";
import { isKycGatedCommunityRequestError } from "../../utils/kycStatus";
import CommunityStaffKycNotice from "../../components/dashboard/CommunityStaffKycNotice";
import KycWizardModal from "../../components/kyc/KycWizardModal";
import { QuickAddMemberModal } from "./MembersSections";

// Only these three roles should be assignable when inviting members.
const ALLOWED_ROLE_NAMES = new Set(["Community Owner", "Community Admin", "Community Member"]);

const FALLBACK_ROLES = [
  { id: "COMMUNITY_OWNER", name: "Community Owner" },
  { id: "COMMUNITY_ADMIN", name: "Community Admin" },
  { id: "COMMUNITY_MEMBER", name: "Community Member" },
];

const SORT_OPTIONS = ["Recently Paid", "Name A-Z", "Date Joined"];

// Column visibility for the members table, defined once and read by BOTH the
// <thead> and the loading skeleton. They have to agree: a column hidden in the
// header but still rendered by the placeholder would keep a cell in a row whose
// column no longer exists, and the table would overflow on a phone.
//
// xl, not lg, for the last two: lg (1024px) is exactly where the sidebar
// already leaves the least room, and revealing the columns there squeezed
// member names and dates onto two lines and pushed Actions out of the row
// rather than scrolling.
const MEMBER_COLUMN_LABELS = [
  "Members",
  "Plans",
  "Status",
  "Date",
  "Email",
  "Date Joined",
  "Actions",
];
const MEMBER_COLUMNS = [
  "hidden sm:table-cell px-5 py-2.5 w-8", // 0: select-all checkbox
  "px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 1: Members
  "px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 2: Plans
  "px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 3: Status
  "hidden md:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 4: Date
  "hidden xl:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 5: Email
  "hidden xl:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 6: Date Joined
  "hidden sm:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap", // 7: Actions
];

const memberName = (m) => resolveDisplayName(m);
const memberEmail = (m) => resolveEmail(m);
// Shared with AuthContext's hasAdminCommunity check — the single
// backend-derived definition of "administers this community".
const isAdminRole = (m) => isCommunityAdmin(m);

function statusStyle(paid, total) {
  if (total === 0) return "bg-[#f5f6fa] text-ink-muted";
  if (paid === total) return "bg-success-wash text-success-strong";
  if (paid === 0) return "bg-danger-wash-2 text-danger-bright";
  return "bg-warning-wash text-warning";
}
function FilterPanel({ planOptions, filters, onApply, onClose }) {
  const [plan, setPlan] = useState(filters.plan ?? "");
  const [status, setStatus] = useState(filters.status ?? "");
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 bg-white rounded-xl border border-surface-container-border shadow-lg z-20 p-4 w-64">
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:border-[#002FA7] transition-colors"
            >
              <option value="">All plans</option>
              {planOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:border-[#002FA7] transition-colors"
            >
              <option value="">All statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
          <Button
            variant="primary"
            size="xs"
            fullWidth={false}
            onClick={() => {
              onApply({ plan, status });
              onClose();
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}

export default function Members() {
  usePageTitle("Members");
  const navigate = useNavigate();
  const communityId = useActiveCommunityId();
  const { data: community } = useCommunity(communityId);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ plan: "", status: "" });
  const [sort, setSort] = useState("Recently Paid");
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [removingMember, setRemovingMember] = useState(null);

  const { members, obligations, isLoading, error } = useMembersWithPayments(communityId);
  const { inviteMember, removeMember } = useCommunityMembers(communityId);
  // Summary only — approving/rejecting (with full requester detail) lives on
  // the Join Requests page, so the review logic exists in exactly one place.
  const { requests: allJoinRequests } = useJoinRequests(communityId);
  const pendingJoinRequests = allJoinRequests.filter((r) => requestStatusOf(r) === "PENDING");
  const { data: rolesData } = useRoles();

  // A community staff member whose KYC isn't approved is downgraded to
  // COMMUNITY_MEMBER permissions server-side, so the members request 403s even
  // though their role is correct -- with the generic
  // "Community permission is required: community.members.read". Name the real
  // blocker, but only once the KYC status is actually known, so a 403 from any
  // other cause (or during a summary outage) still falls through to the
  // existing generic error. Not enforced on load: this states the situation
  // rather than blocking the page.
  const kycGate = useKycGate();
  const kycGated = isKycGatedCommunityRequestError(error, kycGate.status, {
    isLoading: kycGate.isLoading,
    isError: kycGate.isError,
    exempt: kycGate.exempt,
  });

  // The notice's "Start/Continue verification" action opens the same
  // KycWizardModal CommunitiesHome and MyCommunities use — one verification
  // flow, not a second. The modal's own useKycFlow owns the steps, the bounded
  // status polling and the errors; this page only provides a way in, a way out
  // and a resume.
  const queryClient = useQueryClient();
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  // Dismissal never resumes: closing just puts the notice back.
  const closeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.closeGate();
  };
  // onComplete fires only on an APPROVED outcome (useKycFlow), so this is the
  // one path where the account's community permissions have actually changed.
  //
  // The community queries MUST be invalidated here. The KYC flow only
  // invalidates its own ["kyc", ...] keys, so without this the members request
  // would keep serving the pre-approval 403 (staleTime is 2 min) and the page
  // would drop out of the KYC branch into the generic "Couldn't load members."
  // error — verifying would appear to break the page. Invalidating the
  // ["community", communityId] prefix is the established scope here
  // (useCommunity.js, useInitiatePayment.js do the same).
  const completeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.completeGate();
    queryClient.invalidateQueries({ queryKey: ["community", communityId] });
  };

  const filteredRoles = rolesData ? rolesData.filter((r) => ALLOWED_ROLE_NAMES.has(r.name)) : [];
  const usingFallbackRoles = !filteredRoles.length;
  const roles = usingFallbackRoles ? FALLBACK_ROLES : filteredRoles;

  // A standalone way to grab the invite link directly from this page --
  // previously it only ever surfaced as a side effect of the Add Member
  // modal's "this email isn't registered yet" state, so sharing the link
  // broadly (e.g. posting it in a group chat) had no direct path.
  const inviteLink =
    community?.slug || communityId
      ? `${APP_ORIGIN}/member/join?community=${community?.slug || communityId}`
      : null;
  const [linkCopied, copyInviteLinkText] = useCopyToClipboard();

  const planOptions = useMemo(
    () => [...new Set(obligations.map((o) => o.paymentLink?.title).filter(Boolean))],
    [obligations],
  );

  const filtered = useMemo(() => {
    let list = members.filter(
      (m) =>
        memberName(m).toLowerCase().includes(search.toLowerCase()) ||
        memberEmail(m).toLowerCase().includes(search.toLowerCase()),
    );
    if (filters.plan) {
      list = list.filter((m) => m.obligations.some((o) => o.paymentLink?.title === filters.plan));
    }
    if (filters.status) {
      list = list.filter((m) => {
        if (filters.status === "Paid") return m.totalCount > 0 && m.paidCount === m.totalCount;
        if (filters.status === "Unpaid") return m.paidCount === 0;
        return m.paidCount > 0 && m.paidCount < m.totalCount;
      });
    }
    const sorted = [...list];
    if (sort === "Name A-Z") sorted.sort((a, b) => memberName(a).localeCompare(memberName(b)));
    else if (sort === "Date Joined")
      sorted.sort(
        (a, b) =>
          new Date(b.joinedAt ?? b.createdAt ?? 0) - new Date(a.joinedAt ?? a.createdAt ?? 0),
      );
    else sorted.sort((a, b) => new Date(b.lastPaymentDate ?? 0) - new Date(a.lastPaymentDate ?? 0));
    return sorted;
  }, [members, search, filters, sort]);

  // The owner's own membership row already exists the moment the community
  // is created (see AdminDashboard.jsx's gsHasMembers, same reasoning) --
  // counting it made this page show the stats+table view for a
  // brand-new community with zero real members instead of the empty state.
  const hasRealMembers = members.some((m) => roleKeyword(m.roleCode, m.role) !== "OWNER");
  // Per the Figma empty state, the page header (title + Copy Invite
  // Link/Add Member) doesn't show at all when there are no real members --
  // EmptyState is a self-contained full screen with its own action button,
  // not a strip below a normal page header.
  const isEmpty = !isLoading && !error && !hasRealMembers;

  const stats = {
    total: members.length,
    active: members.filter((m) => (m.status ?? "ACTIVE").toUpperCase() === "ACTIVE").length,
    inactive: members.filter((m) => (m.status ?? "").toUpperCase() === "INACTIVE").length,
    admins: members.filter(isAdminRole).length,
  };

  async function handleAdd(payload) {
    try {
      await inviteMember.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }

  function handleRemove(member) {
    setRemovingMember(member);
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Real backend export job (see useExportJob.js) instead of a client-side
  // CSV -- that silently capped at whatever page of members was already
  // loaded. Obligations (every member's dues across every plan) is the
  // closest backend export to a member-payments list; there's no
  // dedicated "members" export endpoint. This always exports the whole
  // community rather than just the current search/selection subset, since
  // the export job has no way to filter by an arbitrary client-side
  // member-id list.
  const { run: runExport, isExporting } = useExportJob();
  function exportCsv() {
    runExport(() => exportCommunityObligations(communityId, {}, "CSV"));
  }

  const activeChips = [
    filters.plan ? { key: "plan", label: filters.plan } : null,
    filters.status ? { key: "status", label: filters.status } : null,
  ].filter(Boolean);

  return (
    <div className="px-4 md:px-6 py-6 overflow-y-auto h-full">
      {/* flex-wrap -- matches AdminDashboard.jsx/Payments.jsx's same header
          pattern. Without it, the heading+subtitle block and the two
          action buttons were forced into one unbreakable row, which had
          nowhere to go on a narrow screen (the buttons don't shrink, and
          the subtitle has no truncation either). */}
      {!isEmpty && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-black">Members</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              A full picture of the members of your community
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inviteLink && (
              <Button
                variant="outline-neutral"
                size="xs"
                fullWidth={false}
                onClick={() => copyInviteLinkText(inviteLink)}
                title={inviteLink}
              >
                {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                {linkCopied ? "Copied!" : "Copy Invite Link"}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm-tight"
              fullWidth={false}
              onClick={() => setModalOpen(true)}
            >
              <Plus size={13} /> Add Member
            </Button>
          </div>
        </div>
      )}

      {/* Pending join requests — compact summary; the full review flow
          (requester details, approve/reject) lives on the Join Requests page. */}
      {pendingJoinRequests.length > 0 &&
        (() => {
          const names = pendingJoinRequests.slice(0, 3).map((r) => requesterOf(r).name);
          const extra = pendingJoinRequests.length - names.length;
          const preview =
            names.join(", ") + (extra > 0 ? ` and ${extra} other${extra === 1 ? "" : "s"}` : "");
          return (
            <button
              onClick={() => navigate("/dashboard/join-requests")}
              className="w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl border border-amber-100 mb-5 text-left cursor-pointer bg-warning-wash"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Clock size={15} className="flex-shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold m-0 text-warning">
                    {pendingJoinRequests.length} pending join{" "}
                    {pendingJoinRequests.length === 1 ? "request" : "requests"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 m-0 truncate">{preview}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-brand flex-shrink-0">
                Review <ChevronRight size={13} />
              </span>
            </button>
          );
        })()}

      {/* Empty state — shown instead of stats + table when community has no members yet */}
      {isEmpty && (
        <EmptyState
          illustration={addMembersIllustration}
          title="No members yet."
          subtitle="Invite your first members via link, CSV upload, or manually."
          action={() => setModalOpen(true)}
          actionLabel={
            <>
              <Plus size={14} /> Add Members
            </>
          }
        />
      )}

      {/* Stats — hidden only for the true empty state (isEmpty), not just
          "no real members yet" (hasRealMembers) -- those aren't the same
          thing while a fetch is loading or has errored, and gating on
          hasRealMembers alone left a dead zone: isEmpty requires !isLoading
          && !error, so a stuck-loading or errored fetch made isEmpty false
          (showing the header) while hasRealMembers was also false (hiding
          stats/table), rendering neither the real content nor the empty
          state -- just blank space over the page background. auto-fit/minmax
          rather than a fixed 2/lg:4 breakpoint -- see DashboardStats.jsx for why. */}
      {!isEmpty && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 mb-5">
          <StatCard
            icon={Users}
            label="Total Members"
            value={String(stats.total)}
            iconCls="text-brand bg-brand-tint"
          />
          <StatCard
            icon={UserCheck}
            label="Active Members"
            value={String(stats.active)}
            iconCls="text-success bg-success-tint"
          />
          <StatCard
            icon={Clock}
            label="Inactive"
            value={String(stats.inactive)}
            iconCls="text-warning bg-warning-wash"
          />
          <StatCard
            icon={ShieldCheck}
            label="Admins"
            value={String(stats.admins)}
            iconCls="text-accent-purple bg-accent-purple-wash"
          />
        </div>
      )}

      {!isEmpty && (
        <div className="bg-surface-container rounded-xl border border-surface-container-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-black">Member Payments</span>
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={exportCsv}
              disabled={isExporting}
            >
              <Download size={13} /> {isExporting ? "Exporting…" : "Export Csv"}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 pb-3 gap-2">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-surface-container-border w-full sm:flex-1 sm:min-w-0 sm:max-w-xs focus-within:border-[#002FA7] transition-colors">
              <Search size={12} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="relative">
                <Button
                  variant="outline-neutral"
                  size="xs"
                  fullWidth={false}
                  onClick={() => setFilterOpen((o) => !o)}
                >
                  <Filter size={12} /> Filter
                </Button>
                {filterOpen && (
                  <FilterPanel
                    planOptions={planOptions}
                    filters={filters}
                    onApply={setFilters}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>
              <div className="relative">
                <Button
                  variant="outline-neutral"
                  size="xs"
                  fullWidth={false}
                  onClick={() => setSortOpen((o) => !o)}
                >
                  Sort by: {sort} <ChevronDown size={11} />
                </Button>
                {sortOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-surface-container-border shadow-lg z-20 overflow-hidden min-w-[150px]">
                      {SORT_OPTIONS.map((o) => (
                        <button
                          key={o}
                          onClick={() => {
                            setSort(o);
                            setSortOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex items-center gap-2 px-5 pb-3">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stacked-container text-xs text-ink-muted"
                >
                  {chip.label}
                  <Button
                    variant="tertiary"
                    size="icon-sm"
                    onClick={() => setFilters((f) => ({ ...f, [chip.key]: "" }))}
                    aria-label="Remove filter"
                  >
                    <X size={10} />
                  </Button>
                </span>
              ))}
              <Button
                variant="tertiary"
                size="xs"
                fullWidth={false}
                onClick={() => setFilters({ plan: "", status: "" })}
              >
                Clear All
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-y border-gray-100 bg-surface-bg">
                  {/*
                    Column visibility, defined once. The <th> below and the
                    loading placeholder both read this list, so a column can
                    never be hidden in the header and still occupy space in the
                    skeleton (which would overflow the table on a phone).
                    xl, not lg, for the two extra columns: lg (1024px) is
                    exactly where the sidebar already leaves the least room, and
                    revealing them there squeezed member names onto two lines
                    and pushed Actions out of the row instead of scrolling.
                  */}
                  <th className={MEMBER_COLUMNS[0]}>
                    <input
                      type="checkbox"
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? filtered.map((m) => m.id) : [])
                      }
                    />
                  </th>
                  {MEMBER_COLUMN_LABELS.map((label, i) => (
                    <th key={label} className={MEMBER_COLUMNS[i + 1]}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // Placeholder rows in the real tbody, so the columns the
                  // header has already drawn keep their widths and the real
                  // rows do not jump sideways when they arrive. MEMBER_COLUMNS
                  // is the single list both this and the <thead> read, so a
                  // column cannot be hidden at one and shown at the other.
                  <SkeletonTableRows rows={8} columns={MEMBER_COLUMNS} />
                ) : kycGated ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6">
                      <CommunityStaffKycNotice
                        status={kycGate.status}
                        subject="your members list"
                        onVerify={() => setKycWizardOpen(true)}
                      />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-xs text-danger">
                      Couldn't load members.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-xs text-gray-400">
                      No members found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const s = statusStyle(m.paidCount, m.totalCount);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                      >
                        <td className="hidden sm:table-cell px-5 py-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(m.id)}
                            onChange={() => toggleSelect(m.id)}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="tertiary"
                              size="xs"
                              fullWidth={false}
                              onClick={() =>
                                navigate(`/dashboard/members/${m.id}?community=${communityId}`)
                              }
                            >
                              {memberName(m)}
                            </Button>
                            {/* Verification completion — admin-facing only;
                                renders nothing until the member DTO carries
                                kycStatus (docs/kyc.md). */}
                            <KycStateBadge status={m.kycStatus} />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">{m.planCount}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s}`}>
                            {m.paidCount}/{m.totalCount} Paid
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-xs text-gray-500">
                          {formatDate(m.lastPaymentDate)}
                        </td>
                        <td className="hidden xl:table-cell px-5 py-3 text-xs text-gray-500">
                          {memberEmail(m)}
                        </td>
                        <td className="hidden xl:table-cell px-5 py-3 text-xs text-gray-500">
                          {formatDate(m.joinedAt ?? m.createdAt)}
                        </td>
                        <td className="hidden sm:table-cell px-5 py-3">
                          <div className="flex gap-1.5">
                            <Button
                              variant="tertiary"
                              size="icon-sm"
                              disabled
                              title="Resend reminder — coming soon"
                              aria-label="Resend reminder — coming soon"
                            >
                              <RotateCcw size={11} />
                            </Button>
                            <Button
                              variant="tertiary"
                              size="icon-sm"
                              aria-label="Remove member"
                              onClick={() => handleRemove(m)}
                              title="Remove member"
                              className=""
                            >
                              <UserMinus size={11} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <QuickAddMemberModal
          onClose={() => setModalOpen(false)}
          onAdd={handleAdd}
          adding={inviteMember.isPending}
          error={inviteMember.error ? getErrorMessage(inviteMember.error) : null}
          roles={roles}
          rolesUnavailable={usingFallbackRoles}
          inviteLink={
            community?.slug || communityId
              ? `${APP_ORIGIN}/member/join?community=${community?.slug || communityId}`
              : null
          }
        />
      )}

      {removingMember && (
        <ConfirmDialog
          title="Remove Member"
          subtitle={memberEmail(removingMember)}
          description={`This removes ${memberName(removingMember)} from this community. They'll lose access to community payment plans and dashboard data tied to this community; this can't be undone.`}
          confirmLabel="Remove"
          confirmingLabel="Removing…"
          confirming={removeMember.isPending}
          onClose={() => setRemovingMember(null)}
          onConfirm={() =>
            removeMember.mutate(removingMember.id, {
              onSuccess: () => setRemovingMember(null),
            })
          }
        />
      )}

      {/* `kycGate.gateOpen` is OR'd in so a gate opened by enforce() elsewhere
          still drives this modal — the same shape CommunitiesHome uses. */}
      <KycWizardModal
        open={kycWizardOpen || kycGate.gateOpen}
        onClose={closeKycWizard}
        onComplete={completeKycWizard}
        historyPath="/dashboard/verify-identity/history"
      />
    </div>
  );
}
