/// <reference lib="webworker" />

/**
 * src/sw.js — Glasspay service worker (compiled by vite-plugin-pwa in
 * `injectManifest` mode, which replaces `self.__WB_MANIFEST` with the real
 * precache list and bundles Workbox alongside it).
 *
 * Read docs/pwa.md before changing anything here. The three rules that must
 * not regress:
 *
 *   1. Navigations are served the precached app shell (index.html). The shell
 *      is static HTML with no user data in it — every data view requires the
 *      API, which is network-only below, so an offline deep link renders the
 *      shell and then fails closed through the existing auth guards.
 *
 *   2. Nothing under the API is ever cached: NetworkOnly never synthesises a
 *      response, so a failed request surfaces as an error the app already
 *      knows how to render. No offline payment is ever queued or replayed, and
 *      no offline state ever reads as a completed transfer.
 *
 *   3. Exactly one runtime cache exists (public Cloudinary images). Everything
 *      else the worker does not answer passes through to the network
 *      untouched, so no rule can accidentally capture a sensitive request.
 */

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Navigations: serve the app shell ────────────────────────────────────────
// createHandlerBoundToURL("/index.html") answers a navigation from the
// precache. On a precache miss it falls back to the network for the shell
// itself (Workbox's PrecacheStrategy), so a warm cache is served instantly and
// a cold one still gets fresh HTML. /api/v1/ is excluded: those are requests,
// not navigations, and the worker must not swallow their failure.
//
// auth/ and payment/ paths are NOT excluded on purpose — the shell renders for
// them too, and the real gate is the server refusing the data. Serving HTML is
// not the same as granting access.
const appShellHandler = createHandlerBoundToURL("/index.html");

registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [/^\/api\/v1\//, /^\/api\//],
  }),
);

// ── API: network only, never cached ────────────────────────────────────────
// Matched on the versioned path prefix rather than a hostname: the base URL is
// `VITE_API_BASE_URL` (see src/api/client.js), so the same code runs against
// whatever origin is configured. Financial, auth, session, transaction and
// account responses all live under this prefix.
//
// The regex is anchored at the start of the FULL url (^https?://<host>/api/v1/),
// not the path. Workbox's RegExpRoute only honours a cross-origin match when it
// begins at index 0, so a path-only pattern would silently never fire against
// api.glasspay.app and the rule below would be dead code that only applied to
// same-origin requests.
//
// NetworkOnly never caches. A failed call rejects, so the caller's existing
// error handling runs and the user is told the network is unavailable -- never
// that a payment or transfer succeeded.
registerRoute(/^https?:\/\/[^/]+\/api\/v1\//i, new NetworkOnly(), "GET");

// ── Public CDN images ───────────────────────────────────────────────────────
// The only runtime cache in this worker. Cloudinary hosts public marketing
// and avatar imagery referenced from the app; `CacheFirst` keeps them
// available offline and caps the footprint with expiry.
registerRoute(
  /^https:\/\/res\.cloudinary\.com\//i,
  new CacheFirst({
    cacheName: "cloudinary-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
  "GET",
);

// ── Last resort: the dedicated offline page ─────────────────────────────────
// Reached only when a navigation cannot be served at all -- the shell is
// missing from the precache AND the network could not supply it. This is the
// only path that renders offline.html, and it is a static page: no routes, no
// user data, no way to reach an authenticated screen by opening it.
//
// matchPrecache (not caches.match) is required here: precache entries are
// stored under a revision-suffixed cache key, so a plain caches.match would
// look for the un-suffixed URL and miss.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cached = await matchPrecache("/offline.html");
    if (cached) return cached;
  }
  return Response.error();
});
