import { useQuery } from "@tanstack/react-query";
import { fetchAllCommunityMembers } from "../api/communities";
import { fetchAllCommunityObligations, fetchAllCommunityTransactions } from "../api/transactions";
import { getCommunityPaymentLinks } from "../api/payments";

function unwrapList(res) {
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  return data?.content ?? [];
}

function memberIdsMatch(member, ref) {
  if (!ref) return false;
  const refId = ref.id ?? ref;
  const mUid = member.user?.id;
  const rUid = ref.user?.id;
  return (
    member.id === refId ||
    (mUid != null && mUid === refId) ||
    // Only match by user-id pair when both sides actually have one —
    // undefined === undefined would silently match every member
    (mUid != null && rUid != null && mUid === rUid)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member-list stats own all aggregate counts. Financial lists are retained
// only for plan filtering, payment history, and last-payment dates; a paged
// list must never override the server aggregates.
// ─────────────────────────────────────────────────────────────────────────────
export function useMembersWithPayments(communityId) {
  const enabled = !!communityId;

  const membersQuery = useQuery({
    queryKey: ["community", communityId, "members"],
    queryFn: () => fetchAllCommunityMembers(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const obligationsQuery = useQuery({
    queryKey: ["community", communityId, "obligations"],
    queryFn: () => fetchAllCommunityObligations(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const transactionsQuery = useQuery({
    queryKey: ["community", communityId, "transactions"],
    queryFn: () => fetchAllCommunityTransactions(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const members = membersQuery.data ?? [];
  const obligations = obligationsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];
  const enriched = members.map((member) => {
    const memberObligations = obligations.filter((o) => memberIdsMatch(member, o.member ?? o.user));
    const memberTransactions = transactions
      .filter((t) => memberIdsMatch(member, t.member ?? t.user))
      .sort(
        (a, b) => new Date(b.paidAt ?? b.createdAt ?? 0) - new Date(a.paidAt ?? a.createdAt ?? 0),
      );

    return {
      ...member,
      planCount: member.stats?.totalObligationPaymentLinkCount ?? null,
      paidCount: member.stats?.paidObligationPaymentLinkCount ?? null,
      totalCount: member.stats?.totalObligationPaymentLinkCount ?? null,
      failedCount: member.stats?.failedPaymentTransactionCount ?? null,
      lastPaymentDate: memberTransactions[0]?.paidAt ?? memberTransactions[0]?.createdAt ?? null,
      obligations: memberObligations,
      transactions: memberTransactions,
    };
  });

  return {
    members: enriched,
    obligations,
    transactions,
    isLoading: membersQuery.isLoading || obligationsQuery.isLoading || transactionsQuery.isLoading,
    // Gated on "no data at all", not just "error is set" -- same fix as
    // usePayments.js's Home/Upcoming flicker: React Query keeps a query's
    // last-good data around through a failed background refetch, it
    // doesn't clear it. Surfacing the error unconditionally meant a single
    // transient failure (even after the automatic retry) could blank out
    // an already-successfully-loaded members table.
    error:
      (membersQuery.error && !membersQuery.data) ||
      (obligationsQuery.error && !obligationsQuery.data) ||
      (transactionsQuery.error && !transactionsQuery.data) ||
      null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The payment links that actually target one specific member — audience-aware
// (ALL_MEMBERS, their group, or explicit selection), via the backend's
// memberId filter on GET .../payment-links. Used on MemberDetail.jsx instead
// of financial history, so obligations cannot add unassigned plans to that tab.
export function useMemberPaymentLinks(communityId, memberId) {
  const enabled = !!communityId && !!memberId;
  const query = useQuery({
    queryKey: ["community", communityId, "payment-links", "member", memberId],
    queryFn: async () => unwrapList(await getCommunityPaymentLinks(communityId, { memberId })),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
  return {
    paymentLinks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
