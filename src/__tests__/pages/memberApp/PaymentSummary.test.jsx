import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PaymentSummary from "../../../pages/memberApp/PaymentSummary";
import { getObligation } from "../../../api/members";
import {
  useManagePayments,
  useInitiatePayment,
  findAuthorisationForPlan,
} from "../../../hooks/usePayments";

// Regression: this screen used to call the real charge endpoint
// (initiatePayment) automatically as soon as the obligation loaded, before
// the member ever pressed "Make Payment" -- for a payer with an existing
// saved/authorised method that charged them with no confirmation at all
// (see AUDIT_REPORT.md, F01). These tests pin the fix: no charge until the
// button is explicitly clicked, exactly once per click.

vi.mock("../../../api/members", () => ({
  getObligation: vi.fn(),
  getPaymentLink: vi.fn(),
}));

vi.mock("../../../hooks/usePayments", () => ({
  useManagePayments: vi.fn(),
  useInitiatePayment: vi.fn(),
  recordLocalPayment: vi.fn(),
  recordLocalFee: vi.fn(),
  stashPendingPaymentCtx: vi.fn(),
  findAuthorisationForPlan: vi.fn(),
}));

function obligation(overrides = {}) {
  return {
    id: "ob-1",
    amount: 5000,
    community: { name: "Kings College Alumni" },
    recurringPlan: null,
    paymentLink: { id: "link-1", title: "Monthly Dues" },
    ...overrides,
  };
}

function renderPaymentSummary() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/member/pay/ob-1"]}>
        <Routes>
          <Route path="/member/pay/:paymentId" element={<PaymentSummary />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let mutateAsync;

beforeEach(() => {
  getObligation.mockResolvedValue({ data: { data: obligation() } });
  useManagePayments.mockReturnValue({ data: [] });
  findAuthorisationForPlan.mockReturnValue(null);
  mutateAsync = vi.fn().mockResolvedValue({
    data: { data: { authorizationUrl: "https://paystack.example/pay", reference: "ref-1" } },
  });
  useInitiatePayment.mockReturnValue({ mutateAsync, isPending: false });
});

describe("PaymentSummary charge timing", () => {
  it("does not call initiatePayment while the page is just loading/displaying", async () => {
    renderPaymentSummary();

    await waitFor(() => expect(screen.getByText("Make Payment")).toBeDefined());

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("calls initiatePayment exactly once, only after Make Payment is clicked", async () => {
    renderPaymentSummary();

    const button = await screen.findByText("Make Payment");
    button.click();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentLinkId: "link-1",
        payload: expect.objectContaining({ amount: 5000 }),
      }),
    );
  });

  it("keeps Auto-Pay off until the member explicitly opts in", async () => {
    getObligation.mockResolvedValue({
      data: { data: obligation({ recurringPlan: { frequency: "MONTHLY" } }) },
    });
    renderPaymentSummary();

    const autoPaySwitch = await screen.findByRole("switch", {
      name: "Enable Auto-Pay for this plan",
    });
    expect(autoPaySwitch.getAttribute("aria-checked")).toBe("false");

    autoPaySwitch.click();
    (await screen.findByText("Make Payment")).click();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0].payload.savePaymentMethod).toBe(true);
  });

  it("labels the displayed amount as community dues and explains fee visibility", async () => {
    renderPaymentSummary();

    expect(await screen.findByText("Amount due to community:")).toBeDefined();
    expect(
      screen.getByText(
        "This is the amount owed to the community. A platform fee may also apply; the final amount is calculated when payment starts and shown in your receipt.",
      ),
    ).toBeDefined();
  });

  it("reuses the same idempotency key after a failed attempt is retried on the same mount", async () => {
    // A successful redirect navigates the page away for real, so the only
    // same-mount retry that actually happens is after a failure -- the
    // catch branch leaves the button enabled and the component mounted.
    mutateAsync.mockRejectedValueOnce(new Error("network error"));
    renderPaymentSummary();

    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    const firstKey = mutateAsync.mock.calls[0][0].payload.idempotencyKey;
    expect(firstKey).toBeTruthy();

    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));

    const secondKey = mutateAsync.mock.calls[1][0].payload.idempotencyKey;
    expect(secondKey).toBe(firstKey);
  });

  it("generates a genuinely different idempotency key for a fresh mount (a new, separate payment attempt)", async () => {
    mutateAsync.mockRejectedValue(new Error("network error"));
    const { unmount } = renderPaymentSummary();

    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const firstAttemptKey = mutateAsync.mock.calls[0][0].payload.idempotencyKey;

    unmount(); // simulates navigating away and back -- a real new attempt, not a re-render

    renderPaymentSummary();
    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    const secondAttemptKey = mutateAsync.mock.calls[1][0].payload.idempotencyKey;

    expect(secondAttemptKey).not.toBe(firstAttemptKey);
  });
});
