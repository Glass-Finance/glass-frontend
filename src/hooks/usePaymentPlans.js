import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCommunityPaymentLinks,
  createPaymentLink,
  updatePaymentLink,
  activatePaymentLink,
  pausePaymentLink,
  resumePaymentLink,
  expirePaymentLink,
  deletePaymentLink,
  duplicatePaymentLink,
} from "../api/payments";

function unwrapList(res) {
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  return data?.content ?? [];
}

// Shape a raw PaymentLink into what the dashboard/plans table renders.
// PaymentLink.metrics: { amountCollected, expectedAmount, currency,
//                         audienceSize, membersFullyPaid, membersPartiallyPaid, membersUnpaid }
function shapePlan(raw) {
  const m = raw.metrics ?? {};
  const expected = m.expectedAmount ?? 0;
  const collected = m.amountCollected ?? 0;
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.title ?? raw.name ?? "Untitled plan",
    description: raw.description,
    type: raw.paymentType, // "ONE_TIME" | "RECURRING"
    frequency: raw.recurringPlan?.frequency ?? raw.frequency,
    amount: raw.amount,
    status: raw.status,
    activateImmediately: raw.activateImmediately,
    amountCollected: collected,
    expectedAmount: expected,
    paidCount: m.membersFullyPaid ?? 0,
    partialCount: m.membersPartiallyPaid ?? 0,
    unpaidCount: m.membersUnpaid ?? 0,
    totalCount: m.audienceSize ?? 0,
    currency: m.currency ?? "NGN",
    dueAt: raw.dueAt ?? null,
    // Confirmed via real Swagger schema (PaymentLinkResponse): root-level
    // on both the single-resource GET/PATCH response AND this hook's own
    // list-endpoint response, not nested under recurringPlan.
    reminderFrequency: raw.reminderFrequency ?? null,
    reminderChannels: raw.reminderChannels ?? [],
    communityAccountId: raw.communityAccountId ?? null,
    // Audience/visibility/amountMode/memberIds/groupIds are the editable terms
    // of a plan (PaymentLinkResponse carries all five at the root). They were
    // dropped here, which left EditPlanModal hydrating from a plan object that
    // no longer described the link — every edit silently re-sent the defaults
    // instead of the stored terms. memberIds are COMMUNITY MEMBER record ids and
    // groupIds are COMMUNITY MEMBER GROUP record ids (the same ids the PATCH
    // endpoint expects back), not user ids.
    amountMode: raw.amountMode ?? "FIXED",
    audience: raw.audience ?? "ALL_MEMBERS",
    visibility: raw.visibility ?? "PUBLIC",
    memberIds: raw.memberIds ?? [],
    // Without this a GROUP plan opens with no groups selected, so Save is
    // blocked by the empty-selection gate and the admin cannot edit their own
    // plan without re-picking every group.
    groupIds: raw.groupIds ?? [],
  };
}

export function usePaymentPlans(communityId) {
  const queryClient = useQueryClient();
  const enabled = !!communityId;

  const query = useQuery({
    // "plans" discriminator: this hook and useMembersWithPayments both read
    // GET .../payment-links for the same community, but they are not the same
    // resource in the cache — this one sends includeMetrics=true and maps the
    // response through shapePlan (plan/summary objects for the Payments table
    // and dashboard cards), while useMembersWithPayments caches the raw
    // PaymentLink list under ["community", id, "payment-links"] and only reads
    // id/status off it. Sharing one key meant whichever queryFn fetched first
    // decided the shape for both, so plan consumers could be handed raw links
    // (no name/amountCollected/paidCount) and vice versa.
    queryKey: ["community", communityId, "payment-links", "plans"],
    queryFn: async () => {
      // includeMetrics is a real, confirmed query param on this endpoint
      // (PaymentLinkQueryDto) -- without it the list response's per-item
      // metrics object can't be assumed populated, silently zeroing every
      // amountCollected/expectedAmount card on the dashboard.
      const res = await getCommunityPaymentLinks(communityId, { includeMetrics: true });
      return unwrapList(res).map(shapePlan);
    },
    enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: "always",
  });

  // Deliberately left as the payment-links PREFIX, not the "plans" key: it now
  // has to reach this hook's ["…", "payment-links", "plans"] entry *and* keep
  // covering the raw member-payment list plus ["…", "member", memberId] under
  // the same prefix — exactly the set it invalidated before the split.
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["community", communityId, "payment-links"] }),
      queryClient.invalidateQueries({ queryKey: ["community", communityId, "members"] }),
    ]);
  }

  // silentError: true on create/update/duplicate -- Payments.jsx
  // (the only caller of these) already shows its own notifyError with a more
  // specific context per action; without this the global mutationCache
  // onError in main.jsx toasts the same failure a second time.
  const create = useMutation({
    mutationFn: (payload) => createPaymentLink(communityId, payload),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan created", silentError: true },
  });

  const update = useMutation({
    mutationFn: ({ paymentLinkId, payload }) =>
      updatePaymentLink(communityId, paymentLinkId, payload),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan updated", silentError: true },
  });

  const activate = useMutation({
    mutationFn: (paymentLinkId) => activatePaymentLink(communityId, paymentLinkId),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan activated" },
  });
  const pause = useMutation({
    mutationFn: (paymentLinkId) => pausePaymentLink(communityId, paymentLinkId),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan paused" },
  });
  const resume = useMutation({
    mutationFn: (paymentLinkId) => resumePaymentLink(communityId, paymentLinkId),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan resumed" },
  });
  const expire = useMutation({
    mutationFn: (paymentLinkId) => expirePaymentLink(communityId, paymentLinkId),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan expired" },
  });
  const remove = useMutation({
    mutationFn: (paymentLinkId) => deletePaymentLink(communityId, paymentLinkId),
    onSuccess: invalidate,
    // Keep the mutation pending until refreshed state arrives before retrying
    // a stale draft. Eligibility and billing history are server-authoritative.
    onError: (error) => (error?.response?.status === 409 ? invalidate() : undefined),
    meta: { successMessage: "Payment plan deleted" },
  });
  // DuplicatePaymentLinkRequest (confirmed via Swagger) takes title, slug,
  // description, startAt/dueAt/expireAt, and an optional recurringPlan
  // override -- DuplicatePlanModal collects title + a fresh due date (the
  // original's has usually already passed) and sends them here.
  const duplicate = useMutation({
    mutationFn: ({ paymentLinkId, payload }) =>
      duplicatePaymentLink(communityId, paymentLinkId, payload),
    onSuccess: invalidate,
    meta: { successMessage: "Payment plan duplicated", silentError: true },
  });

  // No sendReminder mutation: the backend has no on-demand reminder route
  // (see the note in api/payments.js). Plan-level reminder cadence is
  // configured through create/update instead.

  return {
    plans: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    activate,
    pause,
    resume,
    expire,
    delete: remove,
    duplicate,
  };
}
