// src/services/authService.js
// Thin wrappers around the Authentication API endpoints.

import client from "../api/client";
import { getRefreshToken, persistSession } from "../store/sessionStorage";
import { identifierPayload, buildPasswordResetPayload } from "./authPayloads";

/**
 * Register a new account.
 * @returns {Promise<{accessToken, refreshToken, userId, email, emailVerified, ...}>}
 */
export async function register(payload) {
  const { data } = await client.post("/auth/register", payload);
  return data.data;
}

/**
 * Request a pre-registration email OTP (POST /auth/email/request-otp).
 *
 * The code is delivered by email and is never returned to the client — only
 * data.expiresAt comes back. This does NOT create a user: it proves control
 * of the address, which register() then consumes as emailConfirmToken.
 *
 * @returns {Promise<{expiresAt}>}
 */
export async function requestEmailOtp({ email }) {
  const { data } = await client.post("/auth/email/request-otp", { email });
  return data.data;
}

/**
 * Verify a pre-registration email OTP (POST /auth/email/verify-otp).
 *
 * Returns the single-use emailConfirmToken that register() now REQUIRES —
 * without it the backend answers 400 "Email must be verified". The field is
 * `token` here (not `otp`): the pre-registration phone endpoint uses `otp`,
 * the email one uses `token`.
 *
 * @returns {Promise<{confirmToken, expiresAt}>}
 */
export async function verifyEmailOtp({ email, token }) {
  const { data } = await client.post("/auth/email/verify-otp", { email, token });
  return data.data;
}

/**
 * Request a registration OTP for an unclaimed phone number.
 * @returns {Promise<{expiresAt}>}
 */
export async function requestPhoneOtp({ phoneNumber, phoneRegion }) {
  const { data } = await client.post("/auth/phone/request-otp", { phoneNumber, phoneRegion });
  return data.data;
}

/**
 * Verify a registration phone OTP — returns a single-use confirmToken to
 * pass to register().
 * @returns {Promise<{confirmToken, expiresAt}>}
 */
export async function verifyPhoneOtp({ phoneNumber, phoneRegion, otp }) {
  const { data } = await client.post("/auth/phone/verify-otp", { phoneNumber, phoneRegion, otp });
  return data.data;
}

/**
 * Verify email with the code sent to the user's inbox.
 *
 * LEGACY. POST /auth/verify is the old activation endpoint, deprecated in
 * Swagger. It only still makes sense for accounts created BEFORE the
 * verify-before-register change — a new registration is already verified by
 * the time register() returns, and has no activation code at all. New
 * sign-ups use requestEmailOtp() + verifyEmailOtp() above.
 *
 * @param {string} email
 * @param {string} token - the OTP/verification code
 */
export async function verifyEmail({ email, token }) {
  const { data } = await client.post("/auth/verify", { email, token });
  return data.data;
}

/**
 * Resend the verification email/code.
 *
 * LEGACY. POST /auth/verify/resend is deprecated in Swagger. The new signup
 * flow re-requests through POST /auth/email/request-otp instead — the same
 * endpoint that sent the first code.
 */
export async function resendVerification({ email }) {
  const { data } = await client.post("/auth/verify/resend", { email });
  return data;
}

/**
 * Log in with a password -- identifier is email or phone (phoneRegion goes
 * with a national-format number).
 */
export async function login({ email, phoneNumber, phoneRegion, password }) {
  const { data } = await client.post("/auth/login", {
    ...identifierPayload({ email, phoneNumber, phoneRegion }),
    password,
    deviceInfo: navigator.userAgent,
  });
  return data.data;
}

/**
 * Request a passwordless login OTP -- delivered by email or SMS depending
 * on which identifier is supplied. Distinct from requestPhoneOtp/
 * verifyPhoneOtp above: those verify a phone number during registration
 * (/auth/phone/*, return a confirmToken for register()); these log into an
 * account that already exists, with no confirmToken involved.
 * @returns {Promise<{expiresAt}>}
 */
export async function requestLoginOtp({ email, phoneNumber, phoneRegion }) {
  const { data } = await client.post(
    "/auth/otp/request",
    identifierPayload({ email, phoneNumber, phoneRegion }),
  );
  return data.data;
}

/**
 * Exchange a passwordless login OTP for a session (or an MFA challenge).
 */
export async function verifyLoginOtp({ email, phoneNumber, phoneRegion, token }) {
  const { data } = await client.post("/auth/otp/verify", {
    ...identifierPayload({ email, phoneNumber, phoneRegion }),
    token,
    deviceInfo: navigator.userAgent,
  });
  return data.data;
}

/**
 * Log out — invalidates the refresh token server-side.
 */
export async function logout() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  const { data } = await client.post("/auth/logout", { refreshToken });
  return data;
}

/**
 * Forgot password — sends a reset code to every eligible channel for the
 * resolved user (email, and phone once verified). The identifier here only
 * resolves *which* user, not which channel to use.
 */
export async function forgotPassword({ email, phoneNumber, phoneRegion }) {
  const { data } = await client.post(
    "/auth/password/forgot",
    identifierPayload({ email, phoneNumber, phoneRegion }),
  );
  return data;
}

/**
 * Reset password using the code from forgotPassword(). The reset challenge
 * is keyed to the resolved user, not the identifier originally used to
 * request it -- so this can be completed with either the user's email or
 * phone number, independent of which one requested the code.
 */
export async function resetPassword({
  email,
  phoneNumber,
  phoneRegion,
  token,
  newPassword,
  confirmPassword,
}) {
  const { data } = await client.post(
    "/auth/password/reset",
    buildPasswordResetPayload({
      email,
      phoneNumber,
      phoneRegion,
      token,
      newPassword,
      confirmPassword,
    }),
  );
  return data;
}

/**
 * Google OAuth login/signup.
 */
export async function googleAuth({ clientToken }) {
  const { data } = await client.post("/auth/google", { clientToken });
  return data.data;
}

/**
 * Complete MFA login with a TOTP code.
 */
export async function verifyMfaLogin({ challengeToken, code }) {
  const { data } = await client.post("/auth/mfa/totp/verify-login", {
    challengeToken,
    code,
    deviceInfo: navigator.userAgent,
  });
  return data.data;
}

/**
 * Complete MFA login with a recovery code — the path for someone who has lost
 * or replaced their authenticator. Takes the same challenge token as the TOTP
 * route and returns the same AuthResponse on success.
 *
 * The backend stores each code hashed in its normalised form (uppercase
 * alphanumerics, separators stripped) and normalises the submitted value the
 * same way before comparing, so a user pasting the dashed
 * "XXXX-XXXX-XXXX-XXXX" form they saved works unchanged. A matched code is
 * marked used, so every code is strictly single-use.
 *
 * Pre-auth like the TOTP route: no session exists yet, so a failure here is
 * "wrong code", never "session expired" — see PRE_AUTH_PATHS in api/client.js.
 */
export async function verifyMfaRecoveryCodeLogin({ challengeToken, recoveryCode }) {
  const { data } = await client.post("/auth/mfa/recovery-code/verify-login", {
    challengeToken,
    recoveryCode,
    deviceInfo: navigator.userAgent,
  });
  return data.data;
}

/**
 * Initiate TOTP MFA setup — returns { secret, qrCodeUri } or { qrCodeImage, secret }.
 */
export async function setupMfaTotp() {
  const { data } = await client.post("/auth/mfa/totp/setup", { label: "Authenticator app" });
  return data.data;
}

export async function enableMfaTotp({ code }) {
  const { data } = await client.post("/auth/mfa/totp/enable", { code });
  return data.data; // { recoveryCodes: [...] }
}

/**
 * Disable MFA — requires the current TOTP code to confirm.
 * @param {string} code - 6-digit TOTP code
 */
export async function disableMfaTotp({ code }) {
  const { data } = await client.post("/auth/mfa/totp/disable", { code });
  return data.data;
}

/**
 * Replace this account's MFA recovery codes with a fresh set.
 *
 * Unlike the recovery-code *login* route, this one is an ordinary
 * authenticated call — it sits behind a session, not behind an MFA challenge
 * — so it must NOT be added to PRE_AUTH_PATHS in api/client.js.
 *
 * Requires a current TOTP code as proof of possession, and deletes every
 * existing code before issuing the new set, so previously saved codes stop
 * working immediately and the old set is unrecoverable.
 * @returns {Promise<{recoveryCodes: string[]}>}
 */
export async function regenerateMfaRecoveryCodes({ code }) {
  const { data } = await client.post("/auth/mfa/recovery-codes/regenerate", { code });
  return data.data; // { recoveryCodes: [...] }
}

/**
 * Whether an error is the backend's "email already registered" response for
 * POST /auth/register. The backend throws BadRequestException → HTTP 400
 * (never 409). Isolated here so the message match doesn't spread through
 * components. Registration-only: do not reuse for forgot-password flows,
 * which must stay account-enumeration-safe.
 */
export function isEmailAlreadyRegisteredError(err) {
  if (err?.response?.status !== 400) return false;
  // Backend error envelope carries the specific message in `description`
  // alongside a generic `message` — scan both (plus nested/data shapes).
  const payload = err?.response?.data ?? {};
  const nested = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const candidates = [
    payload.message,
    payload.description,
    payload.error,
    nested.message,
    nested.description,
    typeof payload.data === "string" ? payload.data : null,
  ];
  return candidates.some(
    (text) =>
      typeof text === "string" && text.toLowerCase().includes("email is already registered"),
  );
}

/**
 * Persist auth tokens + basic user info to localStorage.
 * Single owner is src/store/sessionStorage.js — kept here as a thin
 * backwards-compatible wrapper so existing imports keep working.
 */
export function storeAuthSession(authData) {
  persistSession(authData);
}
