# Glasspay PWA

Installable app-shell experience for `glass-waitlist`, built on
`vite-plugin-pwa` in **`injectManifest`** mode with a hand-written worker in
`src/sw.js`.

This document is the source of truth for worker behaviour. `src/sw.js` and
`scripts/verify-pwa-sw.mjs` reference it; read it before changing either.

## Why `injectManifest`, not `generateSW`

`generateSW` infers caching behaviour from a config object. Two of those
inferences were wrong for this app and would have shipped silently:

- **`navigateFallback: "/offline.html"` serves the offline page for every
  navigation.** Workbox builds a `NavigationRoute` whose handler is
  `createHandlerBoundToURL("/offline.html")`; that handler _replaces_ the
  request with `new Request("/offline.html")` and answers it from the precache
  unconditionally. There is no network-first step. The online app renders "You're
  offline".
- **A path-only regex never matches the real API host.** `RegExpRoute` only
  honours a cross-origin match when the regex matches at index 0.
  `/\/api\/v1\//i` matches at offset 24 of
  `https://api.glasspay.app/api/v1/...`, so the rule is dead code in production
  and only ever applied to same-origin requests.

`src/sw.js` makes all four rules explicit. It is 131 lines and audited by
`scripts/verify-pwa-sw.mjs`.

## The four rules

1. **Navigations get the app shell.**
   `createHandlerBoundToURL("/index.html")` answers a navigation from the
   precache. On a precache miss it falls back to the network _for the shell
   itself_, so a warm cache is instant and a cold one still gets fresh HTML.
   `/api/` is excluded: those are requests, not navigations, and the worker must
   not swallow their failure.

2. **Nothing under the API is ever cached.**
   `registerRoute(/^https?:\/\/[^/]+\/api\/v1\//i, new NetworkOnly(), "GET")`.
   Anchored on the full URL so it works whatever `VITE_API_BASE_URL` is set to
   (see `src/api/client.js`). `NetworkOnly` never caches, so a failed call
   rejects and the caller's existing error handling runs — never a "payment
   succeeded" for a transfer that did not leave the device.

3. **One runtime cache exists: public Cloudinary images.**
   `CacheFirst` with a 100-entry / 30-day expiry. Everything else the worker
   does not answer passes through to the network untouched, so no rule can
   accidentally capture a sensitive request.

4. **The offline page is the last resort only.**
   `setCatchHandler` serves `offline.html` — reached only when the shell is
   missing from the precache _and_ the network could not supply it. It is a
   static page: no routes, no user data, no way to reach an authenticated
   screen through it.

## What is precached

Build output only (`globPatterns: ["**/*.{js,css,html,ico,png,webp,svg}"]`):
`index.html`, the entry JS/CSS, the lazy route chunks, icons and illustrations.
**Fonts are deliberately excluded** — they add ~1 MB to a first load and the only
offline consequence is the shell falling back to system fonts.

Nothing user-derived is ever precached: the precache is emitted at build time.

## Auth interaction

Guards (`ProtectedRoute`, `MemberProtectedRoute`) run in the browser after the
shell loads and redirect to sign-in unless the session is verified against the
backend. Because API requests are network-only, an offline deep link renders the
shell and then fails closed to sign-in — it never renders another user's data.

## CSP

No CSP change is required. Registration is an external script matched by
`script-src 'self'`, and the worker is same-origin (`worker-src 'self'` was
already allowlisted). Adding no inline script means no `sha256-` entry in
`vercel.json` changed.

## Icons

| Icon                                          | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `favicon-192x192.png` / `favicon-512x512.png` | standard (`purpose` omitted)             |
| `maskable-icon-512.png`                       | Android adaptive (`purpose: "maskable"`) |
| `apple-touch-icon.png`                        | iOS home screen                          |

The maskable icon is **generated, not hand-made**:

```bash
node scripts/generate-maskable-icon.mjs
```

It scales the brand icon so the whole logo sits inside Android's safe zone — a
**circle of 80% diameter**, not 80% of the canvas _width_. Getting that wrong is
easy and invisible: the first version scaled to 80% of the width, which left the
logo's corners 73px outside the circle, so the launcher clipped it.
`src/__tests__/pwa/maskableIcon.test.js` measures the real geometry (furthest
subject pixel from centre, bounding-box corners, aspect ratio, opacity) so that
cannot pass again.

## Verification

```bash
npm run build
npm run verify:pwa            # drives real fetch events through dist/sw.js
npx vitest run src/__tests__/pwa/
```

`scripts/verify-pwa-sw.mjs` loads the built worker into a mocked
ServiceWorkerGlobalScope (in-memory `CacheStorage`, a fake `fetch` that serves
`dist/` and can be toggled offline, a minimal `indexedDB`) and asserts 19
behaviours: precache contents, online and offline navigation, API network-only
and never-cached, offline API failure, the Cloudinary cache, the offline-page
fallback, that `/api/` navigations are left for the network, and the update
lifecycle.

Device installation is **not** covered by it — see "Remaining manual tests".

## Install entry point

Installation is offered from the member app's **Settings → App** section rather
than shown as an automatic overlay. Chromium browsers expose their native
install prompt only after the user taps that entry. iOS Safari (including
iPadOS using its desktop-style user agent) opens the Share → Add to Home Screen
steps only after the same explicit action. The entry is hidden once the app is
installed or when the current browser does not expose a supported install path.
This keeps sign-in, onboarding and payment flows free from unsolicited install
dialogs.

The manifest launches at `/member/app-sign-in`, not `/`: on the production app
host, `/` redirects to the separate marketing site. The sign-in route sends an
already-authenticated user to the correct app destination.

## Update lifecycle

An update propagates in three steps, and **all three are load-bearing**:

1. **The worker activates immediately.** `src/sw.js` calls `self.skipWaiting()`
   on `install` and `self.clients.claim()` on `activate`. This is hand-authored
   on purpose: `injectManifest` does **not** get Workbox's
   `skipWaiting`/`clientsClaim` automatically — vite-plugin-pwa only sets
   `workbox.skipWaiting` / `workbox.clientsClaim` on the **generateSW** path.
   Without them the new worker installs and then _waits_, so it only activates
   once every open tab for the scope closes, leaving a stale build on any
   long-lived tab.
2. **The page is told.** Registration goes through
   `src/pwa/registerServiceWorker.js`, which imports `virtual:pwa-register` and
   hands the workbox-window client `onNeedReload`. The _injected_
   `<script src="/registerSW.js">` is `generateSimpleSWRegister` — a bare
   `navigator.serviceWorker.register()` with no update handling at all, which is
   why `registerType: "autoUpdate"` had no effect before. Importing the virtual
   module suppresses that script and switches the plugin to its auto-update
   client.
3. **The page reloads only when safe.** `onNeedReload` does **not** reload; it
   calls `requestReload()` in `src/pwa/updatePolicy.js`. That reloads immediately
   off a payment route and otherwise _defers_ until the user leaves
   `/payment/callback` or `/member/pay/:id` — reloading mid-payment would strand
   the payer by discarding `paymentPendingRef` / `paymentReturnTo` (see
   `docs/payments.md`). `<PwaUpdateReload />` watches the route and fires the
   deferred reload on the first safe one.

`cleanupOutdatedCaches` drops superseded precache entries on activate. API
traffic is unaffected by any of this: it is network-only and never enters a
cache, so the refresh path in `src/api/client.js` behaves identically with or
without a worker.

Taking control never _disrupts_ an in-flight request: the worker's routes are
navigation-, API- and CDN-scoped, and a claim only affects subsequent fetches.

## Rollback

1. Revert the feature branch. Registration lives in `src/pwa/registerServiceWorker.js`,
   which the plugin only injects into a build that imports `virtual:pwa-register`,
   so a reverted build registers nothing and browsers drop the worker on their
   next visit.
2. To force immediate removal on devices that already have it, ship a one-line
   deploy that runs:
   ```js
   navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
   ```
   then remove the line. Unregistering stops the worker controlling the page but
   does **not** delete what it cached, so follow it with
   `caches.keys().then(ks => ks.forEach(k => caches.delete(k)))` if the storage
   itself must go.

No data migration is needed — the worker stores build output only, plus the
install-dismissal flags in `localStorage`.
