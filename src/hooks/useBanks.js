import { useQuery } from "@tanstack/react-query";
import { getBanks } from "../api/members";
import { notifyError } from "../utils/errorHandler";

/**
 * The bank list for the account-entry form.
 *
 * A hook rather than a direct call from the component: server state belongs
 * in React Query so the cache, the dedupe and the refetch have one owner
 * (see docs/data-fetching.md).
 *
 * The list changes rarely, so it is cached for an hour — the account form
 * opens this every time an admin sets up a payout account, and there is no
 * reason for each of those to hit the network.
 */
export function useBanks() {
  const query = useQuery({
    queryKey: ["finance", "banks"],
    queryFn: async () => {
      try {
        const { data } = await getBanks();
        const list = data?.data ?? data;
        const arr = Array.isArray(list) ? list : (list?.content ?? []);
        // The backend can repeat a bank code; the picker shows one entry per
        // code, so the duplicates are dropped here rather than in every
        // consumer.
        const seen = new Set();
        return arr.filter((bank) => {
          if (seen.has(bank.code)) return false;
          seen.add(bank.code);
          return true;
        });
      } catch (err) {
        // The failure is toasted here rather than through a query-level
        // onError: React Query v5 dropped the per-query callbacks, so an
        // onError option would be accepted by nothing and silently ignored.
        notifyError(err, {
          context: "Load banks",
          fallback: "Couldn't load the bank list.",
        });
        throw err;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  return { ...query, banks: query.data ?? [] };
}
