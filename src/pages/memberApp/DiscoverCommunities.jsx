import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { Search, Users, Loader2, CheckCircle2, Clock, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchPublicCommunities } from "../../api/communities";
import { submitJoinRequest } from "../../api/invites";
import { recordPendingJoinRequest, useJoinApprovalWatcher } from "../../hooks/useJoinApproval";
import { useMyCommunities } from "../../hooks/useMyAccount";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import PulseImg from "../../components/common/PulseImg";
import LoadingState from "../../components/common/LoadingState";
import JoinApprovedModal from "../../components/memberApp/JoinApprovedModal";
import { getErrorMessage } from "../../utils/errorHandler";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

// ─── Hook ─────────────────────────────────────────────────────────────────────
function usePublicSearch(query) {
  return useQuery({
    queryKey: ["public-communities", query],
    queryFn: async () => {
      const res = await searchPublicCommunities({ search: query, size: 30 });
      const d = res.data?.data;
      return Array.isArray(d) ? d : (d?.content ?? []);
    },
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  });
}

// ─── Single community card ────────────────────────────────────────────────────
function CommunityCard({ community, derivedStatus, onRequest }) {
  // derivedStatus survives reloads (built from the member's own communities
  // list + locally tracked requests); the override reflects actions taken
  // on this render of the page.
  const [statusOverride, setStatusOverride] = useState(null);
  const status = statusOverride ?? derivedStatus ?? community.userJoinStatus ?? null;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const alreadyMember = status === "member";
  const alreadyPending = status === "pending";
  const logoUrl = community.logo?.url ?? null;
  const categoryLabel =
    (Array.isArray(community.category) ? community.category[0] : community.category) ?? "Community";
  // Field name unconfirmed against the public search response -- covers
  // every variant used elsewhere in the app (metrics.totalMembers is the
  // one the admin-scoped community endpoints use) so whichever one the
  // public endpoint actually sends still renders.
  const memberCount =
    community.memberCount ??
    community.membersCount ??
    community.totalMembers ??
    community.metrics?.totalMembers ??
    community.metrics?.activeMembers ??
    null;

  async function handleRequest() {
    if (alreadyMember || alreadyPending || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await onRequest(community.id ?? community.slug);
      const data = res?.data?.data ?? res?.data;
      const newStatus = (data?.status ?? "").toUpperCase();
      if (newStatus === "APPROVED") {
        setStatusOverride("member");
      } else {
        setStatusOverride("pending");
        // Track it so the button stays "Request sent" across reloads and
        // Home can show a "you're in" confirmation on approval.
        recordPendingJoinRequest({
          id: community.id,
          slug: community.slug,
          name: community.name,
        });
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "Couldn't send request. Try again."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="bg-white rounded-xl border border-outline-on-surface overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 border-b border-outline-on-surface">
        {/* Logo */}
        {/* The neutral background is unconditional now: with the old
            `logoUrl ? transparent : grey` toggle a logo whose URL had failed
            left a browser broken-image glyph, because the letter was only
            rendered when there was no URL at all. A loaded image covers the
            background completely, so keeping it costs nothing. */}
        <div className="w-11 h-11 rounded-[10px] flex-shrink-0 overflow-hidden flex items-center justify-center text-lg bg-[#F0F0F0] border border-hairline-neutral">
          <PulseImg
            src={logoUrl}
            className="w-full h-full"
            skeletonClassName="bg-black/5"
            fallback={<span>{community.name?.charAt(0) ?? "C"}</span>}
          />
        </div>

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-ink mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
            {community.name}
          </p>
          <p className="text-sm text-ink-ghost overflow-hidden text-ellipsis whitespace-nowrap">
            {categoryLabel}
          </p>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
        {/* Description */}
        {community.description && (
          <p className="text-sm text-ink-strong leading-[1.55]">{community.description}</p>
        )}

        {(memberCount != null || community.requiresMemberApproval === false) && (
          <div className="flex items-center gap-3">
            {memberCount != null && (
              <span className="flex items-center gap-1.5 text-sm text-ink-ghost">
                <Users size={15} className="text-ink" />
                <span className="font-bold text-ink">{memberCount.toLocaleString()}</span>
                Members
              </span>
            )}
            {community.requiresMemberApproval === false && (
              <span className="text-[11px] text-success-strong font-semibold">
                Open — join instantly
              </span>
            )}
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleRequest}
          disabled={alreadyMember || alreadyPending || loading}
          variant={alreadyMember ? "success" : alreadyPending ? "outline-neutral" : "primary"}
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {alreadyMember && <CheckCircle2 size={13} />}
          {alreadyPending && <Clock size={13} />}
          {alreadyMember
            ? "Already a member"
            : alreadyPending
              ? "Request sent"
              : community.requiresMemberApproval === false
                ? "Join"
                : "Request To Join"}
        </Button>
        {errorMsg && <p className="text-[11.5px] text-danger m-0 text-center">{errorMsg}</p>}
      </div>
    </div>
  );
}

// ─── Empty / idle states ──────────────────────────────────────────────────────
function EmptyState({ query }) {
  if (!query || query.length < 2) {
    return (
      <div className="flex flex-col items-center pt-[60px] text-ink-ghost">
        <Search size={32} strokeWidth={1.2} className="mb-2.5" />
        <p className="text-sm text-center">Search for a community by name</p>
        <p className="text-xs mt-1 text-center">e.g. "Kings College Alumni"</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center pt-[60px] text-ink-ghost">
      <p className="text-sm text-center">No communities found for "{query}"</p>
      <p className="text-xs mt-1 text-center">Try a shorter or different search term</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DiscoverCommunities() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: results = [], isLoading, isFetching } = usePublicSearch(query);

  // The member's own communities + locally tracked requests — so a reload
  // doesn't reset "Request sent"/"Already a member" back to a Join button.
  // Same query key/fn as the rest of the app: shares the cache, no extra fetch.
  // The complete community list from the one hook that owns the
  // ["communities"] entry. This was a local single-page query, so a member of
  // more than 10 communities was shown a "Join" button for communities they
  // were already in — the card's membership test below simply did not find
  // them. Now every membership is in scope.
  const { data: myCommunities = [] } = useMyCommunities();

  // Only surfaced here -- this page is where a member is actively waiting
  // on a request, so it's the only place an approval landing mid-session
  // should interrupt with a popup. One at a time; dismissing (or opening
  // the community) reveals the next if more than one came through.
  // `pending` comes from the same watcher, so a rejection resolved by an
  // admin mid-session flips the card back to "Request to Join" here too,
  // instead of only after the next reload.
  const {
    approved: approvedJoins,
    dismiss: dismissJoin,
    pending: pendingLocal,
  } = useJoinApprovalWatcher();
  const activeApproval = approvedJoins[0] ?? null;

  function openApprovedCommunity(entry) {
    try {
      localStorage.setItem(
        "glass_member_community",
        JSON.stringify({
          id: entry.communityId,
          slug: entry.communitySlug,
          name: entry.name,
        }),
      );
    } catch {
      /* ignore */
    }
    dismissJoin(entry);
    navigate("/member/home");
  }

  function derivedStatusFor(community) {
    const match = myCommunities.find(
      (c) =>
        (c.id ?? c.community?.id) === community.id ||
        (community.slug && (c.slug ?? c.community?.slug) === community.slug),
    );
    if (match) {
      const s = (match.memberStatus ?? "ACTIVE").toUpperCase();
      if (s === "ACTIVE") return "member";
      if (s === "PENDING") return "pending";
    }
    if (
      pendingLocal.some(
        (p) =>
          (p.id && p.id === community.id) ||
          (p.slug && community.slug && p.slug === community.slug),
      )
    ) {
      return "pending";
    }
    return null;
  }

  const joinMutation = useMutation({
    mutationFn: submitJoinRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests"] });
      // An open community approves instantly — refresh the member's
      // communities so the new one appears on Home/My Communities right away.
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });

  return (
    <div className="relative overflow-hidden min-h-screen pb-10 max-w-[430px] mx-auto">
      <GlassLogoGlow />
      {/* Header — before: padding: "52px 20px 16px" */}
      <div className="flex items-center justify-center relative pt-[35px] px-5 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-5"
        />
        <h1 className="text-[18px] leading-6 font-medium text-ink m-0">Browse Communities</h1>
      </div>

      {/* Search input */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2.5 bg-white rounded-xl py-3 px-3.5 border-[1.5px] border-hairline-neutral focus-within:border-brand">
          {isFetching ? (
            <Loader2 size={15} className="animate-spin text-brand-deep flex-shrink-0" />
          ) : (
            <Search size={15} className="text-ink-ghost flex-shrink-0" />
          )}
          <input
            autoFocus
            type="text"
            placeholder="Search Community"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-none outline-none bg-transparent text-sm text-ink"
          />
          {query && (
            <Button
              variant="tertiary"
              size="icon-sm"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 flex flex-col gap-2.5">
        {isLoading && query.length > 1 ? (
          <LoadingState label="Searching…" className="pt-12" />
        ) : results.length > 0 ? (
          results.map((c) => (
            <CommunityCard
              key={c.id ?? c.slug}
              community={c}
              derivedStatus={derivedStatusFor(c)}
              onRequest={joinMutation.mutateAsync}
            />
          ))
        ) : (
          <EmptyState query={query} />
        )}
      </div>

      {/* Join-request approved popup -- also watched from Home now, so an
          approval that lands after the member has already navigated away
          from this page still surfaces there instead of going unnoticed. */}
      <JoinApprovedModal
        entry={activeApproval}
        onOpen={openApprovedCommunity}
        onDismiss={dismissJoin}
      />
    </div>
  );
}
