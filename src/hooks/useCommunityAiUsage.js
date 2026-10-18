import { useQuery } from "@tanstack/react-query";
import { getRecordImportUsage } from "../api/communityAiUsage";
import { recordKeys } from "../utils/recordBookQueryKeys";
export function useCommunityAiUsage(id, enabled = true) {
  return useQuery({
    queryKey: recordKeys.usage(id),
    queryFn: async () => (await getRecordImportUsage(id)).data.data,
    enabled: !!id && enabled,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
