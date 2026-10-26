import { useQuery } from "@tanstack/react-query";
import {
  getAdminCommunities,
  getAdminObligations,
  getAdminPaymentLinks,
  getAdminSettlements,
  getAdminTransactions,
  getAdminUsers,
} from "../api/admin";

// The six sidebar totals the design shows. There is no count route on the
// backend, so each one is a pageSize:1 page fetch reading only
// totalElements — cheap (no rows come back) and composed from endpoints
// that already exist. Keyed by the adminNav row id the sidebar looks up.
const COUNT_FETCHERS = {
  communities: getAdminCommunities,
  users: getAdminUsers,
  "payment-links": getAdminPaymentLinks,
  transactions: getAdminTransactions,
  obligations: getAdminObligations,
  settlements: getAdminSettlements,
};

async function totalOf(fetcher) {
  const res = await fetcher({ pageNumber: 1, pageSize: 1 });
  return res.data?.data?.totalElements ?? 0;
}

export function useAdminNavCounts() {
  return useQuery({
    queryKey: ["admin-nav-counts"],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(COUNT_FETCHERS).map(async ([id, fetcher]) => [id, await totalOf(fetcher)]),
      );
      return Object.fromEntries(entries);
    },
    // Long enough that tab-hopping doesn't refire six requests, short
    // enough that a mutation in a section (which invalidates its own list
    // key, not this one) still shows up on the next visit to the shell.
    staleTime: 30_000,
  });
}
