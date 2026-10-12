import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { reloadIfSafe, subscribeReload } from "./updatePolicy";

/**
 * Honours a deferred service-worker reload as soon as the app leaves a payment
 * route.
 *
 * The worker takes over immediately (skipWaiting + clientsClaim), but the page
 * only reloads when it is safe to do so. If an update activated while the user
 * was mid-payment, `requestReload()` recorded it without reloading; this
 * component then watches the route and reloads on the first non-payment one.
 *
 * Renders nothing.
 */
export default function PwaUpdateReload() {
  const { pathname } = useLocation();

  useEffect(() => {
    reloadIfSafe(pathname);
  }, [pathname]);

  // An activation that happens while already on a safe route still needs to
  // be picked up even if the route has not changed since.
  useEffect(
    () =>
      subscribeReload(() => {
        reloadIfSafe(window.location.pathname);
      }),
    [],
  );

  return null;
}
