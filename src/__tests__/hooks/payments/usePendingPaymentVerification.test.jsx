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
