import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// Behavioural contract for the INSTALLED vite-plugin-pwa update client.
//
// Why this exists: src/pwa/registerServiceWorker.js relies on supplying
// `onNeedReload`, because the plugin's auto-update client calls its OWN
// `window.location.reload()` when -- and only when -- that callback is absent.
// If the plugin ever reloaded unconditionally, an update activating during a
// payment would reload the page mid-flow and strand the payer, and the whole
// deferral in src/pwa/updatePolicy.js would be silently bypassed.
//
// src/__tests__/pwa/workerConfig.test.js guards the *application* side of this
// by searching source text for substrings, which cannot prove what the plugin
// actually does. This suite executes the real installed module instead, so it
// fails if a dependency upgrade changes the branch that does the reloading.
//
// node_modules is read only. The module is not modified on disk: its build-time
// placeholders are substituted in memory and the result is evaluated with the
// Workbox import injected.
// ─────────────────────────────────────────────────────────────────────────────

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const REGISTER_CLIENT = join(
  root,
  "node_modules",
  "vite-plugin-pwa",
  "dist",
  "client",
  "build",
  "register.js",
);

/** Minimal stand-in for workbox-window's Workbox that records its listeners. */
function createFakeWorkbox() {
  const instances = [];
  class FakeWorkbox {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.listeners = new Map();
      this.registerCalls = [];
      instances.push(this);
    }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }
    register(params) {
      this.registerCalls.push(params);
      return Promise.resolve({ scope: this.options?.scope });
    }
    messageSkipWaiting() {}
    fire(type, event) {
      for (const handler of this.listeners.get(type) ?? []) handler(event);
    }
  }
  return { FakeWorkbox, instances };
}

/**
 * Load the plugin's client exactly as it ships, with the build-time
 * placeholders filled in the way the plugin fills them for `autoUpdate`.
 */
function loadAutoUpdateRegisterClient(FakeWorkbox) {
  let source = readFileSync(REGISTER_CLIENT, "utf8");

  // The plugin rewrites these placeholders when generating the virtual module.
  // In node_modules they are inert string literals, so without substitution
  // `auto` would be false and the auto-update branch would never be reached.
  source = source
    .replace(/"__SW_AUTO_UPDATE__"/, JSON.stringify("true"))
    .replace(/"__SW_SELF_DESTROYING__"/, JSON.stringify("false"))
    .replace(/__SW__/g, "/sw.js")
    .replace(/__SCOPE__/g, "/")
    .replace(/__TYPE__/g, "classic")
    // Inject Workbox rather than resolving workbox-window from this file.
    .replace(/import\(\s*"workbox-window"\s*\)/g, "__importWorkbox()")
    .replace(/export\s*\{\s*registerSW\s*\};?/, "return registerSW;");

  const factory = new Function("__importWorkbox", source);
  return factory(async () => ({ Workbox: FakeWorkbox }));
}

/** Let the plugin's async register() reach its `await import(...)` and attach listeners. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("installed vite-plugin-pwa update client", () => {
  let reload;
  let originalServiceWorker;

  beforeEach(() => {
    reload = vi.fn();
    // jsdom does not implement service workers; the client gates on
    // `"serviceWorker" in navigator`. Remember the original descriptor so the
    // property can be restored exactly rather than approximated.
    originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
      writable: true,
    });
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/member/pay/abc123",
    });
  });

  afterEach(() => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      delete navigator.serviceWorker;
    }
    vi.restoreAllMocks();
  });

  it("delegates the reload to onNeedReload instead of reloading the page itself", async () => {
    // The regression this pins: the plugin calling window.location.reload()
    // on activation would throw away the pending-payment context
    // (paymentPendingRef / paymentReturnTo) that PaymentCallback and
    // PaymentSummary depend on. See docs/payments.md.
    const { FakeWorkbox, instances } = createFakeWorkbox();
    const registerSW = loadAutoUpdateRegisterClient(FakeWorkbox);

    const onNeedReload = vi.fn();
    registerSW({ immediate: true, onNeedReload });

    await settle();
    expect(instances).toHaveLength(1);
    const [workbox] = instances;
    expect(workbox.url).toBe("/sw.js");
    expect(workbox.registerCalls).toEqual([{ immediate: true }]);

    workbox.fire("activated", { isUpdate: true, isExternal: false });

    expect(onNeedReload).toHaveBeenCalledTimes(1);
    // The load-bearing assertion.
    expect(reload).not.toHaveBeenCalled();
  });

  it("still calls onNeedReload for an externally installed worker", async () => {
    const { FakeWorkbox, instances } = createFakeWorkbox();
    const registerSW = loadAutoUpdateRegisterClient(FakeWorkbox);

    const onNeedReload = vi.fn();
    registerSW({ immediate: true, onNeedReload });

    await settle();
    instances[0].fire("activated", { isUpdate: false, isExternal: true });

    expect(onNeedReload).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("ignores a first install that is not an update", async () => {
    const { FakeWorkbox, instances } = createFakeWorkbox();
    const registerSW = loadAutoUpdateRegisterClient(FakeWorkbox);

    const onNeedReload = vi.fn();
    const onOfflineReady = vi.fn();
    registerSW({ immediate: true, onNeedReload, onOfflineReady });

    await settle();
    instances[0].fire("activated", { isUpdate: false, isExternal: false });

    expect(onNeedReload).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads directly when no onNeedReload is supplied (negative control)", async () => {
    // Proves the branch above is real and observable: without the callback the
    // plugin performs the reload itself. If this ever stops being true, the
    // delegating tests would be passing vacuously.
    const { FakeWorkbox, instances } = createFakeWorkbox();
    const registerSW = loadAutoUpdateRegisterClient(FakeWorkbox);

    registerSW({ immediate: true });

    await settle();
    instances[0].fire("activated", { isUpdate: true, isExternal: false });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not send a skip-waiting message in auto-update mode", async () => {
    // autoUpdate delegates activation to the worker calling skipWaiting()
    // itself (src/sw.js), so the returned updater must not also drive it.
    // If it started doing both, the lifecycle would be duplicated.
    const { FakeWorkbox, instances } = createFakeWorkbox();
    const registerSW = loadAutoUpdateRegisterClient(FakeWorkbox);

    const updateServiceWorker = registerSW({ immediate: true, onNeedReload: vi.fn() });
    await settle();

    const messageSkipWaiting = vi.spyOn(instances[0], "messageSkipWaiting");
    await updateServiceWorker();

    expect(messageSkipWaiting).not.toHaveBeenCalled();
  });
});
