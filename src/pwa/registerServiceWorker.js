import { registerSW } from "virtual:pwa-register";
import { requestReload } from "./updatePolicy";

/**
 * Registers the service worker through vite-plugin-pwa's virtual module.
 *
 * Why the virtual module and not the injected `<script src="/registerSW.js">`:
 * the injected script is `generateSimpleSWRegister` -- a bare
 * `navigator.serviceWorker.register()` with no update handling at all, so
 * `registerType: "autoUpdate"` had no effect. Importing `virtual:pwa-register`
 * switches the plugin to its workbox-window client, which actually listens for
 * an updated worker and reports activation back through `onNeedReload`.
 *
 * `onNeedReload` deliberately does not reload here -- it hands off to
 * updatePolicy, which defers the reload while the user is mid-payment.
 */
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedReload: requestReload,
  });
}

export { requestReload };
