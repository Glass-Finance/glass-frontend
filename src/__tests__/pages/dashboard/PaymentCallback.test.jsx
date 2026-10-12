import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import PaymentCallback from "../../../pages/dashboard/PaymentCallback";
import { beginAuthGrace } from "../../../api/client";
import { verifyPayment } from "../../../api/members";
import { settleLocalPaymentForReference, peekPendingPaymentCtx } from "../../../hooks/usePayments";

vi.mock("../../../api/client", () => ({
  beginAuthGrace: vi.fn(),
}));

vi.mock("../../../api/members", () => ({
  verifyPayment: vi.fn(),
}));

vi.mock("../../../store/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAdmin: true,
    loading: false,
  })),
}));

vi.mock("../../../hooks/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("../../../hooks/usePayments", () => ({
  settleLocalPaymentForReference: vi.fn(),
  peekPendingPaymentCtx: vi.fn(),
  findAuthorisationForPlan: vi.fn(),
  fetchAuthorisationsOnce: vi.fn(),
}));

vi.mock("../../../components/LoadingScreen", () => ({
  default: () => <div>Loading</div>,
}));

vi.mock("../../../pages/memberApp/PaymentSuccess", () => ({
  default: () => <div>Payment successful</div>,
}));

vi.mock("../../../components/common/SuccessBadge", () => ({
  // Renders the message/subMessage it is given rather than a fixed string, so
  // assertions about the success state reflect what the real badge shows. The
  // success branch is the ONLY one that renders a SuccessBadge, so "is this
  // text present?" is a meaningful success/failure probe.
  default: ({ message, subMessage }) => (
    <div>
      <div>{message}</div>
      {subMessage ? <div>{subMessage}</div> : null}
    </div>
  ),
}));

vi.mock("../../../components/ui/Button", () => ({
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

function renderCallback(initialEntry = "/payment/callback?reference=ref-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PaymentCallback />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PaymentCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    peekPendingPaymentCtx.mockReturnValue({
      reference: "ref-1",
      paymentLinkId: "link-1",
      obligationId: "obl-1",
      feeMinor: 10000,
    });

    verifyPayment.mockResolvedValue({
      data: {
        data: {
          status: "success",
          reference: "ref-1",
          amount: 500000,
        },
      },
    });
  });

  it("opens auth grace when the callback page mounts", () => {
    renderCallback();

    expect(beginAuthGrace).toHaveBeenCalledTimes(1);
  });

  it("verifies the Paystack reference returned in the callback URL", async () => {
    renderCallback("/payment/callback?reference=ref-1");

    await waitFor(() => {
      expect(verifyPayment).toHaveBeenCalledWith("ref-1", { _skipAuthRedirect: true });
    });
  });

  it("settles the pending local payment after successful verification", async () => {
    renderCallback("/payment/callback?reference=ref-1");

    await waitFor(() => {
      expect(settleLocalPaymentForReference).toHaveBeenCalledWith("ref-1");
    });
  });

  it("uses the pending payment context after successful verification", async () => {
    renderCallback("/payment/callback?reference=ref-1");

    await waitFor(() => {
      expect(peekPendingPaymentCtx).toHaveBeenCalled();
    });
  });

  it("does not verify a payment when the callback has no reference", async () => {
    renderCallback("/payment/callback");

    await waitFor(() => {
      expect(verifyPayment).not.toHaveBeenCalled();
    });
  });

  it("does not settle the local payment when verification fails", async () => {
    verifyPayment.mockRejectedValueOnce({
      response: {
        data: {
          description: "Payment verification failed",
        },
      },
    });

    renderCallback("/payment/callback?reference=ref-failed");

    await waitFor(() => {
      expect(verifyPayment).toHaveBeenCalledWith("ref-failed", { _skipAuthRedirect: true });
    });

    expect(settleLocalPaymentForReference).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure paths: network loss, poll exhaustion, and session expiry.
//
// The regression these pin: the callback page must never render "Payment
// Successful" without the backend confirming SUCCESS/SUCCESSFUL
// (utils/paymentStatus.js). A verify call that never reaches the backend --
// offline, DNS failure, dropped connection -- says nothing about whether the
// money moved, so every outcome here has to stay in an unconfirmed state.
//
// These drive the component's own retry loop with fake timers (the convention
// already used in PaymentSuccess.test.jsx) rather than waiting in real time.
// ─────────────────────────────────────────────────────────────────────────────
describe("PaymentCallback failure paths", () => {
  // Mirrors PaymentCallback.jsx's own constants.
  const POLL_INTERVAL_MS = 1500;
  const MAX_POLLS = 20;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    peekPendingPaymentCtx.mockReturnValue({
      reference: "ref-net",
      paymentLinkId: "link-1",
      obligationId: "obl-1",
      feeMinor: 10000,
    });
    sessionStorage.setItem("paymentReturnTo", "/dashboard/admin");
    sessionStorage.setItem("paymentPendingRef", "ref-net");
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  /** Run the poll loop to exhaustion without waiting in real time. */
  async function exhaustPolls() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * (MAX_POLLS + 2));
    });
  }

  it("stays unconfirmed when the network rejects every poll, never showing success", async () => {
    // No `.response` at all -- what an offline/failed-to-fetch rejection looks
    // like, as distinct from a 4xx/5xx that carries a response.
    verifyPayment.mockRejectedValue(new TypeError("Failed to fetch"));

    renderCallback("/payment/callback?reference=ref-net");
    await exhaustPolls();

    expect(screen.getByText("Still confirming…")).toBeTruthy();
    expect(screen.queryByText("Payment Successful")).toBeNull();
    expect(screen.queryByText("Payment Failed")).toBeNull();
    expect(settleLocalPaymentForReference).not.toHaveBeenCalled();
  });

  it("retries to the poll limit and then stops, rather than looping forever", async () => {
    verifyPayment.mockRejectedValue(new TypeError("Failed to fetch"));

    renderCallback("/payment/callback?reference=ref-net");
    await exhaustPolls();

    expect(verifyPayment).toHaveBeenCalledTimes(MAX_POLLS);

    // Nothing further is scheduled once the limit is reached.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(verifyPayment).toHaveBeenCalledTimes(MAX_POLLS);
  });

  it("shows 'processing' when the backend queued verification before the network dropped", async () => {
    // verificationQueued: true means the backend accepted the charge; the later
    // network loss only delays the status write. That is still not a confirmed
    // success, so the copy must stay hedged rather than claiming success.
    verifyPayment.mockResolvedValueOnce({
      data: { data: { status: "INITIATED", verificationQueued: true } },
    });
    verifyPayment.mockRejectedValue(new TypeError("Failed to fetch"));

    renderCallback("/payment/callback?reference=ref-net");
    await exhaustPolls();

    expect(screen.getByText("Payment Processing")).toBeTruthy();
    expect(screen.queryByText("Payment Successful")).toBeNull();
    expect(settleLocalPaymentForReference).not.toHaveBeenCalled();
  });

  it("shows the sign-in state on a 401 and leaves the pending flags for recovery", async () => {
    verifyPayment.mockRejectedValue({ response: { status: 401 } });

    renderCallback("/payment/callback?reference=ref-net");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Sign in to see your payment")).toBeTruthy();
    expect(screen.queryByText("Payment Successful")).toBeNull();
    // A session that died mid-payment must not lose the recovery state: the
    // dashboard's pending-ref check finishes the job after sign-in.
    expect(sessionStorage.getItem("paymentPendingRef")).toBe("ref-net");
    expect(sessionStorage.getItem("paymentReturnTo")).toBe("/dashboard/admin");
    // And it must not spin retrying a request that will keep 401ing.
    expect(verifyPayment).toHaveBeenCalledTimes(1);
  });

  it("consumes the pending flags on a confirmed terminal failure", async () => {
    verifyPayment.mockResolvedValue({
      data: { data: { status: "FAILED", reference: "ref-net" } },
    });

    renderCallback("/payment/callback?reference=ref-net");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Payment Failed")).toBeTruthy();
    expect(sessionStorage.getItem("paymentPendingRef")).toBeNull();
    expect(sessionStorage.getItem("paymentReturnTo")).toBeNull();
  });

  it("still requires a backend success status, not merely a resolved response", async () => {
    // A 200 carrying a non-success status must not be treated as paid. PAID is
    // an obligation status and deliberately absent from the verify allowlist
    // (paymentStatus.js VERIFICATION_SUCCESS_STATUSES = SUCCESS | SUCCESSFUL).
    verifyPayment.mockResolvedValue({
      data: { data: { status: "PAID", reference: "ref-net" } },
    });

    renderCallback("/payment/callback?reference=ref-net");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.queryByText("Payment Successful")).toBeNull();
    expect(settleLocalPaymentForReference).not.toHaveBeenCalled();
  });

  it("consumes the pending flags after an unconfirmed poll timeout", async () => {
    // Documents current behaviour, flagged in review rather than changed here.
    //
    // On timeout PaymentCallback clears paymentPendingRef/paymentReturnTo on
    // BOTH the `processing` and `unknown` paths (PaymentCallback.jsx calls
    // consumePendingFlags() before setState). That means after a fully
    // unconfirmed result the automatic recovery in
    // usePendingPaymentVerification -- mounted on AdminDashboard and
    // memberApp/Home -- can no longer run, because it reads
    // paymentPendingRef. A 401 deliberately keeps the flags; an exhausted poll
    // does not. Whether that asymmetry is correct is a product/backend
    // question, so it is pinned here rather than silently altered.
    verifyPayment.mockRejectedValue(new TypeError("Failed to fetch"));

    renderCallback("/payment/callback?reference=ref-net");
    await exhaustPolls();

    expect(screen.getByText("Still confirming…")).toBeTruthy();
    expect(sessionStorage.getItem("paymentPendingRef")).toBeNull();
    expect(sessionStorage.getItem("paymentReturnTo")).toBeNull();
  });

  it("reports success only when the backend confirms SUCCESSFUL", async () => {
    verifyPayment.mockResolvedValue({
      data: { data: { status: "SUCCESSFUL", reference: "ref-net" } },
    });

    renderCallback("/payment/callback?reference=ref-net");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Payment Successful")).toBeTruthy();
    expect(settleLocalPaymentForReference).toHaveBeenCalledWith("ref-net");
    expect(sessionStorage.getItem("paymentPendingRef")).toBeNull();
  });
});
