import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import PaymentSummary from "../../../pages/memberApp/PaymentSummary";
import { getObligation } from "../../../api/members";
import {
  useInitiatePayment,
  useManagePayments,
  stashPendingPaymentCtx,
  recordLocalPayment,
  recordLocalFee,
} from "../../../hooks/usePayments";

vi.mock("../../../api/members", () => ({
  getObligation: vi.fn(),
}));

vi.mock("../../../hooks/usePayments", () => ({
  useInitiatePayment: vi.fn(),
  useManagePayments: vi.fn(),
  stashPendingPaymentCtx: vi.fn(),
  recordLocalPayment: vi.fn(),
  recordLocalFee: vi.fn(),
  findAuthorisationForPlan: vi.fn(),
}));

function makeObligation(overrides = {}) {
  return {
    id: "obl-1",
    amount: 500000,
    community: {
      name: "Kings College Alumni",
    },
    paymentLink: {
      id: "link-1",
      title: "Termly Dues",
    },
    recurringPlan: null,
    ...overrides,
  };
}

function renderPaymentSummary() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/member/pay/obl-1"]}>
        <Routes>
          <Route path="/member/pay/:paymentId" element={<PaymentSummary />} />
          <Route path="/member/pay/:paymentId/success" element={<div>Payment Success</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PaymentSummary payment authorization redirect", () => {
  let mutateAsync;

  beforeEach(() => {
    vi.clearAllMocks();

    getObligation.mockResolvedValue({
      data: {
        data: makeObligation(),
      },
    });

    useManagePayments.mockReturnValue({
      data: [],
    });

    mutateAsync = vi.fn().mockResolvedValue({
      data: {
        data: {
          authorizationUrl: "https://checkout.example.com/pay/ref-123",
          reference: "ref-123",
          billedAmount: 510000,
        },
      },
    });

    useInitiatePayment.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("initiates the payment with the expected payment data", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(screen.getByRole("switch", { name: "Save payment method" }));
    fireEvent.click(payButton);

    expect(mutateAsync).toHaveBeenCalledTimes(1);

    const call = mutateAsync.mock.calls[0][0];

    expect(call.paymentLinkId).toBe("link-1");
    expect(call.payload.amount).toBe(500000);
    expect(call.payload.savePaymentMethod).toBe(true);
    expect(call.payload.obligationId).toBe("obl-1");
    expect(call.payload.idempotencyKey).toEqual(expect.any(String));
  });

  it("stashes the pending payment context before redirecting", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    await vi.waitFor(() => expect(stashPendingPaymentCtx).toHaveBeenCalledTimes(1));

    expect(stashPendingPaymentCtx).toHaveBeenCalledWith({
      reference: "ref-123",
      paymentLinkId: "link-1",
      obligationId: "obl-1",
      feeMinor: 10000,
    });
  });

  it("does not record the payment locally before authorization completes", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    expect(recordLocalPayment).not.toHaveBeenCalled();
    expect(recordLocalFee).not.toHaveBeenCalled();
  });

  it("stores the return destination and pending reference", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    await vi.waitFor(() => expect(sessionStorage.getItem("paymentReturnTo")).toBe("/member/home"));

    expect(sessionStorage.getItem("paymentPendingRef")).toBe("ref-123");
  });

  it("does not navigate to the in-app success page before authorization completes", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    expect(screen.queryByText("Payment Success")).toBeNull();
  });
});
