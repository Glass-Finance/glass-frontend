import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminPaymentModal } from "../../../components/dashboard/AdminPaymentModal";
import {
  useManagePayments,
  useInitiatePayment,
  findAuthorisationForPlan,
} from "../../../hooks/usePayments";
import { paymentsDisabled } from "../../../lib/flags";

// Regression: this modal used to call the real charge endpoint automatically
// as soon as it opened (to preview the fee), then call it *again* with a
// different random idempotency key when the admin clicked "Make Payment" --
// for a member with a saved/authorised method that could charge them twice
// (see AUDIT_REPORT.md, F01/F02). These tests pin the fix: no charge until
// the button is clicked, and one stable idempotency key per attempt.

vi.mock("../../../hooks/usePayments", () => ({
  useManagePayments: vi.fn(),
  useInitiatePayment: vi.fn(),
  recordLocalPayment: vi.fn(),
  stashPendingPaymentCtx: vi.fn(),
  findAuthorisationForPlan: vi.fn(),
}));

// Default the kill switch to OFF so every other test sees an enabled button.
// The one test that needs it ON overrides this with mockReturnValue(true).
vi.mock("../../../lib/flags", () => ({
  paymentsDisabled: vi.fn(() => false),
}));

function item(overrides = {}) {
  return {
    paymentLinkId: "link-1",
    obligationId: "ob-1",
    name: "Monthly Dues",
    communityName: "Kings College Alumni",
    amount: 5000,
    type: "one-time",
    ...overrides,
  };
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <AdminPaymentModal item={item()} onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

let mutateAsync;

beforeEach(() => {
  useManagePayments.mockReturnValue({ data: [] });
  findAuthorisationForPlan.mockReturnValue(null);
  // Reset the kill switch to OFF between tests so the kill-switch test's
  // mockReturnValue(true) doesn't leak into the ones that follow.
  paymentsDisabled.mockReturnValue(false);
  mutateAsync = vi.fn().mockResolvedValue({
    data: { data: { authorizationUrl: "https://paystack.example/pay", reference: "ref-1" } },
  });
  useInitiatePayment.mockReturnValue({ mutateAsync, isPending: false });
});

describe("AdminPaymentModal charge timing", () => {
  it("does not call initiatePayment just from opening the modal", async () => {
    renderModal();

    await waitFor(() => expect(screen.getByText("Make Payment")).toBeDefined());

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("calls initiatePayment exactly once, only after Make Payment is clicked", async () => {
    renderModal();

    (await screen.findByText("Make Payment")).click();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentLinkId: "link-1",
        payload: expect.objectContaining({ amount: 5000 }),
      }),
    );
  });

  it("reuses the same idempotency key after a failed attempt is retried on the same mount", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("network error"));
    renderModal();

    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const firstKey = mutateAsync.mock.calls[0][0].payload.idempotencyKey;
    expect(firstKey).toBeTruthy();

    (await screen.findByText("Make Payment")).click();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    const secondKey = mutateAsync.mock.calls[1][0].payload.idempotencyKey;

    expect(secondKey).toBe(firstKey);
  });
});

describe("AdminPaymentModal unknown amount", () => {
  // item.amount is raw.amount off the obligation record, so a record with no
  // amount yet yields null/undefined. The amount row renders "—" (formatNaira
  // emptyDash) but the Pay button used to stay enabled and forward
  // amount:null to the charge endpoint.
  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("disables Make Payment and shows Amount Unavailable when amount is %s", (_label, amount) => {
    renderModal({ item: item({ amount }) });

    const button = screen.getByText("Amount Unavailable").closest("button");
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(true);
  });

  it("renders — in the amount row when the amount is unknown", () => {
    renderModal({ item: item({ amount: null }) });

    expect(screen.getByText("—")).toBeDefined();
  });

  it("still allows payment when the amount is a legitimate zero (free plan)", async () => {
    renderModal({ item: item({ amount: 0 }) });

    const button = screen.getByText("Make Payment").closest("button");
    expect(button.disabled).toBe(false);

    (await screen.findByText("Make Payment")).click();
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentLinkId: "link-1",
          payload: expect.objectContaining({ amount: 0 }),
        }),
      ),
    );
  });

  it("blocks the charge in handlePay even if the disabled button is bypassed", async () => {
    // The disabled attribute is the primary guard, but handlePay carries its
    // own check as defence-in-depth. A disabled button won't dispatch a click
    // in jsdom, so invoke the React onClick prop directly to reach the handler
    // and prove it refuses to call initiatePayment.
    renderModal({ item: item({ amount: null }) });

    const button = screen.getByText("Amount Unavailable").closest("button");
    expect(button.disabled).toBe(true);

    const propsKey = Object.keys(button).find((k) => k.startsWith("__reactProps$"));
    await act(async () => {
      button[propsKey].onClick();
    });

    await waitFor(() =>
      expect(
        screen.getByText("Amount unavailable. Please close this and try again."),
      ).toBeDefined(),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe("AdminPaymentModal existing disabled conditions", () => {
  it("disables the button and never initiates payment while the kill switch is engaged", async () => {
    vi.mocked(paymentsDisabled).mockReturnValue(true);
    renderModal();

    const button = await screen.findByText("Payments Temporarily Unavailable");
    expect(button.closest("button").disabled).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("disables the button while the link is reported inactive", async () => {
    // isLinkInactive is derived from an error string matching /not accepting
    // payments/i. Drive it through the handler by rejecting the charge with
    // that message, then clicking again -- the label flips to Payment
    // Unavailable and the button becomes disabled.
    mutateAsync.mockRejectedValue(new Error("This link is not accepting payments"));
    renderModal();

    (await screen.findByText("Make Payment")).click();

    expect(await screen.findByText("Payment Unavailable")).toBeDefined();
    expect(screen.getByText("Payment Unavailable").closest("button").disabled).toBe(true);
  });
});
