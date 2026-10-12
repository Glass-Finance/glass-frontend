/**
 * src/pwa/updatePolicy.js
 *
 * Decides WHEN a freshly activated service worker may force a page reload.
 *
 * Background: the worker calls skipWaiting()/clients.claim() on install and
 * activate, so an updated worker always takes over immediately. Taking over is
 * not the same as reloading. Reloading is what actually swaps the running
 * JavaScript, and doing it in the middle of a payment would throw away the
 * pending-payment context that PaymentCallback / PaymentSummary depend on
 * (`paymentPendingRef`, `paymentReturnTo`) -- see docs/payments.md.
 *
 * So: an activation while the user is on a payment route records a pending
 * reload and is honoured the moment they move somewhere safe. An activation
 * anywhere else reloads straight away.
 */

// Routes that carry live payment state. Kept in step with the route tree in
// src/App.jsx:
//   /payment/callback            Paystack return + verification
//   /member/pay/:paymentId      initiation (PaymentSummary)
//   /member/pay/:paymentId/success
const PAYMENT_ROUTE_PATTERNS = [/^\/payment\//, /^\/member\/pay(\/|$)/];

/** True for routes where a forced reload could interrupt a payment. */
export function isPaymentFlow(pathname) {
  if (typeof pathname !== "string") return false;
  return PAYMENT_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

let pending = false;
const listeners = new Set();

/** Subscribe to pending-state changes. Returns an unsubscribe function. */
export function subscribeReload(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isReloadPending() {
  return pending;
}

/**
 * Called when an updated worker activates. Reloads immediately when the user
 * is not in a payment flow; otherwise defers until they leave one.
 */
export function requestReload() {
  pending = true;
  for (const listener of listeners) listener(true);
  if (typeof window !== "undefined") reloadIfSafe(window.location.pathname);
  return pending;
}

/**
 * Perform a pending reload if the given route is safe to reload from.
 * Returns true when a reload was actually triggered.
 */
export function reloadIfSafe(pathname) {
  if (!pending || isPaymentFlow(pathname)) return false;
  pending = false;
  for (const listener of listeners) listener(false);
  if (typeof window !== "undefined") window.location.reload();
  return true;
}

/** Test seam: resets module state between cases. */
export function resetReloadState() {
  pending = false;
  listeners.clear();
}
