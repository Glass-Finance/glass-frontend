/**
 * src/store/sessionStorage.js
 *
 * Single owner of session persistence keys and storage operations.
 *
 * Strictly storage + a minimal in-tab session-end event. No routing,
 * no Axios, no React state, no business logic lives here.
 */

export const SESSION_KEYS = [
  "accessToken",
  "refreshToken",
  "glass_user",
  "userId",
  "userEmail",
  "glass_community",
  "glass_member_community",
];

/**
 * Session-adjacent application state owned by the AUTHENTICATED USER (F6).
 *
 * Not credentials: each entry is one user's own data written under a key
 * that is not in SESSION_KEYS. Because nothing removed them when a session
 * ended, User A's value survived logout and was read straight back by
 * User B — the pending-join list drove another user's UI, the preference
 * mirror was merged into their next GET, and the cached Google identity was
 * rendered on the sign-in screen they then used.
 *
 * Deliberately a SEPARATE list from SESSION_KEYS rather than folded into it:
 *   * SESSION_KEYS is the set AuthContext's cross-tab `storage` handler
 *     treats as "the session ended" — widening it would make deleting a
 *     preference or a resolved join request tear down every other tab's
 *     live session.
 *   * KEY_EPOCH must keep surviving a clear (see below).
 * It is cleared in the same place, for the same reason: clearSessionStorage()
 * is the single funnel every session-ending path already funnels through,
 * so this needs no new lifecycle and no scattered removeItem() calls.
 *
 * Owners keep writing these freely while the user is authenticated — the
 * contract is only that the value cannot outlive the session that produced it.
 */
export const SESSION_ADJACENT_KEYS = [
  // useJoinApproval.js — the communities this user asked to join.
  "glass_pending_join_requests",
  // useNotifications.js — preference mirror spread into the queryFn result.
  "glass_notification_prefs",
  // GoogleAuthButton.jsx — cached {email, picture, name} for the sign-in
  // button. Also TTL-bounded at 7 days for the never-logged-out case.
  "glass_last_google_identity",
];

/**
 * Keys held in REAL sessionStorage rather than localStorage, cleared by
 * clearSessionStorage() through a separate sessionStorage.removeItem pass.
 *
 * Kept apart from both lists above for two reasons. They are cleared with
 * localStorage.removeItem, so registering a sessionStorage key there would clear
 * nothing at all — a cleanup that looks correct in review and silently does
 * nothing at runtime. And SESSION_KEYS additionally doubles as the set the
 * cross-tab `storage` listener treats as "the session ended", so widening it
 * would tear down every other tab's live session over one transient value.
 *
 * The contract for a key here: tab-scoped, short-lived, and must not outlive the
 * session that produced it. glass_reset_otp is the password-reset token that
 * ForgotPassword writes and ResetPassword consumes on submit — without this it
 * survives logout for the rest of the tab's life, and whoever signs in next on
 * that tab could reach /reset-password with the previous user's token already
 * filled in.
 */
export const SESSION_TRANSIENT_KEYS = ["glass_reset_otp"];

export const KEY_TOKEN = "accessToken";
export const KEY_REFRESH_TOKEN = "refreshToken";
export const KEY_USER = "glass_user";
// Monotonic session generation. Bumped on every session end (clear) and
// every newly persisted session, so a stale async operation (e.g. an
// in-flight refresh) can detect that its generation is over before writing
// tokens back. Lives in localStorage so all tabs observe the same value.
// Deliberately NOT part of SESSION_KEYS: it must survive clearing.
export const KEY_EPOCH = "glass_session_epoch";

export function getAccessToken() {
  try {
    return localStorage.getItem(KEY_TOKEN);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(KEY_REFRESH_TOKEN);
  } catch {
    return null;
  }
}

export function readStoredUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user) {
  try {
    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(KEY_USER);
  } catch {
    // Storage unavailable (private mode quota) — React state remains source.
  }
}

export function getSessionEpoch() {
  try {
    const raw = localStorage.getItem(KEY_EPOCH);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function bumpSessionEpoch() {
  const next = getSessionEpoch() + 1;
  try {
    localStorage.setItem(KEY_EPOCH, String(next));
  } catch {
    // ignore — callers still set React state
  }
  return next;
}

/**
 * Invalidate the session generation for a session that is ENDING.
 *
 * Distinct from bumpSessionEpoch() on purpose. When the store cannot be
 * written, a plain bump leaves the generation UNCHANGED, and an in-flight
 * refresh captured at that generation still matches it — so it would write
 * its tokens straight back over the session that logout() just ended. That
 * is the one race this module exists to make impossible, and it must not be
 * lost to a storage error.
 *
 * Falling back to removing the key makes getSessionEpoch() read 0. No
 * session-bearing operation ever runs at generation 0 (every persisted
 * session bumps the generation to at least 1 first), so every in-flight
 * operation sees a mismatch and refuses to write back. Failing safe by
 * over-refusing is the right trade: a spurious sign-out is recoverable, a
 * resurrected session is not.
 *
 * Only the ending path uses this. A successful write takes the normal path
 * and nothing else changes.
 */
function invalidateSessionEpoch() {
  try {
    localStorage.setItem(KEY_EPOCH, String(getSessionEpoch() + 1));
    return;
  } catch {
    // fall through to the removal fallback
  }
  try {
    localStorage.removeItem(KEY_EPOCH);
  } catch {
    // Storage is entirely unavailable. The tokens live in the same store, so
    // there is no session left to resurrect either.
  }
}

/**
 * Write one session field, treating an ABSENT value as a real absence.
 *
 * The session-bearing auth responses all share the backend's `AuthResponse`
 * shape (see the OpenAPI document: /auth/login, /auth/register, /auth/verify,
 * /auth/google, /auth/otp/verify and both MFA verify routes return it), and
 * that shape carries BOTH tokens. A missing one therefore means "the backend
 * did not issue it" — not "keep whatever happened to be there before".
 *
 * Leaving the previous value in place is not a neutral no-op. localStorage
 * outlives the tab and the browser restart, so the PREVIOUS ACCOUNT's refresh
 * token would survive a second sign-in. The first 401 would then exchange
 * that stale token for a fresh access token for the first account and write it
 * back — silently acting as the wrong user, with no rotation-reuse signal,
 * because that token was never rotated away.
 *
 * Removing is also what the refresh path wants: client.js treats a falsy
 * refresh token as "no session" and signs out cleanly, instead of putting the
 * literal string "undefined" in front of the backend.
 *
 * The trade-off is deliberate: if the backend ever stops issuing a refresh
 * token on some auth route, the user is asked to sign in again when the
 * access token expires (loud, safe) rather than inheriting another account's
 * session (silent, wrong). "undefined" is treated as absent for the same
 * reason — it must never reach the refresh endpoint.
 */
function writeSessionField(key, value) {
  if (typeof value === "string" && value !== "" && value !== "undefined") {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Persist tokens + basic identity from an auth response.
 * An absent field is cleared, not inherited — see writeSessionField above.
 * Starts a new session generation: any stale in-flight operation from a
 * previous generation must not overwrite these tokens (see client.js).
 */
export function persistSession(authData) {
  if (!authData) return;
  try {
    writeSessionField(KEY_TOKEN, authData.accessToken);
    writeSessionField(KEY_REFRESH_TOKEN, authData.refreshToken);
    writeSessionField("userId", authData.userId);
    writeSessionField("userEmail", authData.email);
    bumpSessionEpoch();
  } catch {
    // ignore — callers still set React state
  }
}

/** Apply tokens from a refresh response (same dual-envelope already unwrapped by caller). */
export function applyRefreshedTokens(data) {
  if (!data?.accessToken) return;
  try {
    localStorage.setItem(KEY_TOKEN, data.accessToken);
    if (data.refreshToken) localStorage.setItem(KEY_REFRESH_TOKEN, data.refreshToken);
  } catch {
    // ignore
  }
}

// ── Minimal in-tab session-end event ─────────────────────────────────────────
// Cross-tab sync stays on the `storage` event (AuthContext subscribes).
// This emitter only lets in-tab subscribers (e.g. cache owners) react to a
// local clear without importing React or routing here.
const sessionEndListeners = new Set();

export function onSessionEnd(listener) {
  sessionEndListeners.add(listener);
  return () => sessionEndListeners.delete(listener);
}

function emitSessionEnd() {
  sessionEndListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // never break the clearer
    }
  });
}

/**
 * Remove every session key AND every session-adjacent value.
 * Idempotent — safe to call from N queued 401s.
 *
 * Ordering is the invariant this function exists to guarantee:
 * authenticated state is fully gone BEFORE emitSessionEnd(), so a listener
 * (or anything reading storage from a synchronous continuation) can never
 * observe a half-cleared session where tokens are dropped but the user's
 * own data is still readable.
 */
export function clearSessionStorage() {
  try {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    SESSION_ADJACENT_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  // Separate pass, and deliberately NOT folded into the lists above: those are
  // cleared with localStorage.removeItem, and sessionStorage is a different
  // store. Listing a sessionStorage key there would silently clear nothing,
  // which is how "the token is cleaned up" can be true in review and false at
  // runtime. Same reason it can't join SESSION_KEYS: widening that list would
  // make deleting one key tear down every other tab's live session.
  try {
    SESSION_TRANSIENT_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
  // Invalidate the generation FIRST from the perspective of in-flight work:
  // any refresh started before this clear must observe the mismatch and
  // refuse to write tokens back (see client.js doRefresh).
  invalidateSessionEpoch();
  emitSessionEnd();
}
