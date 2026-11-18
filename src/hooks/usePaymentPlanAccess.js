import { useQuery } from "@tanstack/react-query";
import { getCommunityRole } from "../api/roles";
import { useCommunities } from "./useCommunities";
import { useActiveCommunityId } from "./useActiveCommunityId";
import { isCommunityAdmin } from "../utils/communityRole";

export function usePaymentPlanAccess() {
  const identifier = useActiveCommunityId();
  const communities = useCommunities();
  const community = communities.data?.communities?.find(
    (c) => c.id === identifier || c.slug === identifier,
  );
  const eligible = !!community && isCommunityAdmin(community);
  const roleCode = community?.owned === true ? "COMMUNITY_OWNER" : community?.memberRole;
  const role = useQuery({
    queryKey: ["roles", "community", roleCode],
    queryFn: async () => (await getCommunityRole(roleCode)).data.data,
    enabled: eligible && !!roleCode,
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });
  const codes = new Set((role.data?.permissions ?? []).map((p) => p.code));
  return {
    loading: communities.isLoading || (eligible && role.isPending),
    canDelete: eligible && codes.has("community.payment_links.delete"),
  };
}
