import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyObligations, getMe } from "../../api/members";
import { useMyCommunities } from "../useMyAccount";
import { unwrapList, deriveStatus, fetchMyTransactions } from "./helpers";
import { shapeObligation, normalizeCommunity } from "./shape";
import { isPaidObligationStatus } from "../../utils/paymentStatus";

// ─────────────────────────────────────────────────────────────────────────────
// Main hook — Home screen data
// Returns: { nextDue, upcoming[], user, community, isLoading, error }
//
// preferredCommunityIdentifier (optional): pins the "active community" this
// hook scopes to, overriding the glass_member_community localStorage guess
// below. Needed by AdminDashboard.jsx -- an owner who belongs to more than
// one community as a paying member has their own single "last selected"
// member community in localStorage, which has no relationship to whichever
// community's admin dashboard they currently have open. Without this, "Your
// Payments" on the admin dashboard silently showed a *different* community's
// dues (or none at all) instead of the one actually on screen.
// ─────────────────────────────────────────────────────────────────────────────
export function usePayments(preferredCommunityIdentifier) {
  const queryClient = useQueryClient();

  const obligationsQuery = useQuery({
    queryKey: ["obligations"],
    queryFn: async () => {
      try {
        const res = await getMyObligations();
        return unwrapList(res).map(shapeObligation);
      } catch (err) {
        // 404 means the member has no obligations yet — that's a valid empty
        // state, not a real error. Don't block the page for it.
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });

  const transactionsQuery = useQuery({
    // Shared canonical queryFn — see fetchMyTransactions in ./helpers. Do not
    // re-shape the response here: useTransactions and useGlobalOverview read
    // the same cache entry.
    queryKey: ["transactions"],
    queryFn: fetchMyTransactions,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });

  const userQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await getMe();
      return res.data?.data ?? res.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  // refetchOnMount: "always" matters here specifically -- accepting an
  // invite invalidates this query, but Home isn't mounted yet at that
  // moment (still on the Invites screen), so there's no active observer
  // for invalidateQueries to force-refetch. Without this, landing on Home
  // right after accepting can render with the pre-accept communities list,
  // which silently breaks the community/payment-links resolution below for
  // a member who just joined.
  // The complete community list from the one hook that owns the
  // ["communities"] entry. This was a local single-page query, so a member whose
  // ACTIVE community sat past row 10 was never resolved and the hook fell
  // through to `activeCommunities[0]` — the same arbitrary pick PR #94 removed
  // from the admin sidebar. `refetchOnMount: "always"` is preserved: an invite
  // acceptance invalidates this query while Home is unmounted, so a member who
  // just joined must not render with the pre-accept list.
  const communitiesQuery = useMyCommunities({ refetchOnMount: "always" });

  // Active community: prefer whatever the member last selected in MyCommunities,
  // falling back to the first community returned by the API.
  const storedCommunity = (() => {
    try {
      return JSON.parse(localStorage.getItem("glass_member_community") ?? "null");
    } catch {
      return null;
    }
  })();

  const rawCommunities = communitiesQuery.data ?? [];

  // Only ACTIVE memberships grant real access. PENDING means a join request
  // was submitted but the admin hasn't approved it yet — the community
  // shouldn't unlock dashboard/payment access until memberStatus flips.
  const activeCommunities = rawCommunities.filter(
    (c) => (c.memberStatus ?? "ACTIVE").toUpperCase() === "ACTIVE",
  );
  const pendingCommunities = rawCommunities.filter(
    (c) => (c.memberStatus ?? "").toUpperCase() === "PENDING",
  );

  function findByIdentifier(identifier) {
    if (!identifier) return null;
    return activeCommunities.find(
      (c) =>
        (c.slug ?? c.community?.slug) === identifier || (c.id ?? c.community?.id) === identifier,
    );
  }

  // Explicit caller override wins, then whatever the member last selected in
  // MyCommunities, falling back to the first community returned by the API.
  const rawActiveCommunity =
    findByIdentifier(preferredCommunityIdentifier) ??
    (storedCommunity
      ? (findByIdentifier(storedCommunity.slug ?? storedCommunity.id) ?? activeCommunities[0])
      : activeCommunities[0]);

  const communitySlug = rawActiveCommunity?.slug ?? rawActiveCommunity?.community?.slug ?? null;
  const allObligations = obligationsQuery.data ?? [];
  const allTransactions = transactionsQuery.data ?? [];

  // Scope to the active community when one is known
  const obligations = communitySlug
    ? allObligations.filter((o) => !o.communitySlug || o.communitySlug === communitySlug)
    : allObligations;
  const transactions = communitySlug
    ? allTransactions.filter((t) => !t.communitySlug || t.communitySlug === communitySlug)
    : allTransactions;

  // Sort obligations: overdue first, then by dueDate ascending
  const sorted = [...obligations].sort((a, b) => {
    const da = new Date(a.dueDate),
      db = new Date(b.dueDate);
    const sa = deriveStatus(a),
      sb = deriveStatus(b);
    if (sa === "overdue" && sb !== "overdue") return -1;
    if (sb === "overdue" && sa !== "overdue") return 1;
    return da - db;
  });

  const unpaidObligations = sorted.filter((o) => {
    const linkIsActive = o.linkStatus === "ACTIVE" || !o.linkStatus;
    return linkIsActive && !isPaidObligationStatus(o.status);
  });

  // Enrich items: if the obligation response didn't carry community logo
  // back (not always populated by the backend), fall back to the logo we got
  // from the communities list — which always returns it.
  const activeLogo = normalizeCommunity(rawActiveCommunity)?.logo ?? null;
  const enrichLogo = (item) => (item.logo?.url ? item : { ...item, logo: activeLogo });

  // Only member obligations establish an amount due. An active community
  // payment link alone does not mean this member owes it (they may be exempt).
  const upcoming = unpaidObligations.map(enrichLogo);

  // nextDue = first unpaid obligation in the sort order above
  const nextDue = upcoming[0] ?? null;

  return {
    data: {
      nextDue,
      upcoming,
      history: transactions,
      user: userQuery.data,
      community: normalizeCommunity(rawActiveCommunity),
    },
    isLoading:
      obligationsQuery.isLoading ||
      transactionsQuery.isLoading ||
      userQuery.isLoading ||
      communitiesQuery.isLoading,
    hasNoCommunity: !communitiesQuery.isLoading && activeCommunities.length === 0,
    communityCount: activeCommunities.length,
    hasPendingCommunity:
      !communitiesQuery.isLoading &&
      activeCommunities.length === 0 &&
      pendingCommunities.length > 0,
    pendingCommunity: pendingCommunities[0] ? normalizeCommunity(pendingCommunities[0]) : null,
    // Only obligations + communities are truly blocking for the Upcoming
    // Payments view. Transactions and user-profile failures are secondary:
    // transactions and user data are only used for display. Neither warrants an
    // error wall that prevents members from seeing their obligations.
    //
    // Gated on "no data at all" (not just "error is set"): on a flaky mobile
    // connection a background refetch can fail even though we already have
    // good cached data sitting in the query -- React Query keeps that data
    // around through a failed refetch, it doesn't clear it. Surfacing the
    // error in that case flashed the whole page between the real due amount,
    // the error card, and the empty state on every refetch tick, even though
    // nothing about the member's actual payments had changed. Only show the
    // error wall when there's truly nothing to fall back on.
    error:
      (obligationsQuery.error && !obligationsQuery.data) ||
      (communitiesQuery.error && !communitiesQuery.data) ||
      null,
    // For a manual "Check again" affordance -- refetches everything this
    // hook depends on, not just whichever query happens to be visible.
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  };
}
