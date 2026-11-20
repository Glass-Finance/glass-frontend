import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT LINKS — admin CRUD + lifecycle, community-scoped
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/communities/{communityIdentifier}/payment-links
// params supports memberId (audience-aware: returns only links that actually
// target that member — ALL_MEMBERS, their group, or explicit selection) plus
// the usual search/status/paymentType/audience filters. Per-link metrics are
// always included (the includeMetrics option was removed in glass-backend
// #120, which made metrics the default).
export const getCommunityPaymentLinks = (communityId, params = {}) =>
  client.get(`/communities/${communityId}/payment-links`, { params });

// GET /api/v1/communities/{communityIdentifier}/payment-links/{id}/members
// Lists members resolved from the payment link's audience with their
// obligation status (PAID, DUE, OVERDUE, WAIVED) and per-status counts.
// Filterable by obligationStatus, memberStatus, groupId, dueFrom, dueTo.
export const getPaymentLinkMembers = (communityId, paymentLinkId, params = {}) =>
  client.get(`/communities/${communityId}/payment-links/${paymentLinkId}/members`, { params });

// GET /api/v1/communities/{communityIdentifier}/payment-links/{paymentLinkId}
export const getCommunityPaymentLink = (communityId, paymentLinkId) =>
  client.get(`/communities/${communityId}/payment-links/${paymentLinkId}`);

// POST /api/v1/communities/{communityIdentifier}/payment-links
export const createPaymentLink = (communityId, payload) =>
  client.post(`/communities/${communityId}/payment-links`, payload);

// PATCH /api/v1/communities/{communityIdentifier}/payment-links/{paymentLinkId}
export const updatePaymentLink = (communityId, paymentLinkId, payload) =>
  client.patch(`/communities/${communityId}/payment-links/${paymentLinkId}`, payload);

// ─── Lifecycle actions ────────────────────────────────────────────────────────
// Confirmed via backend Swagger: activate/pause/resume/expire are PATCH (state
// transitions on the same resource); duplicate is POST (creates a new
// resource); delete is DELETE on the resource itself.
//
// There is no archive any more. glass-backend #120 (BREAKING) replaced
// PATCH .../archive with a draft-only DELETE and migrated every ARCHIVED link
// to the terminal DELETED status. Stopping a live plan is expire ("End Plan").
function patchAction(action) {
  return (communityId, paymentLinkId) =>
    client.patch(`/communities/${communityId}/payment-links/${paymentLinkId}/${action}`);
}

export const activatePaymentLink = patchAction("activate");
export const pausePaymentLink = patchAction("pause");
export const resumePaymentLink = patchAction("resume");
export const expirePaymentLink = patchAction("expire");
// DELETE /api/v1/communities/{communityIdentifier}/payment-links/{paymentLinkId}
// Permanently deletes a DRAFT link with no financial history (requires
// community.payment_links.delete). Any other status -- or a draft with payment
// or billing history -- is rejected with HTTP 400, so callers only offer it on
// drafts and let the backend's message explain the history case.
export const deletePaymentLink = (communityId, paymentLinkId) =>
  client.delete(`/communities/${communityId}/payment-links/${paymentLinkId}`);

// POST — creates a new payment link from an existing one
export const duplicatePaymentLink = (communityId, paymentLinkId, payload) =>
  client.post(`/communities/${communityId}/payment-links/${paymentLinkId}/duplicate`, payload);

// NOTE: there is deliberately no "send a reminder now" wrapper here. The
// backend exposes no POST .../payment-links/{id}/reminders route (a
// ReminderService exists, but no controller triggers it on demand), so the
// old call here was a guaranteed 404. Plan-level reminder cadence
// (reminderFrequency / reminderChannels on create + update) IS supported and
// is what CreatePlanModal/EditPlanModal configure; the on-demand action stays
// disabled with "coming soon" copy until the backend ships a route.
