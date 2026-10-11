// scripts/verify-pwa-sw.mjs
//
// Executes the BUILT service worker (dist/sw.js) in a mocked
// ServiceWorkerGlobalScope and drives real fetch events through it, so the
// navigation / offline / API-caching behaviour is verified end to end against
// the artifact that actually ships, rather than against the config that
// produced it.
//
// Run after `npm run build`:  node scripts/verify-pwa-sw.mjs
//
// A desktop browser is not available in this environment, so this is the
// verification of record for worker behaviour. Device testing (real Android
// Chrome, iOS Safari "Add to Home Screen") is still required before claiming
// installation support -- see the report.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { setTimeout as delay } from "node:timers/promises";

// Workbox drops the `_awaitComplete` promise, so a late rejection inside it
// surfaces as an unhandled rejection that Node prints with the whole minified
// worker as context. Summarise instead.
process.on("unhandledRejection", (reason) => {
  console.error(`    [unhandled rejection] ${reason?.message ?? reason}`);
});

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(root, "dist");
const SW_PATH = join(DIST, "sw.js");
const ORIGIN = "http://localhost:4173";

if (!existsSync(SW_PATH)) {
  console.error(`FAIL: ${SW_PATH} not found -- run \`npm run build\` first.`);
  process.exit(1);
}

// ── Minimal in-memory IndexedDB ──────────────────────────────────────────────
// workbox-expiration stores per-cache timestamps in IDB (CacheStorage cannot
// answer "when was this stored"). A functional stand-in is ~50 lines and lets
// the expiry plugin run for real instead of being skipped.
class IDBRequest extends EventTarget {
  constructor() {
    super();
    this.result = undefined;
    this.error = null;
  }
  _succeed(result) {
    this.result = result;
    this.dispatchEvent(new Event("success"));
  }
  _fail(error) {
    this.error = error;
    this.dispatchEvent(new Event("error"));
  }
}

class IDBTransactionStub extends EventTarget {
  constructor(stores, mode) {
    super();
    this.objectStoreNames = Object.keys(stores);
    this.mode = mode;
    this._stores = stores;
    // `done` is served through an idb wrapper that resolves on 'complete'.
    queueMicrotask(() => this.dispatchEvent(new Event("complete")));
  }

  // The idb wrapper resolves `.store` via `receiver.objectStore(...)`, which is
  // how a real IDBTransaction exposes stores too.
  objectStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new IDBObjectStoreStub(name, "id"));
      this.objectStoreNames = Object.keys(this._stores);
    }
    return this._stores.get(name);
  }
}

class IDBObjectStoreStub {
  constructor(name, keyPath) {
    this.name = name;
    this.keyPath = keyPath;
    this.data = new Map();
    this.indexNames = [];
  }

  createIndex(indexName) {
    if (!this.indexNames.includes(indexName)) this.indexNames.push(indexName);
    return { name: indexName };
  }

  index(_indexName) {
    // Returning a cursor-less index means "nothing to expire", which is the
    // behaviour wanted for a bounded cache in a verification harness.
    return { openCursor: async () => null };
  }

  async put(value) {
    this.data.set(value[this.keyPath], structuredClone(value));
    return value;
  }

  async get(key) {
    return this.data.get(key);
  }

  async delete(key) {
    this.data.delete(key);
  }

  count() {
    return Promise.resolve(this.data.size);
  }
}

class IDBDatabaseStub {
  constructor() {
    this._stores = new Map();
    this.objectStoreNames = [];
  }

  createObjectStore(name, { keyPath } = {}) {
    const store = new IDBObjectStoreStub(name, keyPath);
    this._stores.set(name, store);
    this.objectStoreNames = [...this._stores.keys()];
    return store;
  }

  transaction(name, mode) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new IDBObjectStoreStub(name, "id"));
      this.objectStoreNames = [...this._stores.keys()];
    }
    return new IDBTransactionStub(this._stores, mode);
  }

  // The idb wrapper's proxy resolves `.objectStore(name)` on the database.
  objectStore(name) {
    if (!this._stores.has(name)) {
      this._stores.set(name, new IDBObjectStoreStub(name, "id"));
      this.objectStoreNames = [...this._stores.keys()];
    }
    return this._stores.get(name);
  }
}

const idbDatabases = new Map();

const indexedDBStub = {
  open(name, version, { upgrade } = {}) {
    const request = new IDBRequest();
    let db = idbDatabases.get(name);
    if (!db) {
      db = new IDBDatabaseStub();
      idbDatabases.set(name, db);
    }
    // Fire upgrade on a fresh database, as a real open would.
    queueMicrotask(() => {
      try {
        if (upgrade) upgrade(db, 0, version, null);
        request._succeed(db);
      } catch (err) {
        request._fail(err);
      }
    });
    return request;
  },

  deleteDatabase(name) {
    const request = new IDBRequest();
    queueMicrotask(() => {
      idbDatabases.delete(name);
      request._succeed(undefined);
    });
    return request;
  },
};

// ── Results bookkeeping ─────────────────────────────────────────────────────
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? ` -- ${detail}` : ""}`);
}

// ── In-memory CacheStorage (keys on the fully-resolved URL) ──────────────────
class FakeCache {
  constructor(name) {
    this.name = name;
    this.store = new Map();
  }

  async put(request, response) {
    const body = await response.clone().text();
    this.store.set(resolve(request).href, body);
    return undefined;
  }
  async match(request) {
    const href = resolve(request).href;
    if (!this.store.has(href)) return undefined;
    return new WorkerResponse(this.store.get(href), { status: 200 });
  }

  async keys() {
    return [...this.store.keys()].map((u) => new Request(u));
  }

  async delete(request) {
    return this.store.delete(resolve(request).href);
  }
}

const cachesStore = new Map();
const caches = {
  async open(name) {
    if (!cachesStore.has(name)) cachesStore.set(name, new FakeCache(name));
    return cachesStore.get(name);
  },
  async match(request, { cacheName } = {}) {
    if (cacheName) return (await caches.open(cacheName)).match(request);
    for (const cache of cachesStore.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  },
  async keys() {
    return [...cachesStore.keys()];
  },
  async delete(name) {
    return cachesStore.delete(name);
  },
};

function resolve(requestOrString) {
  const value = typeof requestOrString === "string" ? requestOrString : requestOrString.url;
  return new URL(value, ORIGIN + "/");
}

// What "the network" serves, and whether it is up.
let offline = false;
const networkHits = [];

// Workbox builds relative Requests (`new Request("/index.html")`) inside the
// worker; Node's undici Request refuses relative URLs. Wrap it so they
// resolve against the mock origin, as a browser would.
class WorkerRequest extends Request {
  constructor(input, init) {
    super(typeof input === "string" ? new URL(input, ORIGIN + "/").href : input, init);
  }
}

const WorkerResponse = Response;

const fetchMock = async (request) => {
  const url = resolve(request);
  networkHits.push(url.href);
  if (offline) throw new TypeError("Failed to fetch");
  const path = url.pathname === "/" ? "/index.html" : url.pathname;

  // Serve the real build artefact when one exists on disk, so the precache is
  // populated with the actual content the worker will later serve. Anything
  // not on disk (third-party CDNs, unknown paths) falls back to a stub.
  const onDisk = join(DIST, path.replace(/^\/+/, ""));
  if (existsSync(onDisk) && statSync(onDisk).isFile()) {
    const ext = extname(onDisk);
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".svg": "image/svg+xml",
      ".json": "application/manifest+json",
      ".webmanifest": "application/manifest+json",
    };
    return new WorkerResponse(readFileSync(onDisk), {
      status: 200,
      headers: { "Content-Type": types[ext] ?? "application/octet-stream" },
    });
  }

  if (path.startsWith("/assets/"))
    return new WorkerResponse(`/* chunk ${path} */`, { status: 200 });
  if (path.startsWith("/api/v1/")) {
    return new WorkerResponse(JSON.stringify({ data: "SENSITIVE_FINANCIAL_PAYLOAD" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new WorkerResponse("ok", { status: 200 });
};

// "You're offline" in public/offline.html — apostrophe kept optional so a
// typographic variant still matches.
const OFFLINE_MARKER = /you'?re offline/i;
function isOfflinePage(body) {
  return OFFLINE_MARKER.test(body);
}

// ── The mocked worker global scope ───────────────────────────────────────────
const listeners = new Map();

function makeEvent(type, request) {
  // Must come from the worker context so `instanceof FetchEvent` is true there.
  const event = new sandbox.FetchEvent(type, { request });
  event.waitUntil = (p) => {
    event._pending.push(Promise.resolve(p));
  };
  // FetchEvent.fetch(): the worker's own network path, kept separate from the
  // page's fetch so the harness can toggle offline per request.
  event.fetch = (req) => fetchMock(req);
  event.respondWith = (p) => {
    event._responded = Promise.resolve(p);
  };
  event._pending = [];
  event._responded = null;
  return event;
}

// Node's undici Request refuses mode:"navigate" / "no-cors" combinations, but
// the worker legitimately inspects request.mode. Build the request then
// override the read-only getter.
function navRequest(url) {
  const req = new Request(url);
  Object.defineProperty(req, "mode", { value: "navigate", configurable: true });
  return req;
}

function corsRequest(url) {
  const req = new Request(url);
  Object.defineProperty(req, "mode", { value: "cors", configurable: true });
  return req;
}

function noCorsRequest(url) {
  const req = new Request(url);
  Object.defineProperty(req, "mode", { value: "no-cors", configurable: true });
  return req;
}

const sandbox = {
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  },
  removeEventListener() {},
  caches,
  fetch: fetchMock,
  location: new URL(ORIGIN + "/"),
  registration: { scope: ORIGIN + "/", active: null, installing: null, waiting: null },
  skipWaiting: () => Promise.resolve(),
  clients: {
    claim: () => Promise.resolve(),
    matchAll: async () => [],
    openWindow: async () => null,
  },
  console,
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  Request,
  Response,
  Headers,
};
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
// The generated bundle reads a bare `registration` global too. Workbox does
// `e instanceof FetchEvent`, which requires the identifier to resolve inside
// the worker context -- the event only needs the members it reads.
sandbox.Event = class {
  constructor(type, init = {}) {
    this.type = type;
    this.request = init.request;
  }
};
sandbox.FetchEvent = class extends sandbox.Event {};
// Relative-URL-aware Request (Workbox does `new Request("/index.html")`).
sandbox.Request = WorkerRequest;
sandbox.Response = Response;
// workbox-expiration's idb helper checks these via instanceof.
sandbox.EventTarget = EventTarget;
sandbox.indexedDB = indexedDBStub;
// The stubs must BE the classes instanceof is tested against, so the vm
// context resolves the same objects the harness built.
sandbox.IDBRequest = IDBRequest;
sandbox.IDBDatabase = IDBDatabaseStub;
sandbox.IDBObjectStore = IDBObjectStoreStub;
sandbox.IDBIndex = class IDBIndex {};
sandbox.IDBCursor = class IDBCursor {};
sandbox.IDBTransaction = IDBTransactionStub;
sandbox.IDBCursor.prototype.advance = function advance() {};
sandbox.IDBCursor.prototype.continue = function continue_() {};
sandbox.IDBCursor.prototype.continuePrimaryKey = function continuePrimaryKey() {};
vm.createContext(sandbox);

async function dispatch(type, event) {
  const handlers = listeners.get(type) ?? [];
  for (const handler of handlers) {
    // A handler may call event.respondWith synchronously or in a promise it
    // passes to waitUntil; give both a chance to settle.
    const outcome = handler(event);
    if (outcome && typeof outcome.catch === "function") {
      outcome.catch((err) => {
        if (process.env.SW_TRACE) console.error("    [handler error]", err);
      });
    }
  }
  await Promise.allSettled(event._pending);
  if (!event._responded) return { responded: false, response: undefined };
  let response;
  try {
    response = await event._responded;
  } catch (err) {
    if (process.env.SW_TRACE) console.error("    [respondWith rejected]", err?.message ?? err);
    response = undefined;
  }
  return { responded: true, response };
}

// ── Boot the worker ─────────────────────────────────────────────────────────
console.log("\nLoading dist/sw.js into a mocked ServiceWorkerGlobalScope...\n");
try {
  vm.runInContext(readFileSync(SW_PATH, "utf8"), sandbox, { filename: "sw.js" });
} catch (err) {
  console.error("FAIL: worker threw while evaluating:", err.message);
  process.exit(1);
}
console.log(`  registered listeners: ${[...listeners.keys()].join(", ")}\n`);

// ── 1. Install / precache ───────────────────────────────────────────────────
console.log("1. Install and precache");
{
  const event = makeEvent("install", undefined);
  await dispatch("install", event);
  await delay(50);
  const names = caches.keys();
  const precache = await caches
    .open("workbox-precaching-v2-http://localhost:4173/")
    .catch(() => null);
  const anyCache = cachesStore.size > 0;
  const entries = [];
  for (const c of cachesStore.values()) entries.push(...c.store.keys());
  record(
    "worker installs and populates a precache",
    anyCache && entries.length > 100,
    `${entries.length} entries across ${[...cachesStore.keys()].length} cache(s)`,
  );
  record(
    "index.html is precached (the app shell)",
    entries.some((u) => /\/index\.html/.test(u)),
  );
  record(
    "offline.html is precached",
    entries.some((u) => /\/offline\.html/.test(u)),
  );
  // Nothing user-derived should ever be precached: the precache is emitted at
  // build time, so assert no API URL made it in.
  record("no /api/ URL is precached", !entries.some((u) => /\/api\/v1\//.test(u)));
}

// ── 2. Online navigation renders the shell ───────────────────────────────────
console.log("\n2. Online navigation");
{
  offline = false;
  networkHits.length = 0;
  const { responded, response } = await dispatch(
    "fetch",
    makeEvent("fetch", navRequest(ORIGIN + "/dashboard/home")),
  );
  const body = responded && response ? await response.text() : "";
  record(
    "navigation to an authenticated SPA route is answered with the app shell",
    responded && body.includes('id="root"'),
    responded ? `HTTP body contains #root: ${body.includes('id="root"')}` : "no response",
  );
  record(
    "the offline page is NOT shown on a normal online navigation",
    responded && !isOfflinePage(body),
  );
}

// ── 3. Offline navigation still renders the shell ────────────────────────────
console.log("\n3. Offline navigation");
{
  offline = true;
  networkHits.length = 0;
  const { responded, response } = await dispatch(
    "fetch",
    makeEvent("fetch", navRequest(ORIGIN + "/member/home")),
  );
  const body = responded && response ? await response.text() : "";
  record(
    "offline navigation is served the precached shell (SPA routing preserved)",
    responded && body.includes('id="root"'),
  );
}

// ── 4. API requests are network-only and never cached ───────────────────────
console.log("\n4. API requests");
{
  offline = false;
  networkHits.length = 0;
  const { responded, response } = await dispatch(
    "fetch",
    makeEvent("fetch", corsRequest("https://api.glasspay.app/api/v1/transactions")),
  );
  const body = responded && response ? await response.text() : "";
  record(
    "a GET /api/v1/ request reaches the network",
    networkHits.some((u) => u.includes("/api/v1/")),
  );
  record("the API response is returned to the page", body.includes("SENSITIVE_FINANCIAL_PAYLOAD"));

  const allKeys = [];
  for (const c of cachesStore.values()) allKeys.push(...c.store.keys());
  record(
    "no API response is written to any cache (no runtime caching of financial data)",
    !allKeys.some((u) => /\/api\/v1\//.test(u)),
    `checked ${allKeys.length} cache keys`,
  );

  // Second request: still served from the network, not a cache hit.
  networkHits.length = 0;
  await dispatch(
    "fetch",
    makeEvent("fetch", corsRequest("https://api.glasspay.app/api/v1/transactions")),
  );
  record(
    "a repeated API request hits the network again (never a cache hit)",
    networkHits.some((u) => u.includes("/api/v1/")),
  );
}

// ── 5. Offline API request fails loudly (no offline success) ─────────────────
console.log("\n5. Offline API request");
{
  offline = true;
  networkHits.length = 0;
  const { responded, response } = await dispatch(
    "fetch",
    makeEvent("fetch", corsRequest("https://api.glasspay.app/api/v1/payments")),
  );
  let text = "";
  try {
    text = response ? await response.text() : "";
  } catch {
    /* a rejected promise is the expected outcome */
  }
  record(
    "an offline API request never returns a success/body",
    !text.includes("SENSITIVE_FINANCIAL_PAYLOAD"),
  );
}

// ── 6. Cloudinary images are cached (the only runtime cache) ────────────────
console.log("\n6. Public CDN images");
{
  offline = false;
  const url = "https://res.cloudinary.com/ece5jmhy/image/upload/glass/Glass.webp";
  await dispatch("fetch", makeEvent("fetch", noCorsRequest(url)));
  const cloudCache = cachesStore.get("cloudinary-images");
  record(
    "a Cloudinary image is cached for offline use",
    cloudCache && cloudCache.store.size > 0,
    cloudCache
      ? `${cloudCache.store.size} entr${cloudCache.store.size === 1 ? "y" : "ies"}`
      : "no cache",
  );
  offline = true;
  const second = await dispatch("fetch", makeEvent("fetch", noCorsRequest(url)));
  record(
    "an offline Cloudinary image is served from cache",
    second.responded && second.response !== undefined,
  );
}

// ── 7. The offline page is the last resort only ─────────────────────────────
console.log("\n7. Dedicated offline page as last resort");
{
  // Simulate a shell that cannot be served: drop ONLY index.html from the
  // precache (offline.html stays, as it would in a real eviction) and go
  // offline. The navigation route then cannot answer, and the catch handler
  // must be the thing that responds.
  const precacheName = [...cachesStore.keys()].find((n) => n.includes("precache"));
  const precache = await caches.open(precacheName);
  const shellKey = [...precache.store.keys()].find((u) => /\/index\.html/.test(u));
  precache.store.delete(shellKey);
  offline = true;
  networkHits.length = 0;
  const { responded, response } = await dispatch(
    "fetch",
    makeEvent("fetch", navRequest(ORIGIN + "/dashboard/home")),
  );
  const body = responded && response ? await response.text().catch(() => "") : "";
  record(
    "when the shell cannot be served, the offline page is shown",
    responded && isOfflinePage(body),
    responded
      ? isOfflinePage(body)
        ? "offline page returned"
        : "responded with something else"
      : "no response (catch handler did not run)",
  );
  record(
    "the offline page contains no authenticated content",
    !/dashboard|payment|transaction/i.test(body.replace(/description/i, "")),
  );
}

// ── 8. API navigations are not swallowed by the navigation route ─────────────
console.log("\n8. API navigation exclusion");
{
  offline = false;
  for (const name of [...cachesStore.keys()]) await caches.delete(name);
  await dispatch("install", makeEvent("install", undefined));
  await delay(50);
  networkHits.length = 0;
  await dispatch("fetch", makeEvent("fetch", navRequest(ORIGIN + "/api/v1/csp-report")));
  record(
    "a navigation to /api/v1/ is left for the network (not answered by the shell)",
    networkHits.some((u) => u.includes("/api/v1/csp-report")),
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail ?? ""}`);
  process.exit(1);
}
console.log("All service-worker behaviour checks passed.\n");
