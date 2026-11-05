// Where the mobile Settings back button returns to.
//
// Settings navigates internally (tabs, sub-pages, breadcrumbs all push
// history entries), so navigate(-1) would only step back through Settings'
// own pages. Instead DashboardLayout records the last dashboard page the
// user was on *outside* Settings, and the back button returns there.
//
// sessionStorage rather than a ref so a refresh inside Settings still knows
// where the user came from; per-tab, so two tabs don't overwrite each other.

const KEY = "glass_settings_return_path";
const SETTINGS_PREFIX = "/dashboard/settings";

// Deep link / fresh tab with nothing recorded: the communities overview,
// the dashboard's own landing page.
export const SETTINGS_RETURN_FALLBACK = "/dashboard/home";

export function isSettingsPath(pathname) {
  return pathname === SETTINGS_PREFIX || pathname.startsWith(`${SETTINGS_PREFIX}/`);
}

export function rememberSettingsReturnPath({ pathname, search = "" }) {
  if (isSettingsPath(pathname)) return;
  try {
    sessionStorage.setItem(KEY, `${pathname}${search}`);
  } catch {
    // Storage unavailable — the fallback still gets the user out of Settings.
  }
}

export function getSettingsReturnPath() {
  try {
    const stored = sessionStorage.getItem(KEY);
    // Only ever a same-app dashboard path we wrote ourselves; anything else
    // (tampered, stale from another shape) falls back rather than navigating
    // somewhere unexpected.
    if (stored && stored.startsWith("/dashboard") && !isSettingsPath(stored.split("?")[0])) {
      return stored;
    }
  } catch {
    /* fall through */
  }
  return SETTINGS_RETURN_FALLBACK;
}
