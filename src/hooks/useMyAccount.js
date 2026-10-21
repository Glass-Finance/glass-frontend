import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeImageObject } from "../utils/normalizeImageFields";
import {
  getMe,
  updateProfile,
  updatePassword,
  updateEmail,
  requestPhoneUpdate,
  updatePhone,
  getMyMemberRecord,
  leaveCommunity,
} from "../api/members";
import { fetchCompleteMyCommunityList } from "../api/communityList";

// ─── Current user ─────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await getMe();
      return res.data?.data ?? res.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Update profile ───────────────────────────────────────────────────────────
const PROFILE_FIELD_LABELS = {
  firstName: "first name",
  lastName: "last name",
  profileImageFileId: "profile photo",
};

// "Your last name was updated successfully" beats a generic "Profile
// updated" — but it only works if callers send just the changed fields.
function describeProfileUpdate(variables) {
  const fields = Object.keys(variables?.userData ?? {})
    .map((k) => PROFILE_FIELD_LABELS[k])
    .filter(Boolean);
  if (fields.length === 0 || fields.length > 2) return "Profile updated";
  const list = fields.join(" and ");
  return `Your ${list} ${fields.length > 1 ? "were" : "was"} updated successfully`;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    meta: { successMessage: describeProfileUpdate },
  });
}

// ─── Update password ──────────────────────────────────────────────────────────
export function useUpdatePassword() {
  return useMutation({
    mutationFn: (payload) => updatePassword(payload),
    meta: { successMessage: "Password changed" },
  });
}

// ─── Update email ─────────────────────────────────────────────────────────────
// The OTP is requested separately through POST /action-verification/request.
// This mutation confirms it through PATCH /user/email, so invalidate ["me"]
// after every successful call.
export function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => updateEmail(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// ─── Update phone ─────────────────────────────────────────────────────────────
// Two calls against two different endpoints (unlike email, which reuses one
// PATCH for both steps): requestPhoneUpdate sends the OTP, updatePhone
// confirms it. Only invalidate ["me"] on the confirming call.
export function useRequestPhoneUpdate() {
  return useMutation({
    mutationFn: (payload) => requestPhoneUpdate(payload),
  });
}

export function useUpdatePhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => updatePhone(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// ─── Communities ──────────────────────────────────────────────────────────────
//
// THE single owner of the ["communities"] cache entry — the complete,
// image-normalized list of communities this user belongs to.
//
// It was one of six registrations under this key, each with its own inline
// queryFn. That was two defects at once:
//
//   1. All six called getMyCommunities(), a single request, and /communities/me
//      is paginated (the backend defaults to 10). A user in more than 10
//      communities silently lost the rest, so: useCommunityMap could not
//      resolve a notification's community, useJoinApprovalWatcher missed an
//      approval that landed off page 1, useTransactions / useTransactionDetail
//      could not resolve an off-page community logo, and useMainPayments could
//      not resolve an off-page active community (so it fell through to
//      activeCommunities[0]). DiscoverCommunities showed "Join" for a community
//      the user was already a member of.
//
//   2. Only this one normalized `logo`, so the other five read the raw
//      server-controlled `logo.url` off the same cache entry -- and whichever
//      observer happened to fetch first decided which shape everyone got.
//
// Both are fixed by having exactly one queryFn here. The page walk is NOT
// reimplemented: it is fetchCompleteMyCommunityList() from
// api/communityList.js, the same helper useCommunities() and AuthContext use.
//
// Shape: a flat array of community objects with `logo` normalized -- exactly
// what this hook already returned, so useCommunityMap, memberApp Home and
// MyCommunities.jsx are unaffected. Consumers that previously read the raw
// array keep the same fields; they gain normalization and the missing pages.
//
// @param {object}  [options]
// @param {boolean} [options.enabled]           observer-level gate
// @param {*}        [options.refetchOnMount]   forwarded verbatim
// @param {boolean} [options.skipAuthRedirect]  send `_skipAuthRedirect`.
//   PaymentSuccess.jsx needs this via useTransactionDetail: a transient 401
//   there must not hard-redirect someone who has already seen "Payment
//   Successful". It is deliberately part of the query KEY, because it is a
//   genuinely different request behavior -- sharing one cache entry across
//   both would leave the redirect policy up to whichever observer mounted
//   last. Only that page opts in, so only it gets a second entry.
export function useMyCommunities({
  enabled = true,
  refetchOnMount,
  skipAuthRedirect = false,
} = {}) {
  return useQuery({
    queryKey: skipAuthRedirect ? ["communities", { skipAuthRedirect: true }] : ["communities"],
    queryFn: async () => {
      const list = await fetchCompleteMyCommunityList(
        skipAuthRedirect ? { config: { _skipAuthRedirect: true } } : {},
      );
      // SECURITY: normalize at the queryFn so the value entering the shared
      // ["communities"] cache is already safe for EVERY consumer -- all of
      // them, not just useCommunityMap / MyCommunities / HomeSections.
      // Validating here rather than in each consumer is what makes this one
      // change cover all of them.
      return list.map((c) => (c?.logo ? { ...c, logo: normalizeImageObject(c.logo) } : c));
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    ...(refetchOnMount === undefined ? {} : { refetchOnMount }),
  });
}

// ─── Leave a community ────────────────────────────────────────────────────────
export function useLeaveCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (communityId) => leaveCommunity(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    meta: { successMessage: "You've left the community" },
  });
}

// ─── Member record within a specific community ────────────────────────────────
export function useMyMemberRecord(communityId) {
  return useQuery({
    queryKey: ["member-record", communityId],
    queryFn: async () => {
      const res = await getMyMemberRecord(communityId);
      return res.data?.data ?? res.data;
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });
}
