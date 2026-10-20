import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SESSION_KEYS,
  SESSION_ADJACENT_KEYS,
  SESSION_TRANSIENT_KEYS,
  KEY_TOKEN,
  KEY_EPOCH,
  getAccessToken,
  getRefreshToken,
  getSessionEpoch,
  readStoredUser,
  writeStoredUser,
  persistSession,
  applyRefreshedTokens,
  clearSessionStorage,
  onSessionEnd,
} from "../../store/sessionStorage";

describe("sessionStorage — single owner of session keys", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("owns the full session key list both clear paths must remove", () => {
    expect(SESSION_KEYS).toEqual(
      expect.arrayContaining([
        "accessToken",
        "refreshToken",
        "glass_user",
        "userId",
        "userEmail",
        "glass_community",
        "glass_member_community",
      ]),
    );
    expect(SESSION_KEYS).toHaveLength(7);
  });

  it("persistSession stores tokens + identity without writing literal 'undefined'", () => {
    persistSession({ accessToken: "a", userId: "u", email: "e@example.com" });
    expect(localStorage.getItem("accessToken")).toBe("a");
    expect(localStorage.getItem("userId")).toBe("u");
    expect(localStorage.getItem("userEmail")).toBe("e@example.com");
    // Missing refreshToken must not create a truthy "undefined" string.
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("applyRefreshedTokens overwrites access and rotates refresh when present", () => {
    localStorage.setItem("accessToken", "old");
    localStorage.setItem("refreshToken", "old-refresh");
    applyRefreshedTokens({ accessToken: "new" });
    expect(localStorage.getItem("accessToken")).toBe("new");
    expect(localStorage.getItem("refreshToken")).toBe("old-refresh");
    applyRefreshedTokens({ accessToken: "new2", refreshToken: "new-refresh" });
    expect(localStorage.getItem("refreshToken")).toBe("new-refresh");
  });

  it("clearSessionStorage removes every session key and notifies listeners", () => {
    SESSION_KEYS.forEach((k) => localStorage.setItem(k, "x"));
    localStorage.setItem("unrelated", "keep");
    let notified = 0;
    const unsub = onSessionEnd(() => {
      notified += 1;
    });
    clearSessionStorage();
    SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(notified).toBe(1);
    unsub();
    // Idempotent — safe for N queued 401s calling it in the same tick.
    expect(() => clearSessionStorage()).not.toThrow();
  });

  it("keeps SESSION_ADJACENT_KEYS at exactly the three localStorage keys it declares", () => {
    // The transient pass must NOT have widened this list. These are cleared
    // with localStorage.removeItem, so a sessionStorage key added here would
    // clear nothing while looking like it was covered.
    expect(SESSION_ADJACENT_KEYS).toEqual([
      "glass_pending_join_requests",
      "glass_notification_prefs",
      "glass_last_google_identity",
    ]);
    // No overlap: the transient list is a different store entirely.
    expect(SESSION_TRANSIENT_KEYS.some((k) => SESSION_ADJACENT_KEYS.includes(k))).toBe(false);
    expect(SESSION_TRANSIENT_KEYS.some((k) => SESSION_KEYS.includes(k))).toBe(false);
  });

  it("clearSessionStorage removes glass_reset_otp from REAL sessionStorage", () => {
    // The regression this exists to prevent: a reset token that survives logout
    // is handed to whoever signs in next on the same tab.
    sessionStorage.setItem("glass_reset_otp", JSON.stringify({ email: "a@b.com", token: "123" }));

    clearSessionStorage();

    expect(sessionStorage.getItem("glass_reset_otp")).toBeNull();
  });

  it("leaves unrelated sessionStorage keys alone", () => {
    sessionStorage.setItem("unrelated-tab-state", "keep");

    clearSessionStorage();

    expect(sessionStorage.getItem("unrelated-tab-state")).toBe("keep");
  });

  it("still clears the localStorage session keys exactly as before", () => {
    // The transient pass is additive: it must not have replaced or reordered
    // the existing two localStorage loops.
    SESSION_KEYS.forEach((k) => localStorage.setItem(k, "x"));
    sessionStorage.setItem("glass_reset_otp", "t");

    clearSessionStorage();

    SESSION_KEYS.forEach((k) => expect(localStorage.getItem(k)).toBeNull());
    expect(sessionStorage.getItem("glass_reset_otp")).toBeNull();
  });

  it("is idempotent for the transient pass too", () => {
    sessionStorage.setItem("glass_reset_otp", "t");
    clearSessionStorage();
    expect(() => clearSessionStorage()).not.toThrow();
    expect(sessionStorage.getItem("glass_reset_otp")).toBeNull();
  });

  it("read/writeStoredUser round-trips and tolerates corrupt JSON", () => {
    expect(readStoredUser()).toBeNull();
    writeStoredUser({ id: "1" });
    expect(readStoredUser()).toEqual({ id: "1" });
    writeStoredUser(null);
    expect(localStorage.getItem("glass_user")).toBeNull();
    localStorage.setItem("glass_user", "{broken");
    expect(readStoredUser()).toBeNull();
  });

  it(`getAccessToken reads the same "${KEY_TOKEN}" key the interceptor uses`, () => {
    localStorage.setItem(KEY_TOKEN, "tok");
    expect(getAccessToken()).toBe("tok");
    expect(getRefreshToken()).toBeNull();
  });
});

describe("sessionStorage — a new session never inherits a previous one's tokens", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears the previous session's refresh token when the new response omits it", () => {
    // The cross-account bleed this prevents. localStorage outlives the tab and
    // the browser restart, so a second sign-in whose response carries no
    // refreshToken used to leave the FIRST account's token in place — and the
    // first 401 would then exchange it for a fresh access token for that
    // first account, silently acting as the wrong user.
    localStorage.setItem(KEY_TOKEN, "account-a-access");
    localStorage.setItem("refreshToken", "account-a-refresh");

    persistSession({ accessToken: "account-b-access" });

    expect(localStorage.getItem(KEY_TOKEN)).toBe("account-b-access");
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("replaces every identity field when a new session is persisted", () => {
    localStorage.setItem(KEY_TOKEN, "a-access");
    localStorage.setItem("refreshToken", "a-refresh");
    localStorage.setItem("userId", "a-user");
    localStorage.setItem("userEmail", "a@example.com");

    persistSession({
      accessToken: "b-access",
      refreshToken: "b-refresh",
      userId: "b-user",
      email: "b@example.com",
    });

    expect(localStorage.getItem(KEY_TOKEN)).toBe("b-access");
    expect(localStorage.getItem("refreshToken")).toBe("b-refresh");
    expect(localStorage.getItem("userId")).toBe("b-user");
    expect(localStorage.getItem("userEmail")).toBe("b@example.com");
  });

  it("never stores the literal string 'undefined' as a token", () => {
    // The original contract: client.js treats a truthy "undefined" refresh
    // token as a real token and sends it to the backend.
    persistSession({ accessToken: "undefined", refreshToken: "undefined" });

    expect(localStorage.getItem(KEY_TOKEN)).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("invalidates the session generation even when the epoch write fails", () => {
    // A logout that cannot write the new generation must not leave an
    // in-flight refresh matching the old one — that refresh would write its
    // tokens straight back over the session logout() just ended.
    localStorage.setItem(KEY_TOKEN, "tok");
    localStorage.setItem(KEY_EPOCH, "3");
    const before = getSessionEpoch();
    expect(before).toBe(3);

    const originalSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === KEY_EPOCH) throw new DOMException("QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    try {
      clearSessionStorage();

      // The generation must have moved on. Over-refusing (an in-flight
      // operation seeing a mismatch it does not need to see) is the safe
      // direction; a resurrected session is not.
      expect(getSessionEpoch()).not.toBe(before);
      expect(localStorage.getItem(KEY_TOKEN)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
