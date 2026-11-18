import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import PlanOverflowMenu from "../../../../pages/dashboard/payments/PlanOverflowMenu";

vi.mock("../../../../hooks/usePaymentPlanAccess", () => ({ usePaymentPlanAccess: vi.fn() }));
import { usePaymentPlanAccess } from "../../../../hooks/usePaymentPlanAccess";
beforeEach(() => usePaymentPlanAccess.mockReturnValue({ canDelete: true }));
afterEach(cleanup);

// planPlans only needs whichever mutation the rendered status path can
// reach -- these two (delete/expire) are what every status exercises here.
function makePlanPlans() {
  return {
    delete: { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null },
    expire: { mutate: vi.fn(), isPending: false },
    pause: { mutate: vi.fn(), isPending: false },
    resume: { mutate: vi.fn(), isPending: false },
    activate: { mutate: vi.fn(), isPending: false },
  };
}

function renderMenu(overrides = {}) {
  const plan = { id: "plan-1", name: "Monthly Dues", status: "ACTIVE", ...overrides };
  const planPlans = makePlanPlans();
  render(
    <PlanOverflowMenu
      plan={plan}
      planPlans={planPlans}
      onEdit={vi.fn()}
      onViewMembers={vi.fn()}
      onDuplicate={vi.fn()}
    />,
  );
  return { plan, planPlans };
}

function openMenu() {
  // The trigger is the only button rendered before the menu opens.
  fireEvent.click(screen.getByRole("button"));
}

describe("PlanOverflowMenu — Delete", () => {
  it("does not delete immediately -- clicking Delete only opens a confirmation", () => {
    const { planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();

    fireEvent.click(screen.getByText("Delete"));

    expect(planPlans.delete.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Delete Plan")).toBeTruthy();
    expect(screen.getByText(/permanently deletes this draft/i)).toBeTruthy();
  });

  it("deletes the plan only after the confirmation dialog is confirmed", () => {
    const { plan, planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();
    fireEvent.click(screen.getByText("Delete"));

    // Two "Delete"-labelled controls exist now: the confirm dialog's
    // button is the last one rendered.
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(planPlans.delete.mutate).toHaveBeenCalledTimes(1);
    expect(planPlans.delete.mutate).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("backing out of the confirmation via Cancel never deletes", () => {
    const { planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();
    fireEvent.click(screen.getByText("Delete"));

    fireEvent.click(screen.getByText("Cancel"));

    expect(planPlans.delete.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete Plan")).toBeNull();
  });

  it("is not offered once a plan is already deleted", () => {
    renderMenu({ status: "DELETED" });
    openMenu();

    expect(screen.queryByText("Delete")).toBeNull();
  });
});

describe("PlanOverflowMenu — End Plan", () => {
  it("requires confirmation before expiring an active plan", () => {
    const { planPlans } = renderMenu();
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "End Plan" }));
    expect(planPlans.expire.mutate).not.toHaveBeenCalled();

    // The dialog's title ("End Plan", an <h2>) and its confirm button share
    // the same text, so disambiguate by role rather than text alone.
    fireEvent.click(screen.getByRole("button", { name: "End Plan" }));
    expect(planPlans.expire.mutate).toHaveBeenCalledTimes(1);
  });
});

it.each(["ACTIVE", "PAUSED", "EXPIRED", "ACTIVATING", "ACTIVATION_FAILED", "DELETED"])(
  "does not offer deletion for %s",
  (status) => {
    renderMenu({ status });
    openMenu();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  },
);
it("requires the delete permission even for a draft", () => {
  usePaymentPlanAccess.mockReturnValue({ canDelete: false });
  renderMenu({ status: "DRAFT" });
  openMenu();
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
});
it("keeps the dialog open and explains a rejected deletion", () => {
  const { planPlans } = renderMenu({ status: "DRAFT" });
  planPlans.delete.error = {
    response: { status: 400, data: { description: "Draft has billing history" } },
  };
  openMenu();
  fireEvent.click(screen.getByText("Delete"));
  expect(screen.getByText("Draft has billing history")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Delete Plan" })).toBeTruthy();
});
