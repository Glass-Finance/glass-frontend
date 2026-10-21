import { toast } from "sonner";
import { PRE_AUTH_PATHS } from "../api/client";
import { captureException } from "./monitoring";

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for turning ANY error (axios, network, JS) into a
// human-readable message. Every catch block in the app should go through
// getErrorMessage() / notifyError() instead of reaching for
// err.response?.data?.message directly, so behaviour stays consistent
// (and improves in one place) across registration, onboarding, payments,
// transactions, and every settings page on both desktop and mobile.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MESSAGES = {
  400: "That didn't look right — please check the form and try again.",
  401: "For your security, your session has expired — please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That already exists or conflicts with something else.",
  422: "Some of the information provided isn't valid.",
  429: "Too many attempts — please wait a moment and try again.",
  // 502/503/504 mean OUR server failed to get a valid response from
  // whatever it's calling internally (Paystack, most often, for anything
  // bank/payment related) — distinct from "we have a bug," so worth its
  // own message rather than the generic 500 fallback.
  502: "Our service is temporarily unavailable. Please try again in a moment.",
  503: "Our service is temporarily unavailable. Please try again in a moment.",
  504: "That took too long to respond. Please try again in a moment.",
};

// The MFA verify endpoints are pre-auth too, but the failure is about the
// second factor, not the password — telling someone on the MFA screen to
// check their email or password would send them down the wrong path. Matched
// on the two verify-login routes specifically rather than "/auth/mfa/", which
// would also catch the session-authenticated /auth/mfa/recovery-codes/regenerate
// (correctly absent from PRE_AUTH_PATHS, so it can't reach this branch).
const MFA_VERIFY_PATHS = ["/auth/mfa/totp/verify-login", "/auth/mfa/recovery-code/verify-login"];

// A 401 from the resend endpoint means "no account is registered under that
// email" — the backend answers 401 (not 404) so it doesn't confirm which
// addresses exist. Its body says nothing useful ("Invalid Request"), so the
// status + path are read here and the body's copy is discarded.
//
// "Incorrect email or password." would be nonsense on a resend screen: there
// is no password on it, and the person is usually a typo away from the right
// address.
const NO_ACCOUNT_PATHS = ["/auth/verify/resend"];

// Resolved from the status + path alone, for the few endpoints whose body
// copy says less than the status does. Returns null when the status and path
// don't name a known case, so the normal server-message path still wins
// everywhere else.
function statusOnlyMessage(status, requestUrl) {
  if (status === 401 && NO_ACCOUNT_PATHS.some((p) => requestUrl?.includes(p))) {
    return "We couldn't find an account for that email address.";
  }
  return null;
}

// A 401 from a pre-auth endpoint (login, Google sign-in, MFA verify) means
// "those credentials were wrong" — there's no session yet to have expired.
// STATUS_MESSAGES[401] is written for the opposite case (an authenticated
// call whose token lapsed), which client.js's interceptor normally
// intercepts and hard-redirects before it ever reaches here — except for
// these endpoints, which it deliberately lets through (see PRE_AUTH_PATHS in
// client.js) so the sign-in form can show its own error instead of being
// yanked out from under the user mid-attempt.
function fallbackForStatus(status, requestUrl) {
  if (status === 401 && PRE_AUTH_PATHS.some((p) => requestUrl?.includes(p))) {
    if (MFA_VERIFY_PATHS.some((p) => requestUrl?.includes(p))) {
      return "That code wasn't accepted. Try again, or use one of your recovery codes.";
    }
    return "Incorrect email or password.";
  }
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return "Something went wrong on our end. Please try again shortly.";
  return "Something went wrong. Please try again.";
}

// Strings the backend uses as generic placeholders — not useful on their
// own, so we let the HTTP-status fallback take over instead.
const GENERIC_MESSAGES = new Set([
  "error",
  "bad request",
  "internal server error",
  "forbidden",
  "unauthorized",
  "not found",
  "conflict",
  "unprocessable entity",
  "too many requests",
]);

function isTooGeneric(s) {
  return !s || GENERIC_MESSAGES.has(s.toLowerCase().trim());
}

// The backend sometimes returns a message that's specific enough to pass
// isTooGeneric (so it isn't caught by the generic-status fallback below),
// but is internal/cryptic backend-speak rather than something a user can
// act on — e.g. "Active Default Account Required" when someone tries to
// create a payment plan before setting up their community's payout
// account. Rewrite known cases (substring match, case-insensitive) into
// actionable guidance instead of passing the raw string through verbatim.
const BACKEND_MESSAGE_REWRITES = [
  {
    match: /active default account/i,
    rewrite:
      "You'll need to set up your community's payout account before creating payment plans — head to Settings → Finance → Payout Account.",
  },
  // The account exists and was selected during onboarding, but still needs
  // manual activation on our side before it can receive payments (this is
  // what the CEO described as "activating subaccounts from our end" — a
  // real backend step, not a broken selection). Framed as a bounded wait
  // rather than a dead-end error, per the same reasoning.
  {
    match: /community account is not active/i,
    rewrite:
      "Your community's payout account is still being activated by our team — this usually takes 24–72 hours. You'll be notified once it's ready and can start creating payment plans.",
  },
  // A payment plan/link only accepts payments while its status is Active —
  // an admin can Pause, Archive, or leave it as an unactivated Draft from
  // the community's Payments page, and the backend rejects any payment
  // attempt against it in that state. The raw message doesn't explain any
  // of that to the member trying (and failing) to pay it.
  {
    match: /not accepting payments/i,
    // Keeps the literal phrase "not accepting payments" in the rewritten
    // text -- PaymentSummary.jsx matches on that same substring to decide
    // whether to permanently disable the Make Payment button, so changing
    // the wording here would silently break that check too.
    rewrite:
      "This payment plan is not accepting payments right now — it's been paused, closed, or hasn't been activated yet by the community managing it. Contact your community admin to have it reopened.",
  },
];

function rewriteIfKnownCryptic(message) {
  const hit = BACKEND_MESSAGE_REWRITES.find((r) => r.match.test(message));
  return hit ? hit.rewrite : message;
}

// Some backends return { message }, some { error }, some a validation array
// under { errors: [{ field, message }] } or { errors: ["msg", ...] }.
// NestJS ValidationPipe sends message as an array of field-level strings.
function extractServerMessage(data) {
  if (!data) return null;

  // Support backends that wrap errors under the same { data: {...} }
  // envelope they use for success responses.
  const payload = data.data && typeof data.data === "object" ? data.data : data;

  // NestJS ValidationPipe: message is an array of field errors
  if (Array.isArray(payload.message) && payload.message.length) {
    const first = payload.message[0];
    const msg = typeof first === "string" ? first : (first?.message ?? null);
    if (msg && !isTooGeneric(msg)) return msg;
  }

  if (typeof payload.message === "string" && !isTooGeneric(payload.message)) {
    return payload.message;
  }

  // { description: "..." } — used by this backend alongside a generic message
  if (typeof payload.description === "string" && !isTooGeneric(payload.description)) {
    return payload.description;
  }

  // { error: "..." } — only when it's specific enough to be useful
  if (typeof payload.error === "string" && !isTooGeneric(payload.error)) {
    return payload.error;
  }

  if (Array.isArray(payload.errors) && payload.errors.length) {
    const first = payload.errors[0];
    const msg = typeof first === "string" ? first : (first?.message ?? null);
    if (msg && !isTooGeneric(msg)) return msg;
  }

  return null;
}

/**
 * Turn any thrown error into a single human-readable string.
 * Never throws, never returns empty.
 */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  // Axios error with a response from the server
  if (error.response) {
    // A handful of endpoints answer with a body that says less than the
    // status does; those are resolved from the status + path first.
    const statusOnly = statusOnlyMessage(error.response.status, error.config?.url);
    if (statusOnly) return statusOnly;
    const serverMessage = extractServerMessage(error.response.data);
    return serverMessage
      ? rewriteIfKnownCryptic(serverMessage)
      : fallbackForStatus(error.response.status, error.config?.url);
  }

  // Axios error with no response — request never reached the server
  if (error.request) {
    return "Connection lost — this didn't go through. Check your connection and try again.";
  }

  // Axios/timeout-specific code
  if (error.code === "ECONNABORTED") {
    return "Request timed out — please try again.";
  }

  // Plain JS Error or anything else with a message
  if (typeof error.message === "string" && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * Read the Retry-After seconds off a 429 response, if present -- used to
 * disable a submit/resend action for that duration instead of guessing a
 * fixed cooldown. Pair with useCountdown(seconds, resetKey) to drive the
 * disabled state. Returns null for anything that isn't a 429, or a 429
 * with no (or non-numeric) Retry-After header.
 */
export function getRetryAfterSeconds(error) {
  if (error?.response?.status !== 429) return null;
  const header = error.response.headers?.["retry-after"];
  if (!header) return null;
  const seconds = parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Log (for debugging) + surface (toast) an error in one call.
 * Returns the message string so callers can still set inline form errors
 * with the exact same text the toast showed.
 *
 * Usage:
 *   try { ... } catch (err) { setError(notifyError(err)); }
 *   try { ... } catch (err) { notifyError(err, { context: "Creating community" }); }
 * @param {any} error
 * @param {{ fallback?: string, context?: string, silent?: boolean }} [options]
 */
export function notifyError(error, { fallback, context, silent = false } = {}) {
  const message = getErrorMessage(error, fallback);

  if (import.meta.env?.DEV) {
    console.error(context ? `[${context}]` : "[error]", error);
    if (error?.response) {
      console.error("  ↳ response body:", error.response.data);
    }
  }

  captureException(error, { context });

  if (!silent) {
    toast.error(message);
  }

  return message;
}

/**
 * Wraps an async action with consistent error handling + an optional
 * success toast. Returns true/false so callers can branch (e.g. close a
 * modal only on success) without re-handling the catch themselves.
 *
 * Usage:
 *   const ok = await runWithErrorHandling(
 *     () => initiatePayment.mutateAsync({...}),
 *     { context: "Initiating payment", successMessage: "Payment started" }
 *   );
 * @param {() => Promise<unknown>} action
 * @param {{ context?: string, successMessage?: string, fallback?: string }} [options]
 */
export async function runWithErrorHandling(action, { context, successMessage, fallback } = {}) {
  try {
    const result = await action();
    if (successMessage) toast.success(successMessage);
    return { ok: true, result };
  } catch (error) {
    const message = notifyError(error, { context, fallback });
    return { ok: false, error, message };
  }
}
