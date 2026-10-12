import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import { fetchAllCommunityMembers } from "../api/communities";
import { fetchAllCommunityObligations } from "../api/transactions";
import { isSuccessfulStatus } from "../utils/paymentStatus";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/communities/{communityIdentifier}
// Already includes `metrics` — totalMembers, inactiveMembers, collectedAmount,
// outstandingAmount, activePaymentLinks, activeRecurringPlans — no separate
// balances or members-count call needed for the dashboard stat cards.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCommunity(id) {
  const res = await client.get(`/communities/${id}`);
  return res.data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/communities/{communityIdentifier}/members
// Full member list — used for the Member Payments table and the "Applies To"
// count in the Create Payment Plan modal.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMembers(id) {
  // fetchAllCommunityMembers defaults to status=ACTIVE — the raw endpoint
  // includes soft-deleted members and inflates the count. It now paginates
  // across every backend page (pageSize:200, 1-based pageNumber), so `id` here
  // resolves to a complete ACTIVE roster rather than a single default-sized
  // page. See src/api/communities.js for the termination rules.
  return fetchAllCommunityMembers(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/communities/{communityIdentifier}/activity
// Real audit-log feed (event/description/actor/result/occurredAt) — replaces
// deriving "recent activity" from the first few transactions, which only
// ever showed payments and never member joins, reminders, etc.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchActivity(id) {
  const res = await client.get(`/communities/${id}/activity`, { params: { pageSize: 6 } });
  return res.data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/communities/{communityIdentifier}/finance/transactions
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTransactions(id) {
  // Paginated server-side — request a large page so the "Recent Activity"
  // sort below isn't silently working off a single default-sized page.
  const res = await client.get(`/communities/${id}/finance/transactions`, {
    params: { pageSize: 1000 },
  });
  return res.data.data;
}

/**
 * useCommunityDashboard
 * Fetches everything the admin dashboard needs, in parallel.
 * communityId — the slug or UUID of the selected community.
 */
export function useCommunityDashboard(communityId) {
  const enabled = !!communityId;

  // ── Community detail — gives us metrics in one call ─────────────────────────
  const communityQuery = useQuery({
    queryKey: ["community", communityId],
    queryFn: () => fetchCommunity(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: "always",
  });

  // ── Members list — for the table, not just the count ────────────────────────
  // "members", "all" sub-key avoids cache collision with useCommunityMembers /
  // useMembersWithPayments, whose queryFns return a pre-unwrapped flat array
  // while this one returns raw res.data.data — mixing them breaks .map() on
  // the Members page when navigating from the dashboard without a reload.
  const membersQuery = useQuery({
    queryKey: ["community", communityId, "members", "all"],
    queryFn: () => fetchMembers(communityId),
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnMount: "always",
    select: (data) => {
      const list = Array.isArray(data) ? data : (data?.content ?? data?.members ?? []);
      return list;
    },
  });

  // ── Transactions ──────────────────────────────────────────────────────────────
  // Same cache-isolation reason as members above — useMembersWithPayments also
  // uses ["community", communityId, "transactions"] with a different raw shape.
  const transactionsQuery = useQuery({
    queryKey: ["community", communityId, "transactions", "all"],
    queryFn: () => fetchTransactions(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: "always",
    select: (data) => {
      const list = Array.isArray(data) ? data : (data?.content ?? data?.transactions ?? []);
      return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
  });

  // ── Obligations — used to compute per-plan paid counts on the dashboard.
  // Shares the ["community", communityId, "obligations"] key with
  // useMembersWithPayments so the cache is reused when Members page was visited.
  const obligationsQuery = useQuery({
    queryKey: ["community", communityId, "obligations"],
    queryFn: () => fetchAllCommunityObligations(communityId),
    enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  // ── Activity feed — separate from the rest so its skeleton doesn't wait
  // on members/transactions, and a failure here doesn't blank the page ──────
  const activityQuery = useQuery({
    queryKey: ["community", communityId, "activity"],
    queryFn: () => fetchActivity(communityId),
    enabled,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    select: (data) => data?.content ?? [],
  });

  const isLoading =
    communityQuery.isLoading || membersQuery.isLoading || transactionsQuery.isLoading;

  const error = communityQuery.error || membersQuery.error || transactionsQuery.error;

  // ── Stat-card friendly shape, pulled straight from community.metrics ────────
  const metrics = communityQuery.data?.metrics ?? {};

  // Client-side "total contributions" computed from the successful transactions
  // in this community's transaction list (same SUCCESS/SUCCESSFUL/PAID filter as
  // useCommunitiesWithMetrics).
  //
  // HISTORY: this was justified by a backend metric that "only tracks
  // settlements and returns 0 even after payments". That explanation is OBSOLETE
  // and should not be carried forward. metrics.collectedAmount now covers
  // obligations PLUS unallocated successful payment-link transactions; it never
  // counted settlements, which live in a separate table.
  //
  // WHY IT STILL COMPUTES HERE: this dashboard derives the stat card from the
  // transaction list it already loads, so it reads from that list rather than
  // metrics.collectedAmount. That is the current wiring, not a claim that the
  // list is the better source. metrics.collectedAmount is a server-side
  // aggregate with no page limit.
  //
  // CAVEAT: the transaction fetch is a single page (pageSize:1000), so with more
  // than 1000 transactions this sum can UNDERCOUNT by dropping the oldest rows.
  //
  // Deliberately left as-is. No claim is made here that this query is safe to
  // remove, and metrics.collectedAmount has NOT been production-compared against
  // this computed value. See src/hooks/useCommunities.js and
  // src/api/transactions.js for the same caveat on the communities home view.
  const computedCollected = (transactionsQuery.data ?? [])
    .filter((t) => isSuccessfulStatus(t.status))
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const balances = {
    totalContributions: computedCollected,
    outstanding: metrics.outstandingAmount ?? 0,
    currency: metrics.currency ?? "NGN",
  };

  const members = {
    list: membersQuery.data ?? [],
    // ACTIVE count, from metrics.activeMembers — an authoritative server-side
    // COUNT over ACTIVE rows, with no page limit. The previous source,
    // `membersQuery.data.length`, came from a single un-paginated request that
    // inherited the backend's default pageSize of 10, so it reported 10 for
    // every larger community. The old comment justified preferring the list
    // count because "metrics can lag after member deletions" — that reasoning
    // applies to metrics.totalMembers (active + inactive + suspended + exited,
    // which counts EXITED members and is therefore inflated), but NOT to
    // activeMembers, where a removed member is EXITED and simply excluded.
    // The list length remains the fallback if the detail request failed.
    total: metrics.activeMembers ?? (membersQuery.data != null ? membersQuery.data.length : 0),
    inactive: metrics.inactiveMembers ?? 0,
    overdue: metrics.overdueMembers ?? 0,
  };

  return {
    community: communityQuery.data,
    balances,
    members,
    transactions: transactionsQuery.data ?? [],
    obligations: obligationsQuery.data ?? [],
    activity: {
      list: activityQuery.data ?? [],
      isLoading: activityQuery.isLoading,
      // Exposed so the Recent Activity card can tell "the request failed"
      // apart from "the community has no activity yet" -- the query resolves
      // to an empty array either way. Passed through only; the query is
      // unchanged.
      error: activityQuery.error,
    },
    isLoading,
    error,
    queries: {
      community: communityQuery,
      members: membersQuery,
      transactions: transactionsQuery,
      activity: activityQuery,
    },
  };
}
