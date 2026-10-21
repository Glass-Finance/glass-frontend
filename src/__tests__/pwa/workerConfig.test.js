import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { readFileSync as readSrc } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const config = readSrc(join(root, "vite.config.js"), "utf8");
const sw = readSrc(join(root, "src", "sw.js"), "utf8");
const app = readSrc(join(root, "src", "App.jsx"), "utf8");

// These guard the two mistakes made while building this feature, both of
// which shipped-silently in the sense that the build passed and only the
// running worker revealed them. Keep them here so a future edit cannot
// reintroduce either without failing CI.

describe("PWA worker configuration", () => {
  it("uses injectManifest so the worker's behaviour is explicit code", () => {
    expect(config).toMatch(/strategies:\s*["']injectManifest["']/);
  });

  it("starts the installed app on its sign-in route, not the marketing redirect", () => {
    expect(config).toMatch(/start_url:\s*["']\/member\/app-sign-in["']/);
    expect(app).toMatch(/path=["']\/member\/app-sign-in["']/);
  });

  it("never configures navigateFallback to the offline page", () => {
    // `navigateFallback: '/offline.html'` makes Workbox's NavigationRoute
    // answer EVERY navigation from the precached offline page: the handler
    // replaces the request with `new Request('/offline.html')` and serves it
    // unconditionally, so the online app renders "You're offline".
    expect(config).not.toMatch(/navigateFallback:\s*["']\/?offline\.html["']/);
  });

  it("does not configure a runtime cache for the API", () => {
    expect(config).not.toMatch(/runtimeCaching/);
  });

  it("registers the shell as the navigation handler, not the offline page", () => {
    expect(sw).toMatch(/createHandlerBoundToURL\(["']\/index\.html["']\)/);
    expect(sw).not.toMatch(/createHandlerBoundToURL\(["']\/offline\.html["']\)/);
  });

  it("keeps the API on NetworkOnly, never a caching strategy", () => {
    expect(sw).toMatch(/new NetworkOnly\(\)/);
    // A caching strategy on an API route would put financial responses in a cache.
    const apiRoute = sw.match(/registerRoute\(([^)]*),\s*new (\w+)\(/);
    expect(apiRoute?.[2]).toBe("NetworkOnly");
  });

  it("matches the API route at the start of the full URL, not the path", () => {
    // Workbox's RegExpRoute only honours a cross-origin match when it begins
    // at index 0. A path-only pattern never fires against api.glasspay.app,
    // leaving the rule as dead code that only catches same-origin requests.
    const apiRoute = sw.match(/registerRoute\(\/(.*?)\/i,\s*new NetworkOnly\(\)/);
    expect(apiRoute?.[1]).toBeTruthy();
    // The literal in src/sw.js is written with escaped slashes; drop the
    // backslashes so the comparison is against the pattern the engine sees.
    const pattern = apiRoute[1].replace(/\\/g, "");
    expect(pattern.startsWith("^https?://")).toBe(true);
    expect(pattern).toContain("/api/v1/");
    // The path-only version that silently never matched the production host.
    expect(pattern.startsWith("^/api/")).toBe(false);
  });

  it("only precaches built assets, never anything under /api/", () => {
    const globs = config.match(/globPatterns:\s*\[([^\]]*)\]/);
    expect(globs?.[1]).toBeTruthy();
    expect(globs?.[1]).not.toMatch(/api/);
  });
});

describe("service-worker update strategy", () => {
  const read = (p) => readSrc(join(root, p), "utf8");

  it("authored its own skipWaiting/claim in the injectManifest worker", () => {
    // vite-plugin-pwa only injects workbox.skipWaiting / clientsClaim on the
    // generateSW path. With injectManifest, omitting these makes an updated
    // worker install and then WAIT for every tab to close.
    expect(sw).toMatch(/addEventListener\(\s*["']install["'][\s\S]*?skipWaiting\(\)/);
    expect(sw).toMatch(/addEventListener\(\s*["']activate["'][\s\S]*?clients\.claim\(\)/);
  });

  it("registers through the virtual module, not the inert injected script", () => {
    // The injected /registerSW.js is generateSimpleSWRegister -- a bare
    // navigator.serviceWorker.register() with no update handling -- which made
    // registerType:"autoUpdate" a no-op. Importing virtual:pwa-register
    // suppresses it and switches to the workbox-window auto-update client.
    const registration = read("src/pwa/registerServiceWorker.js");
    expect(registration).toMatch(/from\s*["']virtual:pwa-register["']/);
    expect(registration).toMatch(/registerSW\(/);

    const main = read("src/main.jsx");
    expect(main).toMatch(/import\s+["'][^"']*registerServiceWorker[^"']*["']/);
  });

  it("defers the forced reload instead of reloading inside a payment", () => {
    const registration = read("src/pwa/registerServiceWorker.js");
    // onNeedReload must not call window.location.reload() directly.
    expect(registration).not.toMatch(/location\.reload/);
    expect(registration).toMatch(/onNeedReload/);

    const app = read("src/App.jsx");
    expect(app).toMatch(/PwaUpdateReload/);
  });
});

describe("offline fallback page", () => {
  const html = readFileSync(join(root, "public", "offline.html"), "utf8");

  it("is static: no external scripts, styles or links", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it("cannot reach an authenticated screen", () => {
    expect(html).not.toContain("/dashboard");
    expect(html).not.toContain("/member/home");
    expect(html).not.toContain("/payment");
  });
});
