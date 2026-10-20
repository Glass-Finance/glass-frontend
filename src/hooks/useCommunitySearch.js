import { useQuery } from "@tanstack/react-query";
import { searchCommunity } from "../api/communities";

/**
 * Search one community's members, transactions, payment links and
 * settlements — the admin topbar's search.
 *
 * A hook rather than a direct call from the component: the request is server
 * state, so React Query owns the cache, the dedupe and the refetch (see
 * docs/data-fetching.md).
 *
 * The backend needs 2+ characters and returns a capped preview per category,
 * so the query stays disabled below that threshold and the caller gets null
 * results rather than an empty-but-successful response.
 *
 * The DEBOUNCE stays with the caller: it is a UI timing decision about the
 * input the caller owns, not something the data layer should decide.
 */
export function useCommunitySearch(communityId, query, { enabled = true, pageSize = 5 } = {}) {
  const term = (query ?? "").trim();
  const active = enabled && !!communityId && term.length >= 2;

  const { data, isFetching, isSuccess, isError } = useQuery({
    queryKey: ["community-search", communityId, term],
    queryFn: async () => {
      const { data: res } = await searchCommunity(communityId, { search: term, pageSize });
      return res?.data ?? null;
    },
    enabled: active,
    // The result is a preview of live data; it is worth keeping briefly so
    // refocusing the input does not re-fetch, but it must not go stale.
    staleTime: 1000 * 30,
  });

  return {
    results: active ? (data ?? null) : null,
    searching: active && isFetching,
    // True once a search for the CURRENT term has come back. The caller
    // needs this to tell "searched, nothing found" from "not searched yet"
    // — both surface as a null result.
    hasSearched: active && isSuccess,
    isError,
  };
}
