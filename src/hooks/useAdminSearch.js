import { useQuery } from "@tanstack/react-query";
import { getAdminCommunities, getAdminTransactions, getAdminUsers } from "../api/admin";

// One capped page per jump target behind the shell's ⌘K search
// (AdminTopbar), keyed by the same trimmed term so a new keystroke refires
// the three together. All three lists honor PageQueryDto.search (the
// backend normalizes it per repository), so this is the same `search` the
// sections' own SearchBars send.
export function useAdminSearch(term) {
  const search = term.trim();
  const enabled = search.length >= 2;
  const params = { search, pageNumber: 1, pageSize: 5 };

  const users = useQuery({
    queryKey: ["admin-search", "users", search],
    queryFn: async () => (await getAdminUsers(params)).data?.data?.content ?? [],
    enabled,
    staleTime: 30_000,
  });
  const communities = useQuery({
    queryKey: ["admin-search", "communities", search],
    queryFn: async () => (await getAdminCommunities(params)).data?.data?.content ?? [],
    enabled,
    staleTime: 30_000,
  });
  const transactions = useQuery({
    queryKey: ["admin-search", "transactions", search],
    queryFn: async () => (await getAdminTransactions(params)).data?.data?.content ?? [],
    enabled,
    staleTime: 30_000,
  });

  return {
    users: users.data ?? [],
    communities: communities.data ?? [],
    transactions: transactions.data ?? [],
    isSearching: enabled && (users.isFetching || communities.isFetching || transactions.isFetching),
    hasSearched: enabled && users.isSuccess && communities.isSuccess && transactions.isSuccess,
  };
}
