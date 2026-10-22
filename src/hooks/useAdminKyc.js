import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveKycBypass,
  getAdminKycAttempt,
  getAdminKycAttempts,
  getAdminUser,
  getAdminUsers,
  revokeKyc,
} from "../api/admin";
import { canManuallyApproveKycStatus, isKycApproved } from "../utils/kycStatus";

const unwrap = (res) => res.data?.data ?? res.data;

// The session exposes a role code, not a platform permission list. Mirror the
// documented grants for presentation only; the API enforces actual permissions.
export function canManageUserKyc(role) {
  return role === "SUPER_ADMIN" || role === "OPERATIONS_ADMIN";
}

export function userKycAction(user) {
  if (user?.platformRole !== "USER" || !user.userData) return null;
  if (isKycApproved(user.kycStatus)) return "REVOKE";
  if (user.enabled === true && canManuallyApproveKycStatus(user.kycStatus)) return "APPROVE";
  return null;
}

export function useAdminUsers(params) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => getAdminUsers(params).then(unwrap),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useAdminKycAttempts(params) {
  return useQuery({
    queryKey: ["admin-kyc-attempts", params],
    queryFn: () => getAdminKycAttempts(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useAdminKycAttempt(attemptId) {
  return useQuery({
    queryKey: ["admin-kyc-attempt", attemptId],
    queryFn: () => getAdminKycAttempt(attemptId).then(unwrap),
    enabled: Boolean(attemptId),
    staleTime: 0,
    retry: false,
  });
}

export function useAdminKycUser(userId, enabled = true) {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId).then(unwrap),
    enabled: Boolean(userId) && enabled,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}

export function useInvalidateAdminKyc() {
  const client = useQueryClient();
  return (userId) =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["admin-users"] }),
      client.invalidateQueries({ queryKey: ["admin-user", userId] }),
      client.invalidateQueries({ queryKey: ["admin-kyc-attempts"] }),
      client.invalidateQueries({ queryKey: ["admin-kyc-attempt"] }),
      client.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
    ]);
}

export function useAdminUserKycMutation(userId, action) {
  const invalidate = useInvalidateAdminKyc();
  return useMutation({
    mutationFn: (reason) =>
      (action === "APPROVE" ? approveKycBypass : revokeKyc)(userId, { reason }).then(unwrap),
    retry: false,
    onSuccess: () => invalidate(userId),
    onError: (error) => (error?.response?.status === 409 ? invalidate(userId) : undefined),
  });
}
