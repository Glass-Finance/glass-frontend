import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Payments from "../../../pages/dashboard/Payments";
import { usePaymentPlans } from "../../../hooks/usePaymentPlans";
import { notifyError } from "../../../utils/errorHandler";

// Page-level behavior for the Payments dashboard: state chrome
// (loading/empty/error), stats + tab filtering, and the wiring of every
// plan mutation through to its modal/flash-success/notifyError outcome.
// Payload *shapes* are pinned in the modal tests; only call wiring and
// failure routing are asserted here to avoid duplicating those.

vi.mock("../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(() => "comm-1"),
}));
vi.mock("../../../hooks/usePaymentPlans", () => ({
  usePaymentPlans: vi.fn(),
}));
vi.mock("../../../hooks/useSlug", async () => {
  const { useState } = await vi.importActual("react");
  return {
    useSlug: () => {
      const [slug, setSlug] = useState("");
      return {
        slug,
        setSlug,
        available: slug === "" ? null : slug === "taken" ? false : true,
        checking: false,
        suggesting: false,
        suggestFrom: () => {},
      };
    },
  };
});
vi.mock("../../../hooks/useCommunityAccount", () => ({
  useCommunityAccount: () => ({ accounts: [], account: null, isLoading: false }),
}));
vi.mock("../../../utils/errorHandler", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, notifyError: vi.fn() };
});

function makePlanPlans(overrides = {}) {
  return {
    plans: [],
    isLoading: false,
    error: null,
    create: { mutateAsync: vi.fn(), isPending: false, error: null },
    update: { mutateAsync: vi.fn(), isPending: false, error: null },
    duplicate: { mutateAsync: vi.fn(), isPending: false, error: null },
    activate: { mutate: vi.fn(), isPending: false },
    pause: { mutate: vi.fn(), isPending: false },
    resume: { mutate: vi.fn(), isPending: false },
    expire: { mutate: vi.fn(), isPending: false },
    archive: { mutate: vi.fn(), isPending: false },
    ...overrides,
  };
}

function planFixture(overrides = {}) {
  return {
    id: "plan-1",
    slug: "monthly-dues",
    name: "Monthly Dues",
    type: "RECURRING",
    frequency: "MONTHLY",
    amount: 5000,
    status: "ACTIVE",
    amountCollected: 50000,
    expectedAmount: 100000,
    paidCount: 3,
    partialCount: 0,
    unpaidCount: 2,
    totalCount: 5,
    currency: "NGN",
    dueAt: null,
    description: "",
    reminderFrequency: "EVERY_3_DAYS",
    reminderChannels: ["IN_APP"],
    communityAccountId: "",
    recurringPlan: { interval: 1, billingDay: 5, retryPolicy: "NO_RETRY", graceDays: 0 },
    ...overrides,
  };
}

function renderPage(planPlans = makePlanPlans()) {
  usePaymentPlans.mockReturnValue(planPlans);
  const view = render(
    <MemoryRouter>
      <Payments />
    </MemoryRouter>,
  );
  return { ...planPlans, ...view };
}

// The overflow trigger is the only button rendered inside a plan card
// before the menu opens.
function openMenu(planName = "Monthly Dues") {
  const card = screen.getByText(planName).closest("div.rounded-2xl");
  fireEvent.click(card.querySelector("button"));
}

function statValue(label) {
  const card = screen.getByText(label).parentElement;
  return card.querySelector("span.text-xl").textContent;
}

function footerButton(label) {
  const anchor = screen.getByRole("button", { name: "Back" });
  return [...anchor.parentElement.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
}

function openWizardAndFillDetails() {
  fireEvent.click(screen.getByRole("button", { name: "Create Payment Plan" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByPlaceholderText("Enter plan name"), {
    target: { value: "Monthly Dues" },
  });
  fireEvent.change(screen.getByPlaceholderText("₦0.00"), { target: { value: "5000" } });
  fireEvent.change(screen.getByDisplayValue("Select frequency"), {
    target: { value: "MONTHLY" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g. alumni-dues-2026"), {
    target: { value: "monthly-dues" },
  });
  fireEvent.click(footerButton("Continue")); // step 2 → 3
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Payments — page states", () => {
  it("skeletons the plan grid while plans are loading", () => {
    const { container } = renderPage(makePlanPlans({ isLoading: true }));

    // The skeleton deliberately mirrors the real plan grid's classes so the
    // loaded layout does not shift under the user -- that is the whole point of
    // it, so assert the layout classes rather than merely "something rendered".
    const grid = container.querySelector(".grid.grid-cols-1");
    expect(grid).toBeTruthy();
    expect(grid?.children).toHaveLength(4);

    // And the empty state must still be suppressed, or a slow fetch would
    // flash "no plans yet" before the plans arrive.
    expect(screen.queryByText("No payment plans yet")).toBeNull();
  });

  it("hides header and tabs and shows the first-plan empty state when there are no plans", () => {
    renderPage();

    expect(screen.queryByRole("heading", { level: 1, name: "Payments" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Payment Plan" })).toBeNull();
    expect(screen.getByText("No payment plans yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Create your first payment plan to start collecting dues from your members.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Collection" })).toBeTruthy();
  });

  it("keeps the header and tabs visible when the plans query errors", () => {
    renderPage(makePlanPlans({ error: new Error("network down") }));

    expect(screen.getByRole("heading", { level: 1, name: "Payments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All Plans" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recurring" })).toBeTruthy();
  });

  it("computes the four stat tiles from the plan list", () => {
    renderPage(
      makePlanPlans({
        plans: [
          planFixture(),
          planFixture({
            id: "plan-2",
            slug: "event-fee",
            name: "Event Fee",
            type: "ONE_TIME",
            status: "EXPIRED",
            amountCollected: 0,
            unpaidCount: 0,
          }),
        ],
      }),
    );

    expect(statValue("Total Amount Collected")).toBe("₦50,000");
    expect(statValue("Active Plans")).toBe("1");
    expect(statValue("Yet to pay")).toBe("2");
    expect(statValue("Failed Payments")).toBe("1");
  });

  it("labels a VARIABLE plan with no baseline instead of showing ₦0", () => {
    // The service stores 0 for "no amount", which would otherwise read as a
    // free plan rather than one where the member chooses the figure.
    renderPage(
      makePlanPlans({
        plans: [planFixture({ type: "ONE_TIME", amountMode: "VARIABLE", amount: 0 })],
      }),
    );

    expect(screen.getByText("Any amount")).toBeTruthy();
    expect(screen.queryByText("₦0")).toBeNull();
  });

  it("filters plans by tab", () => {
    renderPage(
      makePlanPlans({
        plans: [
          planFixture(),
          planFixture({
            id: "plan-2",
            slug: "event-fee",
            name: "Event Fee",
            type: "ONE_TIME",
            status: "EXPIRED",
          }),
        ],
      }),
    );
    expect(screen.getByText("Monthly Dues")).toBeTruthy();
    expect(screen.getByText("Event Fee")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "One Time" }));
    expect(screen.queryByText("Monthly Dues")).toBeNull();
    expect(screen.getByText("Event Fee")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Recurring" }));
    expect(screen.getByText("Monthly Dues")).toBeTruthy();
    expect(screen.queryByText("Event Fee")).toBeNull();
  });

  it("shows the filtered-empty state but keeps header and tabs", () => {
    renderPage(makePlanPlans({ plans: [planFixture()] }));

    fireEvent.click(screen.getByRole("button", { name: "One Time" }));

    expect(screen.getByText("No plans match this filter")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Payments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All Plans" })).toBeTruthy();
  });
});

describe("Payments — create", () => {
  it("creates a plan through the wizard and flashes success", async () => {
    const { create } = renderPage(makePlanPlans({ plans: [planFixture()] }));

    openWizardAndFillDetails();
    fireEvent.click(footerButton("Create Plan"));

    expect(create.mutateAsync).toHaveBeenCalledTimes(1);
    expect(create.mutateAsync.mock.calls[0][0]).toEqual(
      expect.objectContaining({ title: "Monthly Dues", paymentType: "RECURRING" }),
    );
    expect(await screen.findByText("Plan Created!")).toBeTruthy();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("routes a create failure to notifyError and keeps the wizard open", async () => {
    const err = new Error("Plan limit reached");
    const { create } = renderPage(makePlanPlans({ plans: [planFixture()] }));
    create.mutateAsync.mockRejectedValue(err);

    openWizardAndFillDetails();
    fireEvent.click(footerButton("Create Plan"));

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(err, { context: "Create payment plan" }),
    );
    expect(screen.queryByText("Plan Created!")).toBeNull();
    expect(screen.getByRole("heading", { name: "Create Payment Plan" })).toBeTruthy();
  });
});

describe("Payments — edit", () => {
  it("saves an edit and flashes Plan Updated!", async () => {
    const { update } = renderPage(makePlanPlans({ plans: [planFixture()] }));

    openMenu();
    fireEvent.click(screen.getByText("Edit Plan"));
    fireEvent.change(screen.getByPlaceholderText("Plan name"), {
      target: { value: "Renamed Dues" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(update.mutateAsync).toHaveBeenCalledWith({
      paymentLinkId: "plan-1",
      payload: expect.objectContaining({ title: "Renamed Dues", amount: 5000 }),
    });
    expect(await screen.findByText("Plan Updated!")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Edit Payment Plan" })).toBeNull();
  });

  it("routes an update failure to notifyError and keeps the modal open", async () => {
    const err = new Error("validation failed");
    const { update } = renderPage(makePlanPlans({ plans: [planFixture()] }));
    update.mutateAsync.mockRejectedValue(err);

    openMenu();
    fireEvent.click(screen.getByText("Edit Plan"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(err, { context: "Update payment plan" }),
    );
    expect(screen.getByRole("heading", { name: "Edit Payment Plan" })).toBeTruthy();
    expect(screen.queryByText("Plan Updated!")).toBeNull();
  });
});

describe("Payments — reminder & duplicate", () => {
  it("keeps on-demand reminders inert while the backend route is missing", () => {
    renderPage(makePlanPlans({ plans: [planFixture()] }));

    openMenu();
    const item = screen.getByText("Send Reminder").closest("button");
    // No POST .../payment-links/{id}/reminders exists server-side, so the
    // action must not be reachable: disabled, labelled, and opening nothing.
    expect(item.disabled).toBe(true);
    expect(item.getAttribute("title")).toBe("Send Reminder — coming soon");
    fireEvent.click(item);
    expect(screen.queryByRole("heading", { name: "Send Reminder" })).toBeNull();
  });

  it("duplicates a plan from the menu and flashes success", async () => {
    const { duplicate } = renderPage(makePlanPlans({ plans: [planFixture()] }));

    openMenu();
    fireEvent.click(screen.getByText("Duplicate"));
    fireEvent.change(screen.getByPlaceholderText("e.g. alumni-dues-2026"), {
      target: { value: "dues-copy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Plan" }));

    expect(duplicate.mutateAsync).toHaveBeenCalledWith({
      paymentLinkId: "plan-1",
      payload: expect.objectContaining({ title: "Monthly Dues (Copy)", slug: "dues-copy" }),
    });
    expect(await screen.findByText("Plan Duplicated!")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Duplicate Payment Plan" })).toBeNull();
  });
});

describe("Payments — direct status mutations from the menu", () => {
  it("pauses an active plan directly from the menu", () => {
    const plans = makePlanPlans({ plans: [planFixture()] });
    renderPage(plans);

    openMenu();
    fireEvent.click(screen.getByText("Pause Plan"));

    expect(plans.pause.mutate).toHaveBeenCalledWith("plan-1");
    expect(plans.expire.mutate).not.toHaveBeenCalled();
    expect(plans.archive.mutate).not.toHaveBeenCalled();
  });

  it("activates a draft plan directly from the menu", () => {
    const plans = makePlanPlans({ plans: [planFixture({ status: "DRAFT" })] });
    renderPage(plans);

    openMenu();
    fireEvent.click(screen.getByText("Activate"));

    expect(plans.activate.mutate).toHaveBeenCalledWith("plan-1");
    expect(plans.archive.mutate).not.toHaveBeenCalled();
  });

  it("resumes a paused plan directly from the menu", () => {
    const plans = makePlanPlans({ plans: [planFixture({ status: "PAUSED" })] });
    renderPage(plans);

    openMenu();
    fireEvent.click(screen.getByText("Resume Plan"));

    expect(plans.resume.mutate).toHaveBeenCalledWith("plan-1");
    expect(plans.archive.mutate).not.toHaveBeenCalled();
  });
});
