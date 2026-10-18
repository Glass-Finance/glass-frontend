import { useQuery } from "@tanstack/react-query";
import { getCommunityRole } from "../api/roles";
import { useCommunities } from "./useCommunities";
import { useActiveCommunityId } from "./useActiveCommunityId";
import { isCommunityAdmin } from "../utils/communityRole";

export function useRecordBookAccess() {
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
  const can = (suffix) => eligible && codes.has(`community.recordbook.${suffix}`);
  return {
    community,
    id: community?.id,
    identifier,
    loading: communities.isLoading || (eligible && role.isPending),
    error: communities.error || role.error,
    read: can("read"),
    create: can("create"),
    update: can("update"),
    delete: can("delete"),
    import: can("import"),
    usage: eligible && codes.has("community.ai.usage.read"),
  };
}
