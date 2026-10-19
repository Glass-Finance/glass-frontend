import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/recordImports";
import { recordKeys } from "../utils/recordBookQueryKeys";
export function useRecordImportRows(id, jobId, params = {}, enabled = true) {
  return useQuery({
    queryKey: [...recordKeys.job(id, jobId), "rows", params],
    queryFn: async () => (await api.getImportRows(id, jobId, params)).data.data,
    enabled: !!id && !!jobId && enabled,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: enabled ? 30000 : false,
  });
}
export function useImportRowMutation(id, jobId, action) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId, payload }) => {
      if (action === "create") return (await api.createImportRow(id, jobId, payload)).data.data;
      if (action === "update")
        return (await api.updateImportRow(id, jobId, rowId, payload)).data.data;
      if (action === "bulk") return (await api.bulkUpdateImportRows(id, jobId, payload)).data.data;
      return (await api.deleteImportRow(id, jobId, rowId)).data.data;
    },
    retry: false,
    meta: { silentError: true },
    onSettled: () => client.invalidateQueries({ queryKey: recordKeys.imports(id) }),
  });
}
