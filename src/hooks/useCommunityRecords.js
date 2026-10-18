import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/communityRecords";
import { recordKeys } from "../utils/recordBookQueryKeys";

export function useCommunityRecords(id, params = {}, enabled = true) {
  return useQuery({
    queryKey: [...recordKeys.records(id), "list", params],
    queryFn: async () => (await api.getCommunityRecords(id, params)).data.data,
    enabled: !!id && enabled,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
export function useCommunityRecord(id, recordId) {
  return useQuery({
    queryKey: recordKeys.record(id, recordId),
    queryFn: async () => (await api.getCommunityRecord(id, recordId)).data.data,
    enabled: !!id && !!recordId,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
export function useRecordMutation(id, action) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, payload }) => {
      if (action === "create") return (await api.createCommunityRecord(id, payload)).data.data;
      if (action === "update")
        return (await api.updateCommunityRecord(id, recordId, payload)).data.data;
      return (await api.deleteCommunityRecord(id, recordId)).data.data;
    },
    retry: false,
    meta: { silentError: true },
    onSettled: () => client.invalidateQueries({ queryKey: recordKeys.records(id) }),
  });
}
