import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCommunityRecord,
  getCommunityRecords,
  createCommunityRecord,
  updateCommunityRecord,
  deleteCommunityRecord,
} from "../api/records";

// Community record book — visible records.
//
// Key shape is ["community", communityId, "records", ...] to match the
// community-scoped convention in useGroups.js and useCommunitySettlements.js,
// and so a single prefix invalidation covers both the list and any detail view.
//
// The page envelope is { content, pageNumber, pageSize, totalElements,
// totalPages, last }. unwrapPage is repeated from those two hooks rather than
// shared: the admin equivalent lives in pages/dashboard/platform-admin/shared.js
// as `unwrap`, and importing a page module into a hook is worse layering than
// the duplication. Consolidating all three is a separate cleanup.
function unwrapPage(res) {
  const d = res.data?.data;
  return {
    content: Array.isArray(d) ? d : (d?.content ?? []),
    totalElements: d?.totalElements ?? 0,
    totalPages: d?.totalPages ?? 1,
  };
}

// pageNumber is one-based on the wire; callers hold a 0-indexed `page` for the
// pager, same as pageParams() in pages/dashboard/platform-admin/shared.js.
export const RECORD_PAGE_SIZE = 20;

export function recordListParams(page = 0, params = {}, pageSize = RECORD_PAGE_SIZE) {
  return { pageNumber: page + 1, pageSize, ...params };
}

export function useCommunityRecords(communityId, params = {}) {
  return useQuery({
    queryKey: ["community", communityId, "records", params],
    queryFn: () => getCommunityRecords(communityId, params).then(unwrapPage),
    enabled: !!communityId,
    staleTime: 1000 * 30,
    // Keeps the previous page on screen while the next one loads, so a filter
    // change does not blank the table. NOT keepPreviousData — that option does
    // not exist anywhere in this codebase.
    placeholderData: (prev) => prev,
  });
}

export function useCommunityRecord(communityId, recordId) {
  return useQuery({
    queryKey: ["community", communityId, "records", "detail", recordId],
    queryFn: () => getCommunityRecord(communityId, recordId).then((res) => res.data?.data),
    enabled: !!communityId && !!recordId,
  });
}

function useInvalidateRecords(communityId) {
  const queryClient = useQueryClient();
  // Narrowest prefix that covers list + detail for this community only.
  return () => queryClient.invalidateQueries({ queryKey: ["community", communityId, "records"] });
}

export function useCreateCommunityRecord(communityId) {
  const invalidate = useInvalidateRecords(communityId);
  return useMutation({
    mutationFn: (payload) => createCommunityRecord(communityId, payload),
    onSuccess: invalidate,
    // Callers show the duplicate-consent and validation text themselves.
    meta: { silentError: true },
  });
}

export function useUpdateCommunityRecord(communityId) {
  const invalidate = useInvalidateRecords(communityId);
  return useMutation({
    mutationFn: ({ recordId, payload }) => updateCommunityRecord(communityId, recordId, payload),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

export function useDeleteCommunityRecord(communityId) {
  const invalidate = useInvalidateRecords(communityId);
  return useMutation({
    mutationFn: (recordId) => deleteCommunityRecord(communityId, recordId),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}
