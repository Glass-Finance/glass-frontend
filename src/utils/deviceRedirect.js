// ─────────────────────────────────────────────────────────────────────────────
// Device detection for surfaces that intentionally choose a device-specific
// destination or presentation.
//
// Tablets are treated as desktop. User-agent sniffing is the primary signal;
// viewport width is a fallback for the rare case the UA can't be read.
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
