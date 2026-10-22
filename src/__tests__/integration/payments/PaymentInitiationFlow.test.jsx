import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import PaymentSummary from "../../../pages/memberApp/PaymentSummary";
import { getObligation } from "../../../api/members";
import { useInitiatePayment, useManagePayments } from "../../../hooks/usePayments";

vi.mock("../../../api/members", async () => {
  const actual = await vi.importActual("../../../api/members");

  return {
    ...actual,
    getObligation: vi.fn(),
  };
});

vi.mock("../../../hooks/usePayments", async () => {
  const actual = await vi.importActual("../../../hooks/usePayments");

  return {
    ...actual,
    useInitiatePayment: vi.fn(),
    useManagePayments: vi.fn(),
  };
});

const obligation = {
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
};

let mutateAsync;
let originalLocation;

beforeEach(() => {
  vi.clearAllMocks();

  getObligation.mockResolvedValue({
    data: {
      data: obligation,
    },
  });

  useManagePayments.mockReturnValue({
    data: [],
  });

  mutateAsync = vi.fn().mockRejectedValue({
    response: {
      data: {
        description: "Payment failed",
      },
    },
  });

  useInitiatePayment.mockReturnValue({
    mutateAsync,
    isPending: false,
  });

  originalLocation = window.location;

  delete window.location;

  window.location = {
    ...originalLocation,
    href: "",
  };
});

afterEach(() => {
  window.location = originalLocation;
  cleanup();
});

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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PaymentSummary payment initiation flow", () => {
  it("loads the obligation without initiating a payment", async () => {
    renderPaymentSummary();

    await screen.findByText("Make Payment");

    expect(getObligation).toHaveBeenCalledWith("obl-1");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("sends the correct payment payload when Make Payment is clicked", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(screen.getByRole("switch", { name: "Save payment method" }));
    fireEvent.click(payButton);

    await screen.findByText("Payment failed");

    expect(mutateAsync).toHaveBeenCalledTimes(1);

    const call = mutateAsync.mock.calls[0][0];

    expect(call).toEqual({
      paymentLinkId: "link-1",
      payload: {
        idempotencyKey: expect.any(String),
        amount: 500000,
        savePaymentMethod: true,
        obligationId: "obl-1",
      },
    });
  });

  it("reuses the same idempotency key when payment initiation is retried", async () => {
    renderPaymentSummary();

    const payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    await screen.findByText("Payment failed");

    const firstKey = mutateAsync.mock.calls[0][0].payload.idempotencyKey;

    expect(firstKey).toBeTruthy();

    fireEvent.click(screen.getByText("Make Payment"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(2);
    });

    const secondKey = mutateAsync.mock.calls[1][0].payload.idempotencyKey;

    expect(secondKey).toBe(firstKey);
  });

  it("generates a new idempotency key for a fresh payment mount", async () => {
    renderPaymentSummary();

    let payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    await screen.findByText("Payment failed");

    const firstAttemptKey = mutateAsync.mock.calls[0][0].payload.idempotencyKey;

    cleanup();

    renderPaymentSummary();

    payButton = await screen.findByText("Make Payment");

    fireEvent.click(payButton);

    await screen.findByText("Payment failed");

    const secondAttemptKey = mutateAsync.mock.calls[1][0].payload.idempotencyKey;

    expect(secondAttemptKey).not.toBe(firstAttemptKey);
  });
});
