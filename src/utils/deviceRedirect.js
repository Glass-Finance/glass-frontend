// ─────────────────────────────────────────────────────────────────────────────
// Device detection for mobile-only member registration.
//
// Tablets are treated as desktop — the member experience is phone-first,
// not just "narrow viewport," so a tablet shouldn't slip through a pure
// width check. User-agent sniffing is the primary signal; viewport width is
// a fallback for the rare case the UA can't be read.
// ─────────────────────────────────────────────────────────────────────────────

function getDeviceType() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";

  if (ua) {
    const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua);
    if (isTablet) return "tablet";
    const isMobile = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua);
    if (isMobile) return "mobile";
  }

  // UA didn't confirm mobile — either it's missing, or it's a desktop UA
  // that a viewport-only device simulator left untouched (many don't spoof
  // the UA string, they just resize the viewport and switch to touch
  // emulation). A narrow AND touch-primary viewport is treated as mobile
  // too. Pointer type is the important part, not just width: a real
  // desktop user browsing with a mouse in a narrowed window still reports
  // a "fine" pointer, so this doesn't false-positive on them the way a
  // pure width check would.
  if (typeof window !== "undefined" && window.innerWidth < 768) {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
    if (!ua || coarsePointer) return "mobile";
  }
  return "desktop";
}

export function isMobileDevice() {
  return getDeviceType() === "mobile";
}

// Once MemberDeviceGuard has let someone through as mobile, remember that
// for the rest of this browser tab. Real phones never need this -- their
// UA is identical on every reload. It exists because device-emulation
// tools (Chrome DevTools' device toolbar) don't always reapply their UA
// override on a hard reload the same way they do on first load, which
// would otherwise bounce an already-in-progress mobile session to the QR
// handoff screen on every refresh.
const MOBILE_SESSION_KEY = "glass_mobile_verified";

export function isMobileSession() {
  if (isMobileDevice()) {
    try {
      sessionStorage.setItem(MOBILE_SESSION_KEY, "1");
    } catch {
      /* ignore — storage unavailable, fall through to the live check only */
    }
    return true;
  }
  // The cached flag alone isn't enough -- once set it never expires for the
  // rest of the tab, so an admin who tested with device emulation earlier
  // in this same tab would stay "verified mobile" forever after, even after
  // switching back to a genuine wide desktop window and navigating there
  // fresh (e.g. the "Member View" sidebar link). Requiring the viewport to
  // still be narrow keeps the flag doing its one real job -- surviving a
  // reload where the UA override didn't reapply but the viewport is still
  // small -- without also masking an unrelated later desktop visit.
  const stillNarrow = typeof window !== "undefined" && window.innerWidth < 768;
  if (!stillNarrow) return false;
  try {
    return sessionStorage.getItem(MOBILE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

// Public origin for the app. VITE_APP_URL pins this to the production
// domain in deployed builds; in local dev it falls back to whatever
// origin Vite is serving on (http://localhost:5173), so invite links
// copied during development actually resolve instead of going to a
// hardcoded domain that may not be live.
export const APP_ORIGIN = import.meta.env.VITE_APP_URL ?? window.location.origin;

// ── Marketing / app domain separation ────────────────────────────────────────
// glasspay.app + www serve the marketing site only; the application lives on
// APP_ORIGIN (app.glasspay.app in production). Everything below no-ops in
// local dev and on the app domain itself, where APP_ORIGIN resolves to the
// current origin — so single-domain deployments keep working unchanged
// until VITE_APP_URL points somewhere else.
const MARKETING_HOSTS = new Set(["glasspay.app", "www.glasspay.app"]);

function isAppOriginSeparate() {
  try {
    return new URL(APP_ORIGIN).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function isMarketingHost() {
  return MARKETING_HOSTS.has(window.location.hostname) && isAppOriginSeparate();
}

// Public marketing site (glasspay.app) — a separate repo/deployment
// (glass-waitlist-v1). Falls back to the real production domain rather than
// window.location.origin, since this app is never itself served from the
// marketing domain (unlike APP_ORIGIN's fallback, which covers same-origin
// local dev).
export const MARKETING_ORIGIN = import.meta.env.VITE_MARKETING_URL ?? "https://glasspay.app";

// True only on the real production app deployment — never in local dev or
// a preview build, so the landing pages stay directly viewable there for
// testing/porting to glass-waitlist-v1 (see that repo's README).
const APP_HOSTS = new Set(["app.glasspay.app"]);

export function isAppHost() {
  return APP_HOSTS.has(window.location.hostname);
}

// Navigate to an app path: a hard hop to APP_ORIGIN from the marketing
// domain, ordinary SPA navigation everywhere else.
export function goToApp(path, navigate) {
  if (isMarketingHost()) {
    window.location.href = `${APP_ORIGIN}${path}`;
    return;
  }
  navigate(path);
}

// Builds the absolute URL for a path (with its query string preserved,
// e.g. an invite token) so a phone can open it directly after scanning.
export function buildMobileUrl(path) {
  return `${APP_ORIGIN}${path}`;
}

// Where to send the "mobile-required" screen so it can render a QR back to
// wherever the user was actually trying to go.
export function mobileRequiredPath(targetPath) {
  return `/member/mobile-required?to=${encodeURIComponent(targetPath)}`;
}
