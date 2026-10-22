import { useQuery } from "@tanstack/react-query";
import { getCommunity } from "../api/communities";
import { normalizeImageObject } from "../utils/normalizeImageFields";

export function useAdminCommunity(identifier) {
  return useQuery({
    queryKey: ["admin-community", identifier],
    enabled: Boolean(identifier),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await getCommunity(identifier);
      const community = response.data?.data;
      return community ? { ...community, logo: normalizeImageObject(community.logo) } : null;
    },
  });
}
