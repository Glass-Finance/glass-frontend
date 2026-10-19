import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCommunityAiUsage,
  getCommunityAiUsageByFeature,
  getAdminAiPolicy,
  updateAdminAiPolicy,
  getAdminAiPeriods,
  getAdminAiOperations,
  getAdminAiAdjustments,
  createAdminAiAdjustment,
} from "../api/aiUsage";

// Shared AI usage — community-visible quotas and platform-admin management.
//
// Read-only on the community side. Nothing here is derived client-side: the
// counts are the server's, and a dispatch whose provider response was lost can
// still have counted, so there is no "optimistically decrement the remaining
// allowance" move to make. Re-read after any mutation instead.

function unwrapPage(res) {
  const d = res.data?.data;
  return {
    content: Array.isArray(d) ? d : (d?.content ?? []),
    totalElements: d?.totalElements ?? 0,
    totalPages: d?.totalPages ?? 1,
  };
}

export const AI_USAGE_PAGE_SIZE = 20;

// ── Community ─────────────────────────────────────────────────────────────────

export function useCommunityAiUsage(communityId, params = {}) {
  return useQuery({
    queryKey: ["community", communityId, "ai-usage", params],
    queryFn: () => getCommunityAiUsage(communityId, params).then(unwrapPage),
    enabled: !!communityId,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useCommunityAiUsageByFeature(communityId, feature) {
  return useQuery({
    queryKey: ["community", communityId, "ai-usage", feature],
    queryFn: () => getCommunityAiUsageByFeature(communityId, feature).then((res) => res.data?.data),
    enabled: !!communityId && !!feature,
  });
}

// ── Platform admin ────────────────────────────────────────────────────────────
//
// Keyed on the community id even though these routes are platform-wide, so two
// communities open in two tabs cannot overwrite each other's cached policy.

function adminKeys(communityId, feature) {
  return {
    policy: ["admin", communityId, "ai", feature, "policy"],
    periods: ["admin", communityId, "ai", feature, "periods"],
    operations: ["admin", communityId, "ai", feature, "operations"],
    adjustments: ["admin", communityId, "ai", feature, "adjustments"],
  };
}

export function useAdminAiPolicy(communityId, feature) {
  return useQuery({
    queryKey: adminKeys(communityId, feature).policy,
    queryFn: () => getAdminAiPolicy(communityId, feature).then((res) => res.data?.data),
    enabled: !!communityId && !!feature,
  });
}

export function useAdminAiPeriods(communityId, feature, params = {}) {
  return useQuery({
    queryKey: [...adminKeys(communityId, feature).periods, params],
    queryFn: () => getAdminAiPeriods(communityId, feature, params).then(unwrapPage),
    enabled: !!communityId && !!feature,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useAdminAiOperations(communityId, feature, params = {}) {
  return useQuery({
    queryKey: [...adminKeys(communityId, feature).operations, params],
    queryFn: () => getAdminAiOperations(communityId, feature, params).then(unwrapPage),
    enabled: !!communityId && !!feature,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

export function useAdminAiAdjustments(communityId, feature, params = {}) {
  return useQuery({
    queryKey: [...adminKeys(communityId, feature).adjustments, params],
    queryFn: () => getAdminAiAdjustments(communityId, feature, params).then(unwrapPage),
    enabled: !!communityId && !!feature,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });
}

function useInvalidateAiUsage(communityId, feature) {
  const queryClient = useQueryClient();
  return () => {
    const keys = adminKeys(communityId, feature);
    for (const key of [keys.policy, keys.periods, keys.operations, keys.adjustments]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    // The policy drives the current period's numbers, so the community-side
    // read is stale too.
    queryClient.invalidateQueries({ queryKey: ["community", communityId, "ai-usage"] });
  };
}

export function useUpdateAdminAiPolicy(communityId, feature) {
  const invalidate = useInvalidateAiUsage(communityId, feature);
  return useMutation({
    mutationFn: (payload) => updateAdminAiPolicy(communityId, feature, payload),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}

// Adjustments are append-only, so this has no update or delete sibling by
// design: a correction is a compensating entry of the opposite sign.
export function useCreateAdminAiAdjustment(communityId, feature) {
  const invalidate = useInvalidateAiUsage(communityId, feature);
  return useMutation({
    mutationFn: (payload) => createAdminAiAdjustment(communityId, feature, payload),
    onSuccess: invalidate,
    meta: { silentError: true },
  });
}
