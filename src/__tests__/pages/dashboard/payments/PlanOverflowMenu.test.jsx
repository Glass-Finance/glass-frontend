import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import PlanOverflowMenu from "../../../../pages/dashboard/payments/PlanOverflowMenu";

afterEach(cleanup);

// planPlans only needs whichever mutation the rendered status path can
// reach -- deleteDraft/expire are what the destructive paths exercise here.
function makePlanPlans() {
  return {
    deleteDraft: { mutate: vi.fn(), isPending: false },
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

// glass-backend #120 replaced archive with a draft-only, permanent DELETE.
describe("PlanOverflowMenu — Delete Draft", () => {
  it("does not delete immediately -- clicking Delete Draft only opens a confirmation", () => {
    const { planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Delete Draft" }));

    expect(planPlans.deleteDraft.mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/permanently deletes the draft/i)).toBeTruthy();
  });

  it("deletes the draft only after the confirmation dialog is confirmed", () => {
    const { plan, planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Delete Draft" }));

    // The dialog's title and its confirm button share the label; the
    // confirm button is the only *button* named that once the menu closed.
    fireEvent.click(screen.getByRole("button", { name: "Delete Draft" }));

    expect(planPlans.deleteDraft.mutate).toHaveBeenCalledTimes(1);
    expect(planPlans.deleteDraft.mutate).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("backing out of the confirmation via Cancel never deletes", () => {
    const { planPlans } = renderMenu({ status: "DRAFT" });
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Delete Draft" }));

    fireEvent.click(screen.getByText("Cancel"));

    expect(planPlans.deleteDraft.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText(/permanently deletes the draft/i)).toBeNull();
  });

  it.each(["ACTIVE", "PAUSED", "EXPIRED", "DELETED"])(
    "is not offered on a %s plan -- the backend only deletes drafts",
    (status) => {
      renderMenu({ status });
      openMenu();

      expect(screen.queryByRole("button", { name: "Delete Draft" })).toBeNull();
      expect(screen.queryByText("Archive")).toBeNull();
    },
  );
});

describe("PlanOverflowMenu — deleted plans", () => {
  it("offers neither Edit nor Duplicate on a DELETED plan (the backend rejects updates)", () => {
    renderMenu({ status: "DELETED" });
    openMenu();

    expect(screen.queryByRole("button", { name: "Edit Plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();
    // Read-only actions stay available.
    expect(screen.getByRole("button", { name: "View Members" })).toBeTruthy();
  });

  it("still offers Duplicate on an expired plan -- End Plan's own copy points there", () => {
    renderMenu({ status: "EXPIRED" });
    openMenu();

    expect(screen.getByRole("button", { name: "Duplicate" })).toBeTruthy();
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
