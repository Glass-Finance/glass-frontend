/**
 * src/store/AuthContext.jsx
 *
 * Single source of truth for auth state.
 *
 * Token keys (unified — one set, used everywhere):
 *   localStorage "accessToken"   ← matches authService.storeAuthSession + client.js interceptor
 *   localStorage "refreshToken"  ← used by client.js auto-refresh interceptor
 *   localStorage "glass_user"    ← serialised user object
 *
 * Flow:
 *   1. Mount  → restore session from localStorage
 *   2. login()→ calls authService.login(), stores tokens, sets state
 *   3. 401    → client.js interceptor tries refresh, on failure clears tokens
 *   4. logout()→ calls authService.logout(), clears everything
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { login as apiLogin, logout as apiLogout, storeAuthSession } from "../services/authService";
import { getMe } from "../api/members";
import { setSessionRestoring } from "../api/client";
import { fetchCompleteMyCommunityList } from "../api/communityList";
import {
  SESSION_KEYS,
  getAccessToken,
  readStoredUser,
  writeStoredUser,
  clearSessionStorage,
} from "./sessionStorage";
import { parseUserData } from "../utils/userData";
import { safeImageUrl } from "../utils/safeImageUrl";
import { isCommunityAdmin } from "../utils/communityRole";
import { isPlatformAdminRole } from "../utils/platformRole";

// Community-admin standing is separate from the backend's global
// platformRole. A USER may still administer one or more communities, while
// any other non-empty platformRole is a platform admin independently of
// community ownership.
function hasAdminCommunity(communities) {
  return (communities ?? []).some(isCommunityAdmin);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// Single-flight hydration fetch shared across StrictMode double-mounts and
// concurrent refreshUser()/restore() callers. The network pair fires once;
// each caller still applies the result to its own React state, so a
// stale/unmounted setter can never poison another mount.
//
// The communities half is fetchCompleteMyCommunityList(), which may issue more
// than one request for a user in > 10 communities. Single-flight is what keeps
// that safe for bootstrap: the whole walk runs at most once per hydration, and
// the promise is cleared in .finally() so a later restore() starts a fresh one
// rather than reusing a resolved result. It also means a failure on any page
// rejects for every awaiting caller, which is what the fail-closed branch in
// hydrateUserProfile() relies on.
let hydrateFetchPromise = null;

function fetchHydrationOnce() {
  if (!hydrateFetchPromise) {
    hydrateFetchPromise = Promise.all([getMe(), fetchCompleteMyCommunityList()]).finally(() => {
      hydrateFetchPromise = null;
    });
  }
  return hydrateFetchPromise;
}

// writeStoredUser/clearSessionStorage own the key list (see sessionStorage.js).
// clearSession is the local-state counterpart: storage clear + community
// pointer hygiene live in clearSessionStorage; this wrapper exists so the
// call sites below read unchanged.
function clearSession() {
  clearSessionStorage();
}

// Fields that carry PRIVILEGE standing on the user object.
//
// Admin standing is derived server-side — from the auth response at login
// (buildUser) and from GET /user/me at hydration (hydrateUserProfile) — and
// from nowhere else. These three are the fields the route guards read, so
// they are stripped from any client-supplied patch (see updateUser) rather
// than trusted with a comment as their only protection.
const PRIVILEGE_FIELDS = ["role", "isAdmin", "isPlatformAdmin"];

// Callers (SignIn pages' routeAfterAuth) need an accurate isAdmin on the
// object login()/setSession() resolve with, immediately — not from a
// separate async refresh that might not have landed yet. So the admin
// check happens here, awaited, before login()/setSession() return.
async function buildUser(authData) {
  const responseUser = authData.user ?? {};
  let id = authData.userId ?? responseUser.id;
  let email = authData.email ?? responseUser.email;
  let role = authData.platformRole ?? responseUser.platformRole;
  let emailVerified = authData.emailVerified ?? responseUser.emailVerified;

  // OAuth responses have not always matched the password-login response
  // shape. Fill missing identity fields from the authenticated profile so
  // role routing remains identical across both login methods.
  if (!id || !email || !role) {
    try {
      const meRes = await getMe();
      const profile = meRes.data?.data ?? meRes.data;
      id ??= profile?.id;
      email ??= profile?.email;
      role ??= profile?.platformRole;
      emailVerified ??= profile?.emailVerified;
    } catch {
      // Keep the auth response fields; missing roles fail closed below.
    }
  }

  const isPlatformAdmin = isPlatformAdminRole(role);
  const user = {
    id,
    email,
    role,
    emailVerified,
    isPlatformAdmin,
    isAdmin: isPlatformAdmin,
  };
  try {
    // The COMPLETE list, not the first page. /communities/me defaults to 10
    // communities and was read raw here, so an admin whose single administered
    // community sorted past row 10 resolved isAdmin: false -- which
    // ProtectedRoute turns into a redirect away from every admin-gated route,
    // locking a real admin out of the dashboard entirely.
    user.isAdmin = isPlatformAdmin || hasAdminCommunity(await fetchCompleteMyCommunityList());
  } catch {
    // Platform admins retain global access even if community lookup fails.
  }
  return user;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // Whether the current token + role state has been verified against the
  // backend (login/setSession's buildUser check, or restore's refreshUser).
  // Guards treat an unverified session as unauthenticated — a token merely
  // being present in localStorage proves nothing until the server confirms
  // it, and cached roles in glass_user are client-writable.
  const [sessionVerified, setSessionVerified] = useState(false);
  const queryClient = useQueryClient();
  // Prevents the token-change effect from firing a second refreshUser()
  // while restore() is already in the middle of one.
  const isRestoringRef = useRef(false);

  // Stay in sync if another tab ends the session. Watch every session key
  // (not just the access token) so a clear from any path — user logout,
  // refresh failure, fail-closed restore — converges all tabs. Clearing the
  // QueryClient matters as much as clearing React state: cached queries
  // carry no user identity, so without this the next account on this tab
  // would briefly see the previous account's data. Guards already redirect
  // on token==null, so no imperative navigation is needed here.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key && !SESSION_KEYS.includes(e.key)) return;
      // localStorage.clear() fires with key==null — treat as session end
      // only when the access token is actually gone.
      if (e.key && e.newValue) return;
      if (getAccessToken()) return;
      queryClient.clear();
      setToken(null);
      setUser(null);
      setSessionVerified(false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  // ── login ──────────────────────────────────────────────────────────────────
  /**
   * Calls authService.login() → stores tokens → updates state.
   * Identifier is email OR phoneNumber(+phoneRegion) -- never both.
   * Returns:
   *   { mfaRequired: true, mfaChallengeToken } — if MFA is needed (no session yet)
   *   user object                              — on success
   *
   * Throws on bad credentials / network error.
   */
  const login = useCallback(
    async ({ email, phoneNumber, phoneRegion, password }) => {
      // authService.login returns data.data (already unwrapped)
      const authData = await apiLogin({ email, phoneNumber, phoneRegion, password });
      // {
      //   accessToken, refreshToken, userId, email,
      //   platformRole, emailVerified, mfaRequired, mfaChallengeToken
      // }

      // MFA gate — caller must show TOTP screen, no session stored yet
      if (authData.mfaRequired) {
        return {
          mfaRequired: true,
          mfaChallengeToken: authData.mfaChallengeToken,
        };
      }

      // Persist tokens using the same helper authService exposes
      // so keys are guaranteed identical everywhere
      storeAuthSession(authData);

      // Every data hook (communities, notifications, member records, ...)
      // caches under a query key with no user identity in it, and the
      // QueryClient is a single instance that outlives any one session — so
      // without this, logging in as a different account on the same tab
      // serves the previous account's still-cached data until each query's
      // own staleTime happens to expire.
      queryClient.clear();

      const user = await buildUser(authData);

      writeStoredUser(user);
      setToken(authData.accessToken);
      setUser(user);
      setSessionVerified(true);

      if (typeof pendo !== "undefined") {
        pendo.identify({
          visitor: {
            id: user.id,
            platformRoleCode: user.role,
            emailVerified: user.emailVerified,
          },
        });
      }

      return user;
    },
    [queryClient],
  );

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await apiLogout(); // best-effort — server invalidates refresh token
    } catch {
      // ignore — clear locally regardless
    } finally {
      clearSession();
      queryClient.clear(); // see login()'s comment — same staleness risk in reverse
      setToken(null);
      setUser(null);
      setSessionVerified(false);
      // Pendo's install snippet only pre-stubs initialize/identify/
      // updateOptions/pageLoad/track/trackAgent — clearSession isn't in
      // that list, so it's only real once the CDN script actually loads.
      // Blocked by an ad-blocker or a strict CSP (common in production),
      // it stays undefined and this throws, which previously skipped the
      // navigate() in handleLogout entirely.
      if (typeof pendo?.clearSession === "function") pendo.clearSession();
    }
  }, [queryClient]);

  // ── setSession (for post-MFA, Google OAuth, etc.) ─────────────────────────
  /**
   * Manually set a session when you have auth data from a non-login flow
   * (e.g. after verifyMfaLogin, googleAuth).
   * Pass the raw authData object from the API response.
   */
  const setSession = useCallback(
    async (authData) => {
      storeAuthSession(authData);
      queryClient.clear(); // see login()'s comment
      const user = await buildUser(authData);
      writeStoredUser(user);
      setToken(authData.accessToken);
      setUser(user);
      setSessionVerified(true);

      if (typeof pendo !== "undefined") {
        pendo.identify({
          visitor: {
            id: user.id,
            platformRoleCode: user.role,
            emailVerified: user.emailVerified,
          },
        });
      }

      return user;
    },
    [queryClient],
  );

  // ── storeSessionIfPresent ──────────────────────────────────────────────────
  // Centralized "persist this auth response if it actually carries a
  // session" helper — replaces the duplicated maybeStoreSession closures
  // that lived in SignUp.jsx and Join/index.jsx. Always await it before
  // navigating: setSession() resolves admin standing via buildUser() first,
  // so navigating early routes on pre-session state.
  // Returns true when a session was stored, false when authData carries none.
  const storeSessionIfPresent = useCallback(
    async (authData) => {
      if (!authData?.accessToken) return false;
      await setSession(authData);
      return true;
    },
    [setSession],
  );

  // ── updateUser ─────────────────────────────────────────────────────────────
  // Call after profile edits so the UI reflects the change immediately.
  // NOTE: privilege fields (isAdmin/isPlatformAdmin/role) must never be set
  // through here — admin standing is derived server-side at login/restore, and
  // there is no longer any exception.
  //
  // There WAS one, and this comment used to document it: OrganizationProfile
  // called updateUser({ isAdmin: true }) after creating a community, because
  // the cached communities list predated the new one and routing would bounce.
  // It now calls refreshUser() instead, which re-derives standing from the
  // server. The rule above is therefore unconditional — a privilege flag
  // written from the client is read back by ProtectedRoute as though the
  // backend had said so, which is the thing this guards against.
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      // Privilege fields are STRIPPED, not merely discouraged. The comment
      // above says they must never be set through here — but a comment is not
      // a control, and this is the only place the user object is assembled
      // from an arbitrary patch. ProtectedRoute reads `isAdmin` straight off
      // this object, so a client-written flag would be honoured exactly as
      // though the backend had granted it. Admin standing is derived
      // server-side at login/restore (buildUser, hydrateUserProfile) and
      // nowhere else.
      const safePatch = { ...patch };
      for (const field of PRIVILEGE_FIELDS) delete safePatch[field];
      const updated = { ...prev, ...safePatch };
      writeStoredUser(updated);
      return updated;
    });
  }, []);

  // SECURITY: profileImage.url is server-supplied (GET /user/me -> userData) and
  // every consumer (Topbar, NotificationPanel(s), memberApp Notifications, the
  // #82 sidebar avatar) binds it to an <img src>. Validate once HERE, at the one
  // boundary that produces the field, rather than at each of those sinks — which
  // is the same reasoning PR #79 and PR #83 applied to the components they
  // touched. The shape is preserved (still an object with a `url`), only the URL
  // is normalized; a rejected URL becomes null so consumers fall through to
  // their existing initials fallback.
  //
  // Used on BOTH paths into user state: the network assignment below, and the
  // readStoredUser() rehydration in restore(). Persisted user state outlives the
  // session that wrote it, so an unsanitized value stored before this change (or
  // tampered with locally) would otherwise reach first paint untouched.
  const normalizeProfileImage = useCallback((profileImage) => {
    if (!profileImage) return profileImage;
    const url = safeImageUrl(profileImage.url);
    if (url === profileImage.url) return profileImage;
    return { ...profileImage, url: url ?? null };
  }, []);

  // ── hydrateUserProfile (profile hydration — NOT token refresh) ──────────
  // login()/setSession() only ever populate {id, email, role, emailVerified}
  // — flat fields off the auth response, which has no name or photo on it.
  // Sidebar/Topbar/Settings all want firstName/lastName/profileImage, which
  // only exist on GET /user/me. Fetch it once we have a token, and let
  // callers (e.g. after a profile save) re-call this to pick up changes
  // immediately instead of waiting for the next full login.
  // Returns true when the session was re-verified against the backend,
  // false when verification failed — in which case the previous user state
  // is left untouched and the caller decides what to do (restore() fails
  // closed; post-login enrichment keeps the just-verified login state).
  // The underlying GET pair is single-flight (fetchHydrationOnce) so
  // StrictMode double-mounts and concurrent callers share one network
  // round-trip instead of firing duplicates. The communities half is the
  // COMPLETE list -- see fetchCompleteMyCommunityList -- so admin standing is
  // derived from every community the user belongs to, not the first page.
  const hydrateUserProfile = useCallback(async () => {
    let meRes;
    let communities;
    try {
      // fetchCompleteMyCommunityList resolves to the community ARRAY, not an
      // axios response, so `communities` is already the complete list.
      [meRes, communities] = await fetchHydrationOnce();
    } catch {
      // Do NOT fall back to stale state here — the caller (restore())
      // treats a false return as "unverifiable" and fails closed.
      return false;
    }
    const profile = meRes.data?.data ?? meRes.data;
    if (!profile) return false;
    const ud = parseUserData(profile);
    setUser((prev) => {
      if (!prev) return prev; // logged out while this was in flight
      // A missing server role is UNKNOWN, not "keep the previous one".
      //
      // `prev.role` comes from the `glass_user` snapshot in localStorage,
      // which is client-writable — devtools, an extension, XSS, or anyone
      // with the browser open can set it. Falling back to it here would let a
      // tampered value re-grant platform-admin standing the moment the
      // server omits the field, and this same state update is the one that
      // keeps `sessionVerified` true, so the guard would render the admin
      // shell on it.
      //
      // The backend's UserDto always carries platformRole (it is a declared
      // property of GET /user/me), so an absent one is a malformed response,
      // not a normal case. Failing closed costs a routing decision, not
      // access: isPlatformAdminRole("") is false, so the user is routed as a
      // non-admin and the backend stays authoritative either way.
      const role = profile.platformRole ?? "";
      const isPlatformAdmin = isPlatformAdminRole(role);
      const updated = {
        ...prev,
        email: profile.email ?? prev.email,
        // The account's stable external reference (auth.users
        // .external_user_reference), exposed by GET /user/me as
        // `externalReference`. Read-only from our side: the backend generates it
        // once and never updates it. CrispChat passes it to Crisp.setTokenId()
        // so a support conversation follows the user across devices.
        //
        // `?? prev.` so a re-hydration that fails to carry the field (older
        // backend, partial response) can't downgrade a token we already hold to
        // undefined — losing it would silently unbind the Crisp session.
        externalReference: profile.externalReference ?? prev.externalReference,
        role,
        firstName: ud.firstName,
        lastName: ud.lastName,
        phoneNumber: profile.phoneNumber ?? ud.phone,
        profileImage: normalizeProfileImage(ud.profileImage),
        isPlatformAdmin,
        isAdmin: isPlatformAdmin || hasAdminCommunity(communities),
      };
      writeStoredUser(updated);
      return updated;
    });

    // Re-identify with enriched profile + community (account) data.
    // PII minimisation: the visitor id is the opaque backend UUID — email,
    // first/last/full name are deliberately NOT sent to Pendo (product
    // analytics doesn't need them; NDPR/GDPR data-minimisation does). Account
    // (community) fields stay because they're organisation-level, not personal.
    if (profile.id && typeof pendo !== "undefined") {
      const pendoPayload = {
        visitor: {
          id: profile.id,
          accountName: profile.accountName,
          timezone: profile.timezone,
          platformRoleCode: profile.platformRole,
          emailVerified: profile.emailVerified,
          emailVerifiedAt: profile.emailVerifiedAt,
          lastLoginAt: profile.lastLoginAt,
          enabled: profile.enabled,
          createdAt: profile.createdAt,
        },
      };
      const primaryCommunity = communities[0];
      if (primaryCommunity) {
        pendoPayload.account = {
          id: String(primaryCommunity.id),
          name: primaryCommunity.name,
          slug: primaryCommunity.slug,
          category: primaryCommunity.category,
          defaultCurrency: primaryCommunity.defaultCurrency,
          status: primaryCommunity.status,
          requiresMemberApproval: primaryCommunity.requiresMemberApproval,
          publicVisible: primaryCommunity.publicVisible,
          createdAt: primaryCommunity.createdAt,
          archivedAt: primaryCommunity.archivedAt,
        };
      }
      pendo.identify(pendoPayload);
    }
    return true;
  }, [normalizeProfileImage]);

  // Backwards-compatible alias — public API stays stable.
  const refreshUser = hydrateUserProfile;

  // Restore session on mount. Until hydrateUserProfile() confirms the cached
  // token + roles against the backend, nothing renders as authenticated:
  // the cached glass_user is client-writable, so routing on it before
  // verification would honor stale or tampered admin standing. A failed
  // hydration fails closed — cached tokens/roles are dropped rather than
  // preserved, so guards redirect to sign-in instead of rendering on them.
  // Single-flight + StrictMode-safe: concurrent mounts share the same
  // hydration fetch (fetchHydrationOnce), and the restoring flag lives in
  // client.js (setSessionRestoring) instead of a window global.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const storedToken = getAccessToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      isRestoringRef.current = true;
      setSessionRestoring(true);
      setToken(storedToken);
      // Rehydrate through the same normalization as the network path, so a
      // persisted URL can never become active user state unsanitized.
      //
      // The normalized value is also written back, not just used. Normalizing
      // only the React state would leave an already-poisoned `glass_user`
      // poisoned on disk: it would keep being read on every later mount, and
      // any other reader of the stored value would still see the raw URL. This
      // is also a migration — a value persisted before this normalization
      // existed gets cleaned up the first time it is read.
      const storedUser = readStoredUser();
      const normalizedImage = normalizeProfileImage(storedUser?.profileImage);
      // normalizeProfileImage returns the SAME reference when the URL was
      // already safe, so this identity check is how we tell "normalization
      // changed something" from "nothing to do" — a fresh {...storedUser} would
      // always be a new object and defeat the comparison. Skipping the write on
      // the unchanged path avoids redundant localStorage I/O on every mount.
      const needsRewrite = Boolean(storedUser) && normalizedImage !== storedUser.profileImage;
      const restoredUser = needsRewrite
        ? { ...storedUser, profileImage: normalizedImage }
        : storedUser;
      if (needsRewrite) writeStoredUser(restoredUser);
      setUser(restoredUser);
      try {
        const verified = await hydrateUserProfile();
        if (cancelled) return;
        if (verified) {
          setSessionVerified(true);
        } else {
          clearSession();
          queryClient.clear();
          setToken(null);
          setUser(null);
          setSessionVerified(false);
        }
      } finally {
        if (!cancelled) {
          setSessionRestoring(false);
          isRestoringRef.current = false;
          setLoading(false);
        }
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [hydrateUserProfile, queryClient, normalizeProfileImage]);

  // Only fires for token changes that happen AFTER the initial restore
  // (login, setSession, OAuth). The restore() above handles its own hydration.
  useEffect(() => {
    if (token && !isRestoringRef.current) hydrateUserProfile();
  }, [token, hydrateUserProfile]);

  // ── Derive role helpers ────────────────────────────────────────────────────
  // Global platform admins and per-community admins both have desktop
  // dashboard access. isPlatformAdmin remains separate for platform-only UI.
  //
  // Derived from the role CODE, never from a boolean stored on the user
  // object. Both builders (buildUser at login, hydrateUserProfile at
  // hydration) set that boolean from the same exact-set check, so deriving
  // it again here changes nothing for a legitimate session — but it stops
  // the guards reading a field that a client could write into the
  // `glass_user` snapshot. platformRole.js fails closed on anything that is
  // not an exact match.
  const isPlatformAdmin = isPlatformAdminRole(user?.role);
  const isAdmin = isPlatformAdmin || (user?.isAdmin ?? false);
  const isMember = !isAdmin;

  // Memoised, not a fresh literal on every render. useAuth() is imported in
  // 35 files across the app and there is no React.memo anywhere in the
  // codebase, so an unstable provider value re-renders every one of those
  // subtrees on any AuthProvider state change — including changes that leave
  // `user` and `token` identical (a `loading` flip during restore, say).
  //
  // Every action above is already useCallback-wrapped, so they are referentially
  // stable and belong in the dep list for correctness only: dropping them would
  // be safe today but would silently start serving stale actions the day one
  // is un-memoised. `isAuthenticated` is derived from `token` rather than being
  // listed itself, since it is a pure function of an already-listed value.
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      sessionVerified,
      isAuthenticated: !!token,
      isPlatformAdmin,
      isAdmin,
      isMember,

      // Actions
      login,
      logout,
      setSession,
      storeSessionIfPresent,
      updateUser,
      refreshUser,
      hydrateUserProfile,
    }),
    [
      user,
      token,
      loading,
      sessionVerified,
      isPlatformAdmin,
      isAdmin,
      isMember,
      login,
      logout,
      setSession,
      storeSessionIfPresent,
      updateUser,
      refreshUser,
      hydrateUserProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// react-refresh/only-export-components wants this in its own file so Fast
// Refresh doesn't reset AuthProvider's state on every edit here -- true, but
// useAuth is imported in 35 files across the app, all touching auth. Moving
// it isn't a safe mechanical change to make without visually verifying every
// call site, and the downside of leaving it is a dev-server-only HMR
// nicety, not a production bug. Deliberately left as the standard
// context+hook-in-one-file pattern.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
