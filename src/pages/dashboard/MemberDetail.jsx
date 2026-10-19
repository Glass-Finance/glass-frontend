import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { UserMinus, Phone, MessageCircle, CreditCard } from "lucide-react";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useMembersWithPayments, useMemberPaymentLinks } from "../../hooks/useMembersWithPayments";
import { useCommunityMembers } from "../../hooks/useCommunityMembers";
import { useCommunity } from "../../hooks/useCommunity";
import ReceiptDownloadButton from "../../components/dashboard/ReceiptDownloadButton";
import { SkeletonTable } from "../../components/common/SkeletonUI";
import EmptyState from "../../components/common/EmptyState";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import StatCard from "../../components/dashboard/StatCard";
import { formatNaira, formatDate } from "../../utils/format";
import { resolveDisplayName, resolveEmail, resolvePhone } from "../../utils/memberName";
import { isSuccessfulStatus, isPaidObligationStatus } from "../../utils/paymentStatus";

const TABS = ["All Plans", "Payment History", "Contact Details"];

// The payment table's columns, defined once and read by both the real <thead>
// and the loading placeholder. Every column is visible at every breakpoint
// here, so the placeholder only needs the count -- but it must come from the
// same list, or adding a column silently leaves the skeleton a column short.
const MEMBER_DETAIL_COLUMNS = ["Plan", "Amount", "Status", "Method", "Date", "Actions"];

const memberName = (m) => resolveDisplayName(m);
const memberEmail = (m) => resolveEmail(m);
const memberPhone = (m) => resolvePhone(m);

function PlanCard({ plan }) {
  const isRecurring = !!plan.recurringPlan;
  const isPaid = isPaidObligationStatus(plan.status);
  return (
    <div className="bg-surface-container rounded-md border border-surface-container-border p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-black pt-0.5">{plan.paymentLink?.title ?? "Plan"}</p>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPaid ? "text-success-strong bg-success-wash" : "text-danger-bright bg-danger-wash-2"}`}
        >
          {isPaid ? "Paid" : "Unpaid"}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-md font-semibold text-gray-900">{formatNaira(plan.amount)}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-accent-purple bg-accent-purple-wash">
          {isRecurring ? (plan.recurringPlan?.frequency ?? "Recurring") : "One-Time"}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        Joined {formatDate(plan.cycleStart)} · Due {formatDate(plan.dueAt)}
      </p>
    </div>
  );
}

export default function MemberDetail() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const communityId = useActiveCommunityId();
  const [tab, setTab] = useState("All Plans");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const { members, isLoading } = useMembersWithPayments(communityId);
  const { removeMember } = useCommunityMembers(communityId);
  const { data: community } = useCommunity(communityId);
  const member = members.find((m) => String(m.id) === String(memberId));
  usePageTitle(member ? memberName(member) : "Member");
  // Audience-aware: only the payment links that actually target this member
  // (ALL_MEMBERS, their group, or explicit selection), unlike planCount on
  // `member` above which assumes every active community plan applies to
  // every member.
  const { paymentLinks: memberPaymentLinks } = useMemberPaymentLinks(communityId, member?.id);

  function handleRemove() {
    if (!member) return;
    setConfirmingRemove(true);
  }

  function confirmRemove() {
    removeMember.mutate(member.id, {
      onSuccess: () => navigate(`/dashboard/members?community=${communityId}`),
    });
  }

  if (isLoading) {
    // Stand a whole placeholder table in rather than a spinner. The real table
    // renders below with the same classes and the same six columns, so the
    // page keeps its shape instead of collapsing to a centred ring and then
    // growing a table into that space.
    return (
      <SkeletonTable
        rows={6}
        columns={MEMBER_DETAIL_COLUMNS.length}
        className="px-4 md:px-6 py-6 h-full"
        tableClassName="w-full text-sm border-collapse"
        headClassName="border-y border-gray-100"
        cellClassName="px-5 py-3"
      />
    );
  }
  if (!member) {
    return (
      <div className="px-4 md:px-6 py-6 h-full">
        <p className="text-xs text-gray-400">Member not found.</p>
      </div>
    );
  }

  const successfulTxs = member.transactions.filter((t) => isSuccessfulStatus(t.status));
  const totalPaid = successfulTxs.reduce((sum, t) => sum + (t.amount ?? t.amountPaid ?? 0), 0);

  // Distinct plans (one card per payment link, latest obligation for that
  // link). Obligations carry the per-cycle amount/due-date/paid-status. An
  // active link without an obligation is shown as pending until the backend
  // creates the authoritative obligation record.
  const obligationsByLinkId = new Map(member.obligations.map((o) => [o.paymentLink?.id, o]));
  const syntheticPlans = memberPaymentLinks
    .filter(
      (link) => (link.status ?? "").toUpperCase() === "ACTIVE" && !obligationsByLinkId.has(link.id),
    )
    .map((link) => ({
      id: link.id,
      paymentLink: { id: link.id, title: link.title },
      amount: link.amount,
      status: undefined,
      recurringPlan: link.recurringPlan,
      cycleStart: link.startAt,
      dueAt: link.dueAt,
    }));
  const distinctPlans = [...obligationsByLinkId.values(), ...syntheticPlans];

  return (
    <div className="px-4 md:px-6 py-6 overflow-y-auto h-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-black">
            <Button
              variant="tertiary"
              size="sm"
              fullWidth={false}
              onClick={() => navigate(`/dashboard/members?community=${communityId}`)}
            >
              Members
            </Button>
            <span className="text-gray-300 mx-1">›</span> {memberName(member)}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            A full picture of the members of your community
          </p>
        </div>
        <Button
          onClick={handleRemove}
          loading={removeMember.isPending}
          fullWidth={false}
          variant="critical"
          size="sm"
        >
          <UserMinus size={14} /> Remove Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Amount Paid" value={formatNaira(totalPaid)} />
        <StatCard label="Active Plans" value={String(distinctPlans.length)} />
        <StatCard label="Plans Yet to pay" value={String(member.totalCount - member.paidCount)} />
        <StatCard label="Failed Payments" value={String(member.failedCount)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-stacked-container rounded-md p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-[13px] rounded transition-all cursor-pointer border-none font-medium ${tab === t ? "bg-white text-gray-900 shadow-sm" : "bg-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "All Plans" &&
        (distinctPlans.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No plans assigned yet"
            subtitle="This member isn't enrolled in any payment plans in this community yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {distinctPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        ))}

      {tab === "Payment History" && (
        <div className="bg-surface-container rounded-xl border border-surface-container-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-black">Member Payments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-y border-gray-100">
                  {MEMBER_DETAIL_COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {member.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="border-2 border-dashed border-gray-200 rounded-lg py-3 px-3 text-center">
                        <span className="text-xs text-gray-400">
                          No payments yet — this member's payment history will show up here once
                          they make their first payment.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  member.transactions.map((t) => {
                    const statusLabel =
                      (t.status ?? "pending").charAt(0).toUpperCase() +
                      (t.status ?? "pending").slice(1).toLowerCase();
                    const isPaid = ["success", "successful", "paid"].includes(
                      statusLabel.toLowerCase(),
                    );
                    return (
                      <tr
                        key={t.id}
                        onClick={() =>
                          navigate(`/dashboard/transactions/${t.id}?community=${communityId}`)
                        }
                        className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3 text-sm font-medium text-black">
                          {t.paymentLink?.title ?? t.description ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">
                          {formatNaira(t.amount)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPaid ? "text-success-strong bg-success-wash" : "text-danger bg-danger-wash-2"}`}
                          >
                            {isPaid ? "Paid" : statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">{t.channel ?? "—"}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">
                          {formatDate(t.paidAt ?? t.createdAt)}
                        </td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <ReceiptDownloadButton
                            tx={{
                              amount: t.amount,
                              description: t.paymentLink?.title ?? t.description,
                              communityName: community?.name,
                              communityLogo: community?.logo,
                              date: t.paidAt ?? t.createdAt,
                              channel: t.channel,
                              reference: t.internalReference ?? t.id,
                              status: t.status,
                              payerPhoto:
                                member?.profileImage?.url ??
                                t.member?.profileImage?.url ??
                                t.user?.profileImage?.url ??
                                null,
                              // No dedicated fee field on the transaction
                              // record -- derived the same way
                              // PaymentSummary.jsx's confirmed "Platform
                              // Fee" row is (billedAmount minus amount).
                              feeMinor:
                                t.feeMinor ??
                                t.fee ??
                                (t.amountPaid != null && t.amount != null && t.amountPaid > t.amount
                                  ? t.amountPaid - t.amount
                                  : null),
                            }}
                            payerName={memberName(member)}
                            payerEmail={memberEmail(member)}
                            disabled={!isPaid}
                            iconSize={11}
                            title={
                              isPaid
                                ? "Download receipt"
                                : "Receipts are only available for successful payments"
                            }
                            buttonClassName={`w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center ${isPaid ? "text-gray-500 hover:bg-gray-50 cursor-pointer" : "text-gray-300 cursor-not-allowed"}`}
                          />
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

      {tab === "Contact Details" && (
        <div className="bg-surface-container rounded-xl border border-surface-container-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-y border-gray-100">
                  {["Name", "Phone", "Email", "Date Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-5 py-3 text-sm font-semibold text-brand">
                    {memberName(member)}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{memberPhone(member)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{memberEmail(member)}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {formatDate(member.joinedAt ?? member.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <a
                        href={`tel:${memberPhone(member)}`}
                        title="Call"
                        aria-label="Call"
                        className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        <Phone size={11} />
                      </a>
                      <a
                        href={`mailto:${memberEmail(member)}`}
                        title="Message"
                        aria-label="Message"
                        className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        <MessageCircle size={11} />
                      </a>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title="Remove Member"
          subtitle={memberEmail(member)}
          description={`This removes ${memberName(member)} from this community. They'll lose access to community payment plans and dashboard data tied to this community; this can't be undone.`}
          confirmLabel="Remove"
          confirmingLabel="Removing…"
          confirming={removeMember.isPending}
          onClose={() => setConfirmingRemove(false)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}
