import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePendingPaymentVerification } from "../../../hooks/payments/usePendingPaymentVerification";

// The real hook body is exercised here. Home.test.jsx mocks this module out
// entirely, so none of this logic has ever run in a test before.
//
// Network boundary mocked: verifyPayment. settleLocalPaymentForReference is
// NOT mocked — the storage side effects it produces are part of the contract
// under test (the paid log and the fee cache are what a payer sees on their
// receipt afterwards).
vi.mock("../../../api/members", () => ({ verifyPayment: vi.fn() }));
vi.mock("../../../utils/toast", () => ({ toastSuccess: vi.fn() }));

import { verifyPayment } from "../../../api/members";
import { toastSuccess } from "../../../utils/toast";

const PENDING_REF_KEY = "paymentPendingRef";
const PAID_LOG_KEY = "glass_local_paid_log";

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    Wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

const verifying = (status) => ({ data: { data: { status } } });

describe("usePendingPaymentVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does nothing when no reference is stored", async () => {
    const { Wrapper } = wrapper();
    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await new Promise((r) => setTimeout(r, 10));
    expect(verifyPayment).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull();
  });

  it("verifies the stored reference and consumes it on success", async () => {
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await waitFor(() => expect(verifyPayment).toHaveBeenCalledWith("ref-1"));
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith("Payment confirmed", { reference: "ref-1" });
  });

  it("invalidates every cache the payment could have changed", async () => {
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));
    const { Wrapper, queryClient } = wrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());

    const keys = invalidate.mock.calls.map((c) => c[0].queryKey);
    for (const expected of [
      ["obligations"],
      ["transactions"],
      ["payment-links"],
      ["authorisations"],
      ["community"],
    ]) {
      expect(keys).toContainEqual(expected);
    }
  });

  it.each(["INITIATED", "PENDING", "PROCESSING", "FAILED"])(
    "does not settle or announce success for a non-terminal %s status",
    async (status) => {
      sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
      sessionStorage.setItem(
        "paymentPendingCtx",
        JSON.stringify({ reference: "ref-1", obligationId: "obl-1", feeMinor: 250 }),
      );
      verifyPayment.mockResolvedValue(verifying(status));
      const { Wrapper } = wrapper();

      renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });
      await waitFor(() => expect(verifyPayment).toHaveBeenCalled());

      // The reference is still consumed — this verification succeeded, it just
      // did not confirm the payment.
      await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull());
      expect(toastSuccess).not.toHaveBeenCalled();
      // Critically: no paid log was written, so a pending payment is never
      // presented as settled.
      expect(localStorage.getItem(PAID_LOG_KEY)).toBeNull();
    },
  );

  it("settles the stashed context and caches the fee on a confirmed payment", async () => {
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    sessionStorage.setItem(
      "paymentPendingCtx",
      JSON.stringify({ reference: "ref-1", obligationId: "obl-1", feeMinor: 250 }),
    );
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await waitFor(() => expect(localStorage.getItem(PAID_LOG_KEY)).not.toBeNull());
    const log = JSON.parse(localStorage.getItem(PAID_LOG_KEY));
    expect(log).toHaveLength(1);
    expect(log[0].obligationId).toBe("obl-1");
    // The fee survives to the receipt via the local fee cache.
    expect(JSON.parse(localStorage.getItem("glass_local_fee_log"))["ref-1"]).toBe(250);
  });

  it("RESTORES the reference when verification fails, so recovery is not lost", async () => {
    // The regression this pins: the key was removed up front and the rejection
    // swallowed, so ONE transient network failure destroyed the recovery state
    // permanently — nothing else ever reads paymentPendingRef. The payer saw
    // the obligation as Due and paid a second time.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await waitFor(() => expect(verifyPayment).toHaveBeenCalledWith("ref-1"));
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-1"));
    // No false confirmation, and nothing settled.
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(PAID_LOG_KEY)).toBeNull();
  });

  it("closing and reopening the app retries a previously-failed verification", async () => {
    // The recovery path end to end: a failed verify leaves the reference
    // recoverable, and the next mount picks it up and can confirm it.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValueOnce(new Error("Network Error"));
    const first = wrapper();
    const { unmount } = renderHook(() => usePendingPaymentVerification(), {
      wrapper: first.Wrapper,
    });
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-1"));
    unmount();

    // "Reopen": a fresh mount (new session, new QueryClient) with a working
    // backend this time.
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));
    const second = wrapper();
    renderHook(() => usePendingPaymentVerification(), { wrapper: second.Wrapper });

    await waitFor(() => expect(verifyPayment).toHaveBeenCalledTimes(2));
    expect(verifyPayment).toHaveBeenLastCalledWith("ref-1");
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith("Payment confirmed", { reference: "ref-1" });
  });

  it("attempts a stored reference at most once per mount", async () => {
    // Still attempt-once: the effect does not loop or retry in place, so a
    // backend that keeps failing cannot become a request loop.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 50));

    expect(verifyPayment).toHaveBeenCalledTimes(1);
  });

  it("a second mount does not re-verify an already-consumed reference", async () => {
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));

    const first = wrapper();
    const { unmount } = renderHook(() => usePendingPaymentVerification(), {
      wrapper: first.Wrapper,
    });
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull());
    unmount();

    const second = wrapper();
    renderHook(() => usePendingPaymentVerification(), { wrapper: second.Wrapper });
    await new Promise((r) => setTimeout(r, 20));

    expect(verifyPayment).toHaveBeenCalledTimes(1);
  });

  it("a sessionStorage failure does not escape into the render", async () => {
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    const { Wrapper } = wrapper();

    expect(() =>
      renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Terminal-consumption tombstone.
//
// This hook consumes "paymentPendingRef" up front, but three terminal consumers
// clear it independently and cannot see that the hook already took it:
//   - PaymentCallback.jsx consumePendingFlags()  (terminal verification state)
//   - PaymentSuccess.jsx consumePendingFlags()   (same shape, member path)
//   - SignIn.jsx                                  (auth boundary)
//
// The reachable collision: the hook removes the reference and its verify is still
// in flight when a terminal consumer runs consumePendingFlags() — a no-op on the
// reference, but the hook has no way to learn about it. Its request then rejects
// (session expiry, network drop) and the unguarded catch restored the reference,
// so the next Home mount re-verified an already-settled payment and fired a
// duplicate "Payment confirmed" toast.
//
// The tombstone lets the failure path tell those two cases apart.
// ─────────────────────────────────────────────────────────────────────────────
describe("usePendingPaymentVerification terminal-consumption tombstone", () => {
  const TOMBSTONE_KEY = "paymentPendingRef_terminal";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  // A promise the test controls, so the verify can be held outstanding across the
  // moment the terminal consumer acts. mockRejectedValue settles in a microtask,
  // which lands BEFORE the consumer can run — so it cannot model the race at all
  // and a test built on it passes whether or not the guard exists.
  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // Stands in for PaymentCallback/PaymentSuccess/SignIn reaching a terminal
  // state while the hook's verify is still outstanding. Only the tombstone write
  // and the removeItem are modelled — those are the only two storage effects the
  // guard reads, and importing the pages would drag in the router and auth
  // providers they depend on.
  function simulateTerminalConsumption(reference) {
    // Matches the real consumers, which write the tombstone unconditionally
    // from their own reference (the pending reference is already gone by now).
    sessionStorage.setItem(TOMBSTONE_KEY, reference);
    sessionStorage.removeItem(PENDING_REF_KEY);
  }

  it("does NOT restore a reference a terminal consumer has already settled", async () => {
    // The regression: before the tombstone the catch wrote the reference back
    // unconditionally, resurrecting a payment the callback had already confirmed.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    const pending = deferred();
    verifyPayment.mockReturnValue(pending.promise);
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });
    await waitFor(() => expect(verifyPayment).toHaveBeenCalledWith("ref-1"));
    // The hook has taken the reference and its verify is still outstanding.
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull();

    // A terminal consumer settles the payment while that request is in flight.
    simulateTerminalConsumption("ref-1");

    // NOW the rejection lands. Recovery must NOT bring the reference back — doing
    // so would re-verify a settled payment and toast "Payment confirmed" twice.
    pending.reject(new Error("Network Error"));
    await new Promise((r) => setTimeout(r, 20));

    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(PAID_LOG_KEY)).toBeNull();
  });

  it("a later mount does not resurrect a terminally-consumed reference", async () => {
    // End to end: the resurrection is only observable on a subsequent mount.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    const pending = deferred();
    verifyPayment.mockReturnValue(pending.promise);
    const first = wrapper();
    renderHook(() => usePendingPaymentVerification(), { wrapper: first.Wrapper });
    await waitFor(() => expect(verifyPayment).toHaveBeenCalledTimes(1));
    simulateTerminalConsumption("ref-1");
    pending.reject(new Error("Network Error"));
    await new Promise((r) => setTimeout(r, 20));

    // Reopen. Nothing may be re-verified for the settled payment.
    verifyPayment.mockClear();
    verifyPayment.mockResolvedValue(verifying("SUCCESSFUL"));
    const second = wrapper();
    renderHook(() => usePendingPaymentVerification(), { wrapper: second.Wrapper });
    await new Promise((r) => setTimeout(r, 20));

    expect(verifyPayment).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBeNull();
  });

  it("still restores the reference when NO terminal consumer ran", async () => {
    // The guard must not over-apply: an ordinary transient failure with no
    // terminal settlement is exactly the case recovery exists for. Without this
    // assertion a tombstone that always blocked restoration would pass.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-1"));
    expect(sessionStorage.getItem(TOMBSTONE_KEY)).toBeNull();
  });

  it("restores when the tombstone names a DIFFERENT reference", async () => {
    // The tombstone is keyed to a specific reference: a terminal consumer
    // settling an unrelated payment must not suppress recovery of this one.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-A");
    sessionStorage.setItem(TOMBSTONE_KEY, "ref-B");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });

    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-A"));
  });

  it("a tombstone set after the failure does not suppress a later restore", async () => {
    // Ordering guard: the failure path must read the tombstone as it stood when
    // the rejection landed. A consumer settling AFTER the failure is a different
    // event and must not retroactively undo the restore.
    sessionStorage.setItem(PENDING_REF_KEY, "ref-1");
    verifyPayment.mockRejectedValue(new Error("Network Error"));
    const { Wrapper } = wrapper();

    renderHook(() => usePendingPaymentVerification(), { wrapper: Wrapper });
    await waitFor(() => expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-1"));

    sessionStorage.setItem(TOMBSTONE_KEY, "ref-1");
    expect(sessionStorage.getItem(PENDING_REF_KEY)).toBe("ref-1");
  });
});
