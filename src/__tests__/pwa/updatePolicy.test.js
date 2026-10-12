import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPaymentFlow,
  isReloadPending,
  reloadIfSafe,
  requestReload,
  resetReloadState,
  subscribeReload,
} from "../../pwa/updatePolicy";

// A reload forced by a service-worker update must never land in the middle of
// a payment: PaymentCallback and PaymentSummary depend on pending-payment
// context held in sessionStorage (paymentPendingRef / paymentReturnTo), and a
// reload mid-flow strands the payer -- see docs/payments.md.
//
// These assert the decision, not the worker, so they stay valid regardless of
// how the update is delivered.

describe("isPaymentFlow", () => {
  it("matches the payment routes in src/App.jsx", () => {
    expect(isPaymentFlow("/payment/callback")).toBe(true);
    expect(isPaymentFlow("/member/pay/abc123")).toBe(true);
    expect(isPaymentFlow("/member/pay/abc123/success")).toBe(true);
  });

  it("does not match the payments LIST route (no payment is in flight there)", () => {
    expect(isPaymentFlow("/member/manage-payments")).toBe(false);
    expect(isPaymentFlow("/dashboard/payments")).toBe(false);
  });

  it("does not match ordinary routes", () => {
    expect(isPaymentFlow("/member/home")).toBe(false);
    expect(isPaymentFlow("/dashboard/home")).toBe(false);
    expect(isPaymentFlow("/")).toBe(false);
    expect(isPaymentFlow("/sign-in")).toBe(false);
  });

  it("tolerates a non-string pathname", () => {
    expect(isPaymentFlow(undefined)).toBe(false);
    expect(isPaymentFlow(null)).toBe(false);
  });
});

describe("update reload policy", () => {
  let reload;

  beforeEach(() => {
    resetReloadState();
    reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/member/home",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetReloadState();
  });

  it("does nothing until an update asks for a reload", () => {
    expect(reloadIfSafe("/member/home")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(isReloadPending()).toBe(false);
  });

  it("reloads immediately when the activation happens off a payment route", () => {
    requestReload();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isReloadPending()).toBe(false);
  });

  it("defers the reload when the activation happens mid-payment", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/member/pay/abc",
    });
    requestReload();
    expect(reload).not.toHaveBeenCalled();
    expect(isReloadPending()).toBe(true);
  });

  it("honours the deferred reload once the user leaves the payment route", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/payment/callback",
    });
    requestReload();
    expect(reload).not.toHaveBeenCalled();

    // PwaUpdateReload calls this as the route changes.
    expect(reloadIfSafe("/member/pay/abc")).toBe(false); // still on a payment route
    expect(reload).not.toHaveBeenCalled();

    expect(reloadIfSafe("/member/home")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isReloadPending()).toBe(false);
  });

  it("only reloads once for a single deferred activation", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/member/pay/abc",
    });
    requestReload();
    reloadIfSafe("/member/home");
    reloadIfSafe("/dashboard/home");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers when pending state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeReload(listener);
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
      pathname: "/member/pay/abc",
    });

    requestReload();
    expect(listener).toHaveBeenCalledWith(true);

    reloadIfSafe("/member/home");
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
    requestReload();
    // No further notifications after unsubscribing.
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
