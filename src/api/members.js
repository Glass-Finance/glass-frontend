import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/user/me — current authenticated user
export const getMe = () => client.get("/user/me");

// PATCH /api/v1/user/profile
// { userData: { firstName, lastName, profileImageFileId, ... } } -- phoneNumber
// is NOT accepted here anymore; go through requestPhoneUpdate/updatePhone
// below instead (phone numbers require OTP verification before they're
// stored).
export const updateProfile = (payload) => client.patch("/user/profile", payload);

// PATCH /api/v1/user/password — { oldPassword, newPassword, confirmPassword }
export const updatePassword = (payload) => client.patch("/user/password", payload);

// PATCH /api/v1/user/email — { email, emailVerificationOtp }
export const updateEmail = (payload) => client.patch("/user/email", payload);

// POST /api/v1/action-verification/request — sends an OTP to a proposed new
// email address for a signed-in user.
export const requestEmailUpdate = ({ email }) =>
  client.post("/action-verification/request", {
    actionVerificationType: "EMAIL_UPDATE",
    email,
  });

// POST /api/v1/action-verification/request — sends an OTP to a proposed new
// phone number for a signed-in user. { phoneNumber, phoneRegion } plus the
// fixed actionVerificationType this function exists to pin.
export const requestPhoneUpdate = ({ phoneNumber, phoneRegion }) =>
  client.post("/action-verification/request", {
    actionVerificationType: "PHONE_UPDATE",
    phoneNumber,
    phoneRegion,
  });

// PATCH /api/v1/user/phone — confirms the OTP from requestPhoneUpdate above
// and saves the number. { phoneNumber, phoneRegion, phoneVerificationOtp }
export const updatePhone = (payload) => client.patch("/user/phone", payload);

// POST /api/v1/user/me/deletion/request-code — sends a verification code
// (by email) required to confirm account deletion below.
export const requestAccountDeletionCode = () => client.post("/user/me/deletion/request-code");

// DELETE /api/v1/user/me — delete (anonymize after grace period) the
// authenticated user's account. Requires the code from the request above.
export const deleteAccount = (token) => client.delete("/user/me", { data: { token } });

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITIES (member perspective)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/communities/me — all communities the user belongs to
// Extra axios config (e.g. _skipAuthRedirect) merges in — see verifyPayment.
export const getMyCommunities = (config = {}) => client.get("/communities/me", config);

// GET /api/v1/communities/{communityIdentifier} — single community
export const getCommunity = (communityId) => client.get(`/communities/${communityId}`);

// GET /api/v1/communities/{communityIdentifier}/members/me
// — current user's member record within a community
export const getMyMemberRecord = (communityId) =>
  client.get(`/communities/${communityId}/members/me`);

// PATCH /api/v1/communities/{communityIdentifier}/leave
export const leaveCommunity = (communityId) => client.patch(`/communities/${communityId}/leave`);

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE — member obligations (upcoming / dues)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/finance/obligations/me — list member's obligations
// These map to "upcoming payments" in the UI. Paginated server-side, so a
// member with more obligations than the backend's default page size would
// silently see an incomplete list without an explicit pageSize.
export const getMyObligations = () =>
  client.get("/finance/obligations/me", { params: { pageSize: 200 } });

// GET /api/v1/finance/obligations/me/{obligationId}
export const getObligation = (obligationId) =>
  client.get(`/finance/obligations/me/${obligationId}`);

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE — member transactions (payment history)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/finance/transactions/me — paginated server-side, same reason
// as getMyObligations above.
export const getMyTransactions = () =>
  client.get("/finance/transactions/me", { params: { pageSize: 200 } });

// GET /api/v1/finance/transactions/me/{transactionIdentifier}
// Extra axios config (e.g. _skipAuthRedirect) merges in — see verifyPayment.
export const getTransaction = (transactionId, config = {}) =>
  client.get(`/finance/transactions/me/${transactionId}`, config);

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE — payment authorisations (auto-pay / saved cards)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/finance/authorizations — member's active payment authorisations
// Extra axios config (e.g. _skipAuthRedirect) merges in — see verifyPayment.
export const getMyAuthorisations = (config = {}) =>
  client.get("/finance/authorizations", { params: { pageSize: 100 }, ...config });

// GET /api/v1/finance/authorizations/{authorizationId}
export const getAuthorisation = (authId) => client.get(`/finance/authorizations/${authId}`);

// DELETE /api/v1/finance/authorizations/{authorizationId} — disable auto-pay
export const deleteAuthorisation = (authId) => client.delete(`/finance/authorizations/${authId}`);

// GET /api/v1/finance/banks — list Nigerian banks from Paystack
export const getBanks = () => client.get("/finance/banks");

// GET /api/v1/finance/resolve-account?bankCode=&accountNumber=
export const resolveAccount = (bankCode, accountNumber) =>
  client.get("/finance/resolve-account", { params: { bankCode, accountNumber } });

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT — initiate payment for an obligation / payment link
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/payments/pay/payment-links/{paymentLinkIdentifier}
// payload: { idempotencyKey, amount, savePaymentMethod, obligationId, metadata }
// response.data.data: { transactionId, reference, authorizationUrl, accessCode, amount, currency }
export const initiatePayment = (paymentLinkId, payload) =>
  client.post(`/payments/pay/payment-links/${paymentLinkId}`, payload);

// POST /api/v1/payments/callback/verify?reference=xxx — reference is a query
// param, not a body field. Extra axios config (e.g. _skipAuthRedirect for
// the callback page, which must handle expired sessions itself) merges in.
export const verifyPayment = (reference, config = {}) =>
  client.post("/payments/callback/verify", null, {
    params: { reference },
    ...config,
  });

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY PAYMENT LINKS (visible to members)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/payment-links — list visible payment links (member-accessible)
// Accepts query params: communityIdentifier, status, paymentType, audience, etc.
export const getPaymentLinks = (params = {}) => client.get("/payment-links", { params });

// GET /api/v1/payment-links/{paymentLinkIdentifier}
export const getPaymentLink = (id) => client.get(`/payment-links/${id}`);

// GET /api/v1/communities/{communityIdentifier}/payment-links
// NOT actually member-accessible despite the name/URL being shared with the
// admin-side call -- confirmed via a live 403 that this requires the
// community.payment_links.read permission, which regular members don't
// hold. Kept in use (see usePayments.js's paymentLinksQuery) so the
// "active plan with no obligation yet" fallback self-heals the moment the
// backend grants members this permission or adds a member-scoped
// equivalent, but its failure is treated as non-blocking everywhere it's
// called from.
export const getMemberCommunityPaymentLinks = (communityIdentifier) =>
  client.get(`/communities/${communityIdentifier}/payment-links`);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/notifications — fetch all user notifications
export const getNotifications = () => client.get("/notifications");

// GET /api/v1/notifications/unread-count
export const getUnreadCount = () => client.get("/notifications/unread-count");

// PATCH /api/v1/notifications/{notificationId}/read
export const markAsRead = (notificationId) => client.patch(`/notifications/${notificationId}/read`);

// PATCH /api/v1/notifications/read-all
export const markAllAsRead = () => client.patch("/notifications/read-all");

// DELETE /api/v1/notifications — clear all of the current user's notifications
export const clearAllNotifications = () => client.delete("/notifications");

// GET /api/v1/notifications/preferences
export const getNotificationPreferences = () => client.get("/notifications/preferences");

// PATCH /api/v1/notifications/preferences
export const updateNotificationPreferences = (payload) =>
  client.patch("/notifications/preferences", payload);
