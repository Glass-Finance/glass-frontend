import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGoogleOAuth } from "@react-oauth/google";
import { googleAuth } from "../../services/authService";
import { useAuth } from "../../store/AuthContext";
import { notifyError } from "../../utils/errorHandler";

const LABELS = {
  signin_with: "Sign in with Google",
  signup_with: "Sign up with Google",
  continue_with: "Continue with Google",
};

// Google's own personalized state ("Sign in as David, name@gmail.com" with
// a photo) lives entirely inside its cross-origin iframe -- it's never
// exposed to the host page in advance, only ever visible if Google's own
// rendered element is what's shown, which is exactly the sizing/shape
// tradeoff this custom button exists to avoid. This reconstructs the same
// *feeling* on our own terms instead: the `credential` JWT we already get
// back on a successful sign-in carries the account's email/picture as plain
// (unverified, display-only -- the backend independently verifies the real
// credential) claims, cached here so a *returning* visitor sees "Continue
// as name@gmail.com" with their photo on our own pixel-matched button,
// without ever needing to read anything out of Google's iframe.
const IDENTITY_KEY = "glass_last_google_identity";

// Nothing tells us when the browser's actual Google session changes (that
// data lives behind the same cross-origin wall as everything else here) --
// so an entry from a since-abandoned or switched-away-from account would
// otherwise sit here forever, permanently showing the wrong email/photo
// instead of the plain G logo + generic label a first-time/unrecognized
// visitor should see. A week is long enough to still feel like "remembers
// me" for a genuinely returning visitor, short enough that a one-off or
// switched-account sign-in doesn't linger indefinitely.
const IDENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readCachedIdentity() {
  try {
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY));
    if (!stored) return null;
    if (!stored.cachedAt || Date.now() - stored.cachedAt > IDENTITY_TTL_MS) {
      localStorage.removeItem(IDENTITY_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function writeCachedIdentity(identity) {
  try {
    if (identity) {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...identity, cachedAt: Date.now() }));
    } else {
      localStorage.removeItem(IDENTITY_KEY);
    }
  } catch {
    /* ignore */
  }
}

// Display-only decode -- the backend independently verifies the real
// credential in googleAuth() below, so no signature check is needed here.
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Google's own rendered button (the old <GoogleLogin/> widget) lives inside
// a cross-origin iframe -- no CSS reaches inside it, only fixed shape/size
// presets. Calling google.accounts.id.prompt() from our own button instead
// (the first version of this file) got the sizing exactly right but wasn't
// reliable: Chrome's FedCM treats an unprompted prompt() call as a
// synthetic request and silently blocks it after the first dismissal
// ("FedCM was disabled... based on previous user action") -- confirmed
// live, not a theoretical risk. Google only grants the reliable, ungated
// path to a genuine click on ITS OWN rendered element.
//
// This keeps both: Google's real button is rendered into `hiddenBtnRef`,
// sized to match and stacked exactly over the visible custom-styled div
// below via position:absolute + opacity:0, so the click a user sees land
// on our design is actually landing on Google's real button underneath --
// same ID-token `credential` callback, same backend contract, no gating.
export default function GoogleAuthButton({ onAuthenticated, label = "continue_with" }) {
  const { setSession } = useAuth();
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
  const wrapRef = useRef(null);
  const hiddenBtnRef = useRef(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  // Keep the ref pointing at the latest callback without mutating it during
  // render -- useLayoutEffect runs synchronously right after this render
  // commits, so Google's callback (which fires from outside React's render
  // cycle) always sees the current `onAuthenticated`, not a stale closure.
  useLayoutEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  });
  const [width, setWidth] = useState(320);
  const [identity, setIdentity] = useState(() => readCachedIdentity());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  // Ref, not state: the renderButton effect below needs to know whether
  // initialize() succeeded, and it runs immediately after the init effect in
  // the same commit. A state write here would only add a second render pass,
  // and would make "did init work" a re-render trigger for no benefit.
  const initializedRef = useRef(false);

  const hasClientId = typeof clientId === "string" && clientId.trim().length > 0;
  const gisError = !hasClientId ? "missing-client-id" : initFailed ? "init-failed" : null;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry?.contentRect.width;
      if (measured) setWidth(Math.round(measured));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasClientId) return;
    if (!scriptLoadedSuccessfully) return;
    if (!hiddenBtnRef.current) return;

    try {
      // initialize() registers the client + credential callback globally --
      // it has nothing to do with layout. It used to share an effect with
      // renderButton() below, whose deps include the ResizeObserver-measured
      // `width`, so every width change re-initialized the client (Google logs
      // "initialize() is called multiple times", and the prior instance's
      // callback is discarded). Kept width-free on purpose.
      window.google?.accounts?.id?.initialize({
        client_id: clientId,
        callback: async (credentialResponse) => {
          if (!credentialResponse?.credential) {
            notifyError(new Error("Google didn't return a credential."), {
              context: "Google auth",
            });
            return;
          }
          const claims = decodeJwtPayload(credentialResponse.credential);
          const next = claims?.email
            ? {
                email: claims.email,
                picture: claims.picture ?? null,
                name: claims.name ?? claims.given_name ?? null,
              }
            : null;
          try {
            const authData = await googleAuth({ clientToken: credentialResponse.credential });
            const user = await setSession(authData);
            // Cached only after the WHOLE sign-in succeeded (F6-3). Previously
            // this ran before googleAuth(), so a credential the backend
            // rejected still left {email, picture, name} on this machine for
            // the next person to see on this screen. The TTL above still
            // covers the never-logged-out case; clearSessionStorage() drops it
            // immediately the moment a session ends.
            if (next) {
              writeCachedIdentity(next);
              setIdentity(next);
              setAvatarFailed(false);
            }
            onAuthenticatedRef.current?.(user);
          } catch (err) {
            notifyError(err, { context: "Google auth" });
          }
        },
      });
      initializedRef.current = true;
    } catch (err) {
      initializedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error state must be set synchronously to prevent a render with a stale ref
      setInitFailed(true);
      notifyError(err, { context: "Google auth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally width-free: see the comment above
  }, [clientId, scriptLoadedSuccessfully, hasClientId]);

  // Separate effect, and the only one that depends on `width`: Google's SDK
  // replaces the container's contents in place, so a resize needs a fresh
  // renderButton() at the new measured width (same as the old <GoogleLogin/>
  // widget did). By then the client is already initialized by the effect
  // above, which runs first because it has no width dependency.
  useEffect(() => {
    if (!hasClientId) return;
    if (!scriptLoadedSuccessfully) return;
    if (!hiddenBtnRef.current) return;
    // Google only renders a working button for an initialized client; when
    // initialize() threw, there is nothing to render into.
    if (!initializedRef.current) return;

    try {
      window.google.accounts.id.renderButton(hiddenBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: String(width),
      });
    } catch (err) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error state must be set synchronously to prevent a render with a stale ref
      setInitFailed(true);
      notifyError(err, { context: "Google auth" });
    }
  }, [clientId, scriptLoadedSuccessfully, width, hasClientId]);

  if (gisError) {
    return (
      <div className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3.5 border-[1.5px] border-red-200 bg-red-50 text-sm text-red-700">
        <GoogleGlyph />
        <span className="truncate min-w-0">
          {gisError === "missing-client-id"
            ? "Google sign-in is temporarily unavailable. Please try again later."
            : "Google sign-in failed to load. Please try again later."}
        </span>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full group">
      {/* Visible button -- purely decorative, never receives the click itself. */}
      {identity ? (
        <div
          aria-hidden="true"
          className="w-full flex items-center gap-3 rounded-g-2 px-4 py-3 border border-black/10 bg-white/60 transition-colors duration-150 group-hover:bg-gray-50"
        >
          {identity.picture && !avatarFailed ? (
            <img
              src={identity.picture}
              alt=""
              className="w-5 h-5 rounded-full flex-shrink-0"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full flex-shrink-0 bg-brand-glow flex items-center justify-center text-[10px] font-semibold text-brand">
              {(identity.name ?? identity.email)[0].toUpperCase()}
            </div>
          )}
          <span className="flex flex-col min-w-0 flex-1 text-left">
            <span className="text-sm font-semibold text-gray-900 truncate">
              Continue as {identity.name ?? identity.email}
            </span>
            <span className="text-xs text-gray-500 truncate">{identity.email}</span>
          </span>
          <GoogleGlyph />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="w-full flex items-center justify-center gap-2.5 rounded-g-2 px-4 py-3.5 border border-black/10 bg-white/60 text-base font-medium text-black transition-colors duration-150 group-hover:bg-gray-50"
        >
          <GoogleGlyph />
          <span className="truncate min-w-0">{LABELS[label] ?? LABELS.continue_with}</span>
        </div>
      )}
      {/* Google's real button -- invisible, stacked exactly over the div
          above, so it's what actually receives the click/tap. */}
      <div ref={hiddenBtnRef} className="absolute inset-0 overflow-hidden opacity-0" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" className="flex-shrink-0">
      <path
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.5397-1.8368.8582-3.0477.8582-2.3436 0-4.3282-1.5827-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.9641 10.71c-.18-.5397-.2822-1.1159-.2822-1.71 0-.5941.1023-1.1705.2822-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.9641 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1623 6.6564 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}
