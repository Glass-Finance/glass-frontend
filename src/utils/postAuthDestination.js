/**
 * src/utils/postAuthDestination.js
 *
 * Pure post-authentication destination resolution. Calculates WHERE the
 * user should go next — never navigates, calls APIs, mutates state, or
 * authenticates. Callers (SignIn, Join) perform navigation and any
 * async follow-ups (join-request submit, invite lookups) themselves.
 *
 * Precedence mirrors the long-standing per-page logic, consolidated:
 *   platform admin → full-admin shell
 *   admin → validated returnTo (admin contexts) → dashboard home
 *   pending community link → join-request flow (descriptor, caller submits)
 *   validated returnTo → it
 *   pending payment reference → payment callback
 *   invite token → home (register path) or invites (Google path fallback)
 *   pending invites/requests → invites
 *   fallback (member home, or discover-search for fresh joins)
 *
 * Returns { to: string } for direct navigation, or
 * { joinCommunity: string } when the caller must first submit the pending
 * community join request, then route to /member/invites itself.
 *
 * @param {{ user?: { isPlatformAdmin?: boolean, isAdmin?: boolean }|null, returnTo?: string, pendingCommunity?: string, pendingPaymentRef?: string, inviteToken?: string, viaGoogle?: boolean, hasPendingInvites?: boolean, fallback?: string }} [opts]
 */
import { isSafeReturnPath } from "./returnPath";
export const MEMBER_HOME = "/member/home";
export const MEMBER_INVITES = "/member/invites";
export const DASHBOARD_HOME = "/dashboard/home";
export const ADMIN_PANEL = "/dashboard/admin-panel";
export const DISCOVER_COMMUNITIES = "/member/communities/search";

/**
 * @param {{ user?: { isPlatformAdmin?: boolean, isAdmin?: boolean }|null, returnTo?: string, pendingCommunity?: string, pendingPaymentRef?: string, inviteToken?: string, viaGoogle?: boolean, hasPendingInvites?: boolean, fallback?: string }} [opts]
 */
export function resolvePostAuthDestination({
  user,
  returnTo,
  pendingCommunity,
  pendingPaymentRef,
  inviteToken,
  viaGoogle = false,
  hasPendingInvites = false,
  fallback = MEMBER_HOME,
} = {}) {
  if (user?.isPlatformAdmin) return { to: ADMIN_PANEL };

  if (user?.isAdmin) {
    const safe = isSafeReturnPath(returnTo, { allowAdminPaths: true });
    if (safe) return { to: safe };
    return { to: DASHBOARD_HOME };
  }

  // joinCommunity documents the join-request routing contract; current
  // callers submit the community link inline before delegating, so no
  // caller consumes this branch yet — kept for the contract, not removed.
  if (pendingCommunity) return { joinCommunity: pendingCommunity };

  const safe = isSafeReturnPath(returnTo);
  if (safe) return { to: safe };

  // A payment interrupted by session expiry resumes verification after
  // re-login (see SignIn's paymentPendingRef handling).
  if (pendingPaymentRef) return { to: `/payment/callback?reference=${pendingPaymentRef}` };

  // Register-path invite grants access immediately (home); the Google path
  // cannot apply the token server-side, so it routes to invites for the
  // backend-supported manual accept instead.
  if (inviteToken) return { to: viaGoogle ? MEMBER_INVITES : MEMBER_HOME };

  if (hasPendingInvites) return { to: MEMBER_INVITES };

  return { to: fallback };
}
