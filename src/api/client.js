import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  getSessionEpoch,
  applyRefreshedTokens,
  clearSessionStorage,
} from "../store/sessionStorage";
import {
  coordinateRefresh,
  RefreshEpochChangedError,
  REQUEST_TIMEOUT_MS,
} from "./refreshCoordinator";

// VITE_API_BASE_URL is the bare origin (e.g. https://api.glasspay.app) —
// /api/v1 must always be appended, with or without the env var set.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  // Shared with refreshCoordinator.js: the lease TTL and waiter bounds are
  // derived from this value, so a timeout change propagates automatically.
  timeout: REQUEST_TIMEOUT_MS,
});

// ── Retry, scoped to requests that are safe to replay ────────────────────────
//
// A payment that fails on a flaky Nigerian mobile connection 30 seconds after
// the member tapped "Make Payment" is not a failure the member should absorb —
// the money may or may not have moved, and today the UI simply reports the
// error. Retrying blind would be worse: a POST replayed without a key can
// double-charge.
//
// So retry is opt-in BY THE PAYLOAD, not by path or method. A request carrying
// a non-empty `idempotencyKey` in its body is one whose every replay the
// backend treats as the same intent (see Transaction.idempotencyKey — nullable
// = false, uniquely indexed, with the duplicate resolved on the constraint
// violation rather than by the client asking twice). PaymentSummary and
// AdminPaymentModal both hold that key in a ref precisely so it survives a
// retry. Everything else — including verifyPayment, which carries no key —
// stays strictly single-shot, because for those a second attempt is a second
// side effect, not a recovery.
//
// A second gate decides WHICH failures are worth replaying, and it is
// deliberately narrow — see isRetryableIdempotentError below. A key makes a
// replay SAFE; it does not make every failure worth retrying.
export const IDEMPOTENT_RETRY_LIMIT = 2;
export const IDEMPOTENT_RETRY_BASE_MS = 400;
export const IDEMPOTENT_RETRY_MAX_MS = 2_000;

// ONLY a failure that produced no response at all is replayed: the request
// never got an answer (offline, DNS failure, connection reset, or an axios
// timeout — the last of which also has no `response`). That is the one shape
// where the client genuinely does not know the outcome, and it is the case
// ADR-004 calls a "network retry" — the key makes the replay the same intent
// rather than a second charge.
//
// A 4xx or 5xx RESPONSE is deliberately excluded, and the distinction is not
// about severity — it is about who decided. A response means the backend
// reached a verdict and reported it, and that verdict is the member's to see:
// the payment screens surface a 500's message inline and leave the button
// usable so the member chooses to retry, reusing the same key (see
// e2e/payment-idempotency.spec.js, which pins that contract). Replaying it
// behind the member's back would override a decision the server made.
//
// It is also unsafe in the response case, not merely unwanted. This backend
// commits the Transaction row BEFORE it calls Paystack, so a 5xx raised by the
// provider leaves an INITIATED transaction with no gateway payload behind it.
// Replaying that key returns the existing transaction — 201, no
// authorizationUrl, status INITIATED — which the payment screens read as
// "charged immediately against a saved method" and report as "Payment sent".
// A silent replay would therefore turn a visible failure into a false success.
// (429 stays excluded for the same reason as any other response: the rate
// limiter is answering correctly, and retrying it treats a protection
// mechanism as a fault.)
function isRetryableIdempotentError(error) {
  if (!error) return false;
  // A caller-cancelled request must not be resurrected by a retry.
  if (axios.isCancel(error)) return false;
  // No response at all = the request never got an answer.
  return !error.response;
}

function readIdempotencyKey(config) {
  if (!config) return null;
  // axios leaves config.data as the object it was handed for JSON bodies; it
  // only serialises at transform time. Tolerate a pre-serialised string
  // anyway rather than silently skipping a retryable request.
  const { data } = config;
  if (data && typeof data === "object") {
    return typeof data.idempotencyKey === "string" && data.idempotencyKey
      ? data.idempotencyKey
      : null;
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed?.idempotencyKey === "string" && parsed.idempotencyKey
        ? parsed.idempotencyKey
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Full jitter rather than fixed backoff: without it, every member who lost
// connectivity on the same Paystack blip retries on the same schedule and
// walks straight back into the outage together.
function retryDelayMs(attempt) {
  const ceiling = Math.min(IDEMPOTENT_RETRY_MAX_MS, IDEMPOTENT_RETRY_BASE_MS * 2 ** attempt);
  return Math.random() * ceiling;
}

// ── Attach JWT to every request ───────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh-token single-flight ─────────────────────────────────────────────
// One shared promise per refresh cycle per tab (see refreshCoordinator.js
// for the cross-tab election that sits in front of it): the first 401 to
// arrive creates it, concurrent 401s await the same promise instead of
// firing their own refresh calls. The promise is cleared in `finally` so
// the next expiry cycle starts fresh. Backend contract is unchanged:
// POST /api/v1/auth/token/refresh — body: { refreshToken, deviceInfo }.
/** @type {Promise<string> | null} */
let refreshPromise = null;
/**
 * The session generation `refreshPromise` was created for. A memoised cycle
 * belongs to the generation that started it and must never be handed to a
 * different one — see getRefreshPromise below.
 */
let refreshPromiseEpoch = null;

function doRefresh(refreshToken, epoch) {
  // Raw axios (not `client`) so the refresh call itself never re-enters
  // this interceptor.
  return axios
    .post(`${client.defaults.baseURL}/auth/token/refresh`, {
      refreshToken,
      deviceInfo: navigator.userAgent,
    })
    .then((res) => {
      // Some backend versions return { data: { accessToken } } (standard
      // envelope) and others return { accessToken } directly. Handle both.
      const data = res.data?.data ?? res.data;
      if (!data?.accessToken) throw new Error("No access token in refresh response");
      // Generation guard (Finding 2): the session may have ended (logout,
      // external clear) while this request was in flight. Never write
      // tokens from a stale generation back into storage — that would
      // resurrect a logged-out session.
      if (getSessionEpoch() !== epoch) throw new RefreshEpochChangedError();
      applyRefreshedTokens(data);
      return data.accessToken;
    });
}

function getRefreshPromise(refreshToken, epoch) {
  // A memoised cycle belongs to the session generation that started it. A
  // request arriving in a NEWER generation (the user logged out and back in
  // while a refresh was still running) must never adopt it: that cycle's
  // execute() is bound to the old epoch, so it can only reject with
  // RefreshEpochChangedError — and the adopting caller's catch block compares
  // the CURRENT epoch against its OWN epoch. Those match, so the failure gets
  // misread as "my session is dead" and clearSessionAndRedirect() destroys a
  // perfectly valid new session. Drop the foreign memo and start this
  // generation's own cycle instead.
  if (refreshPromise && refreshPromiseEpoch !== epoch) refreshPromise = null;
  if (!refreshPromise) {
    refreshPromiseEpoch = epoch;
    const cycle = coordinateRefresh({
      epoch,
      refreshToken,
      execute: () => doRefresh(refreshToken, epoch),
    });
    let tracked;
    tracked = cycle.finally(() => {
      // Identity-guarded: a cycle that a newer generation already replaced
      // must not null out the newer memo on its way out.
      if (refreshPromise === tracked) {
        refreshPromise = null;
        refreshPromiseEpoch = null;
      }
    });
    refreshPromise = tracked;
    return tracked;
  }
  return refreshPromise;
}

// Set while AuthContext is running its own startup hydration. A 401 during
// that phase should NOT immediately log the user out — it is likely a
// transient network hiccup or an expired access token that is about to be
// swapped out. Module-local (not window.__glassIsRestoring): AuthContext
// drives it via setSessionRestoring().
let isSessionRestoring = false;

export function setSessionRestoring(value) {
  isSessionRestoring = value;
}

export function isSessionRestoringActive() {
  return isSessionRestoring;
}

// Callers can open a short window (see beginAuthGrace below) where a 401
// is treated as transient rather than a real sign-out, the same reasoning
// AuthContext's restore phase (see setSessionRestoring) already applies to
// its own startup: right after landing back from a real Paystack redirect,
// the access token can be genuinely stale for a beat even though the
// session itself is fine, and hard-signing the payer out the moment they
// tap "Back to Home" -- right after watching their payment succeed -- reads
// as a broken app, not a security feature. If the session really is dead,
// the next real API call after the window closes clears it as normal.
let authGraceUntil = 0;

export function beginAuthGrace(ms = 6000) {
  authGraceUntil = Date.now() + ms;
}

function clearSessionAndRedirect() {
  // AuthContext sets the restoring flag while it is running its own
  // hydration call on startup. A 401 during that phase should NOT
  // immediately log the user out — it is likely a transient network hiccup
  // or an expired access token that is about to be swapped out. Suppressing
  // the redirect here lets restore() complete and the component tree render;
  // if the session is truly dead the next real API call (e.g. verifyPayment
  // in PaymentCallback) will trigger clearSessionAndRedirect again without
  // the flag set and the user will be taken to sign-in at that point.
  if (isSessionRestoring) return;
  if (Date.now() < authGraceUntil) return;

  // Single owner of the key list — identical set to AuthContext logout.
  clearSessionStorage();

  // window.location.href below is a hard navigation — it wipes any toast
  // shown right before it along with all other JS state. sessionStorage
  // survives the navigation, so the destination sign-in page can read this
  // flag on mount and show the explanation there instead.
  sessionStorage.setItem("glass_session_expired", "1");

  const path = window.location.pathname;
  // The payment callback page has no role in its path — an admin who paid
  // from the dashboard set paymentReturnTo before redirecting to Paystack,
  // so use that to send them to the right sign-in page, not the member one.
  const paymentReturnTo = sessionStorage.getItem("paymentReturnTo") ?? "";
  const isAdminArea =
    path.startsWith("/dashboard") ||
    path.startsWith("/onboarding") ||
    (path.startsWith("/payment") && paymentReturnTo.startsWith("/dashboard"));
  window.location.href = isAdminArea ? "/sign-in" : "/member/app-sign-in";
}

// A 401 from one of these means "wrong credentials," not "your session
// expired" — there's no session to refresh yet, since the user is still
// trying to establish one. Letting the refresh-and-redirect logic below
// run for these hard-navigates away from the sign-in form mid-attempt
// (clearing whatever they typed) before the caller's own catch block ever
// gets to show an inline/toast error.
// Exported so errorHandler.js can give a 401 from one of these a "wrong
// credentials" message instead of the generic "your session expired" copy
// written for an authenticated call whose token lapsed — same reasoning
// as above, just needed on the message side too.
export const PRE_AUTH_PATHS = [
  "/auth/login",
  "/auth/google",
  "/auth/mfa/totp/verify-login",
  // Pre-auth like the TOTP route above: no session exists yet, so a failure
  // here is a rejected code, never a lapsed session, and the refresh-then-
  // redirect path would hard-navigate off the sign-in form mid-attempt.
  // The backend reports these failures as 400 (invalid/expired/used challenge,
  // invalid recovery code, factor locked), so the 401 branch is a
  // belt-and-braces guard against ever yanking the form away.
  "/auth/mfa/recovery-code/verify-login",
  // The remaining flows that run *before* a session exists, for the same
  // reason as the three above: passwordless OTP sign-in, password reset, and
  // email verification all leave a user mid-attempt with no token yet. A 401
  // from any of them means the code or identifier was rejected, not that a
  // session lapsed — so the refresh-then-redirect path must not run, or it
  // hard-navigates off the form and destroys what they typed before their own
  // catch block can explain the failure.
  //
  // Also read by errorHandler.js, which turns a 401 from a listed path into
  // wrong-credentials copy rather than "your session expired".
  "/auth/otp/request",
  "/auth/otp/verify",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/verify",
  "/auth/verify/resend",
  // Account creation, for the same reason as every group above: register()
  // and the two phone-OTP endpoints that hand it a confirmToken run in the
  // sign-up and member-join flows, which by definition have no session yet,
  // and a rejected OTP is the likeliest 401 shape here. With no refresh token
  // the interceptor would take its "log out" branch and hard-navigate off the
  // form, discarding everything the applicant typed before their own catch
  // block could explain the failure. Listed defensively like the MFA routes
  // above — the backend reports these as 400/429, so this is the guard
  // against ever yanking the form away.
  //
  // "/auth/register" substring-matches no other live route (the sign-up
  // resend path is /auth/verify/resend, already listed above).
  "/auth/register",
  "/auth/phone/request-otp",
  "/auth/phone/verify-otp",
];

// ── Global response handler ───────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isPreAuthRequest = PRE_AUTH_PATHS.some((p) => originalRequest?.url?.includes(p));

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status === 401 && !originalRequest._retry && !isPreAuthRequest) {
      const refreshToken = getRefreshToken();

      // No refresh token available — nothing to do but log out. Requests
      // that opt out via _skipAuthRedirect (the payment callback page, which
      // must show its own "session expired" state instead of losing the
      // payment context to a hard navigation) just get the error back.
      if (!refreshToken) {
        if (!originalRequest._skipAuthRedirect) clearSessionAndRedirect();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Single-flight: every concurrent 401 awaits the same refresh
      // promise. Each waiter keeps its own _skipAuthRedirect semantics —
      // a queued opt-out request never triggers the hard redirect, even
      // though it shared the refresh attempt. The epoch is captured now so
      // a session that ends mid-refresh (logout) is observed, not undone:
      // waiters from a stale generation reject with the original error and
      // never re-clear or redirect.
      const epoch = getSessionEpoch();
      try {
        const newToken = await getRefreshPromise(refreshToken, epoch);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        if (getSessionEpoch() !== epoch) return Promise.reject(error);
        // The session generation moved underneath the refresh, yet it is still
        // ours now (the compare above passed). This failure therefore describes
        // a generation that no longer exists — refreshCoordinator publishes
        // those as `stale`, and a waiter re-raises them as
        // RefreshEpochChangedError. It is not evidence that THIS session is
        // dead, so reject the caller's request with its original error and
        // leave the live session untouched; the lease unwinds and the next
        // attempt refreshes normally.
        if (refreshError instanceof RefreshEpochChangedError) return Promise.reject(error);
        if (!originalRequest._skipAuthRedirect) clearSessionAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    // ── Idempotent retry ──────────────────────────────────────────────────────
    // Deliberately AFTER the 401 branch above. A request whose session could
    // not be refreshed has already been handled (rejected, or redirected); it
    // must not then be replayed here, or a dead session turns into three
    // identical doomed round-trips before the member sees the sign-in page.
    //
    // Runs on the original config, so `_retry` (the 401 marker) and
    // `_skipAuthRedirect` both survive the replay.
    if (
      isRetryableIdempotentError(error) &&
      readIdempotencyKey(originalRequest) !== null &&
      (originalRequest._idempotentRetries ?? 0) < IDEMPOTENT_RETRY_LIMIT
    ) {
      originalRequest._idempotentRetries = (originalRequest._idempotentRetries ?? 0) + 1;
      await sleep(retryDelayMs(originalRequest._idempotentRetries - 1));
      return client(originalRequest);
    }

    return Promise.reject(error);
  },
);

export default client;
