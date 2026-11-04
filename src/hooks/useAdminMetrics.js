import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics } from "../api/admin";

// Current-state counts. Optional date bounds filter record creation time.
export function useAdminMetrics(params) {
  return useQuery({
    queryKey: ["admin-overview", "stats", params],
    queryFn: async () => {
      const res = await getAdminMetrics(params);
      return res.data?.data ?? res.data;
    },
    staleTime: 30_000,
  });
}
