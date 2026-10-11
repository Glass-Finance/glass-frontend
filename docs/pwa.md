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

`src/sw.js` makes all four rules explicit. It is ~50 lines and audited by
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

No CSP change is required. Registration is an external script
(`<script src="/registerSW.js">`, matched by `script-src 'self'`) and the worker
is same-origin (`worker-src 'self'` was already allowlisted). Adding no inline
script means no `sha256-` entry in `vercel.json` changed.

## Verification

```bash
npm run build
node scripts/verify-pwa-sw.mjs      # drives real fetch events through dist/sw.js
```

The harness loads the built worker into a mocked ServiceWorkerGlobalScope
(in-memory `CacheStorage`, a fake `fetch` that serves `dist/` and can be toggled
offline, a minimal `indexedDB`) and asserts 17 behaviours: precache contents,
online and offline navigation, API network-only and never-cached, offline API
failure, the Cloudinary cache, the offline-page fallback, and that `/api/`
navigations are left for the network.

Device installation is **not** covered by it — see "Remaining manual tests".

## Update lifecycle

`registerType: "autoUpdate"` — a new deploy's worker installs in the background
and activates on the next navigation (`clientsClaim` + `skipWaiting`), and
`cleanupOutdatedCaches` drops superseded precache entries. Nothing interrupts an
in-flight request; the refresh path in `src/api/client.js` is unaffected because
API traffic never touches the worker's caches.

## Rollback

1. Revert the feature branch. The old `index.html` registers no worker, so
   browsers drop it on their next visit.
2. To force immediate removal, ship a one-line deploy that runs
   `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))`,
   then remove the line.

No data migration is needed — the worker stores build output only.
