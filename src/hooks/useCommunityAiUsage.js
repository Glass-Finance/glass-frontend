import { useQuery } from "@tanstack/react-query";
import { getCommunityAiUsage, getRecordImportUsage } from "../api/communityAiUsage";
import { recordKeys } from "../utils/recordBookQueryKeys";

export function useCommunityAiUsageList(id, params = {}, enabled = true) {
  return useQuery({
    queryKey: recordKeys.usageList(id, params),
    queryFn: async () => (await getCommunityAiUsage(id, params)).data.data,
    enabled: !!id && enabled,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}
export function useCommunityAiUsage(id, enabled = true) {
  return useQuery({
    queryKey: recordKeys.usage(id),
    queryFn: async () => (await getRecordImportUsage(id)).data.data,
    enabled: !!id && enabled,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
