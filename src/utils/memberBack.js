// src/utils/memberBack.js
//
// Back navigation that never leaves the app.
//
// The member app is entered with `replace: true` for post-auth destinations
// and interrupted-payment resumes. The router's history depth is therefore
// often exactly one entry, so `navigate(-1)` pops the document and hands the
// browser back to whatever preceded the app: the marketing landing page, an
// OAuth provider, or nothing at all.
//
// React-router v7 does not bump history.state.idx on `replace` and seeds
// idx: 0 per document load, so `idx > 0` reliably means "an in-app push
// exists" and `navigate(-1)` is safe. At idx 0 we fall back to an explicit
// in-app parent instead.

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DEFAULT_PARENT = "/member/home";

function currentIdx() {
  const idx = window.history.state?.idx;
  return typeof idx === "number" ? idx : 0;
}

/**
 * Go back to the previous in-app route, or to `parents[0]` when there is no
 * in-app entry behind the current one (cold entry via deep link, QR handoff,
 * post-auth replace, or a refresh).
 *
 * @param {(to: string | number, opts?: object) => void} navigate react-router navigate
 * @param {string | string[]} parents in-app fallback target(s); first wins
 */
export function goBackInApp(navigate, parents = [DEFAULT_PARENT]) {
  const list = Array.isArray(parents) ? parents : [parents];
  if (currentIdx() > 0) {
    navigate(-1);
    return;
  }
  navigate(list[0], { replace: true });
}

const SENTINEL_FLAG = "__glassBackSentinel";

/**
 * Traps the browser/hardware back button so it cannot leave the app from a
 * cold-entry page. Call once in the member app layout.
 *
 * On a cold entry (router idx 0) the entry below the current one is a
 * cross-document page (marketing site, OAuth provider), so a back press would
 * leave the app. We push a sentinel entry directly on top of the cold entry
 * with the same URL; the first back press pops to the cold entry and is
 * redirected in-app, and the sentinel is re-armed so the next back is trapped
 * too. In-app pushes overwrite the sentinel and disarm the trap, so normal
 * navigation is untouched.
 */
export function useTrapBackInApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const sentinelOnTop = useRef(false);
  // Empty string rather than null so the ref's inferred type is string;
  // "no sentinel armed" is represented by sentinelOnTop, not by this.
  const sentinelUrl = useRef("");

  // Disarm when the user navigates to a different page — the sentinel entry is
  // overwritten by the real one, so it can no longer be the pop source.
  useEffect(() => {
    if (sentinelOnTop.current && location.pathname !== sentinelUrl.current) {
      sentinelOnTop.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (currentIdx() > 0) return; // in-app depth exists; browser back is safe

    sentinelOnTop.current = true;
    sentinelUrl.current = location.pathname;
    window.history.pushState({ [SENTINEL_FLAG]: true }, "");

    function onPopState() {
      if (currentIdx() > 0) return; // in-app navigation, not a back-out
      if (sentinelOnTop.current) {
        // Popped from the sentinel → the user pressed back on a cold-entry
        // page. Redirect in-app and re-arm.
        sentinelOnTop.current = false;
        window.history.pushState({ [SENTINEL_FLAG]: true }, "");
        sentinelOnTop.current = true;
        sentinelUrl.current = DEFAULT_PARENT;
        navigate(DEFAULT_PARENT, { replace: true });
      } else {
        // Navigated back from a real in-app entry to the cold entry. Re-arm so
        // the next back is trapped.
        window.history.pushState({ [SENTINEL_FLAG]: true }, "");
        sentinelOnTop.current = true;
        sentinelUrl.current = location.pathname;
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate, location.pathname]);
}
