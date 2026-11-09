import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreatePlanModal from "../../../../pages/dashboard/payments/CreatePlanModal";

// CreatePlanModal is the first (and only) entry point for creating a payment
// plan -- it builds the entire create payload in handleSubmit. These tests pin
// the navigation (wizard steps), client-side validation gate, and the exact
// payload shape for recurring vs one-time plans so a contract regression here
// can't ship silently.

vi.mock("../../../../hooks/useSlug", async () => {
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

vi.mock("../../../../hooks/useCommunityAccount", () => ({
  useCommunityAccount: () => ({ accounts: [], account: null, isLoading: false }),
}));

// AudienceMemberPicker owns the members query (it only mounts for a
// SELECTED_MEMBERS audience), so this is the seam the picker reads.
const MEMBERS = [
  { id: "member-a", firstName: "ada", lastName: "Obi", email: "ada@example.test" },
  { id: "member-b", firstName: "bayo", lastName: "Ade", email: "bayo@example.test" },
  { id: "member-c", firstName: "chioma", lastName: "Eze", email: "chioma@example.test" },
];
vi.mock("../../../../hooks/useCommunityMembers", () => ({
  useCommunityMembers: () => ({ members: MEMBERS, isLoading: false, error: null }),
}));

// AudienceGroupPicker owns the groups query the same way, so this is its seam.
// Mocked as a spy so a test can assert the groups list is NOT fetched for an
// audience that doesn't need it.
const GROUPS = [
  { id: "group-a", name: "Board", status: "ACTIVE" },
  { id: "group-b", name: "Choir", status: "ACTIVE" },
];
const useCommunityGroupsMock = vi.fn(() => ({
  data: { content: GROUPS },
  isLoading: false,
  error: null,
}));
vi.mock("../../../../hooks/useGroups", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useCommunityGroups: (...args) => useCommunityGroupsMock(...args) };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCommunityGroupsMock.mockClear();
});

function renderModal(overrides = {}) {
  const props = {
    communityId: "comm-1",
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(true),
    creating: false,
    createError: null,
    ...overrides,
  };
  render(<CreatePlanModal {...props} />);
  return props;
}

function goToDetails() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function fillRecurringDetails({
  name = "Monthly Dues",
  amount = "5000",
  slug = "monthly-dues",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("Enter plan name"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText("₦0.00"), { target: { value: amount } });
  fireEvent.change(screen.getByDisplayValue("Select frequency"), {
    target: { value: "MONTHLY" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g. alumni-dues-2026"), {
    target: { value: slug },
  });
}

// The footer's left button reads "Cancel" only at step 1 — from step 2 on
// it reads "Back" — and the primary action sits next to it in the same row.
function footerButton(label) {
  const anchor = screen.getByRole("button", { name: /^(Cancel|Back)$/ });
  // closest("div"), not parentElement: Back sits in a phone-hiding wrapper
  // span inside the footer row.
  return [...anchor.closest("div").querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
}

function submitStepTwo() {
  fireEvent.click(footerButton("Continue"));
}

function submitCreate() {
  const create = footerButton("Create Plan");
  fireEvent.click(create);
  return create;
}

describe("CreatePlanModal — navigation", () => {
  it("advances from plan type to plan details", () => {
    renderModal();
    expect(screen.getByText("Choose the type of plan you want to create")).toBeTruthy();

    goToDetails();

    expect(screen.getByPlaceholderText("Enter plan name")).toBeTruthy();
    expect(screen.getByPlaceholderText("₦0.00")).toBeTruthy();
  });

  it("Cancel at step 1 closes without creating", () => {
    const { onClose, onCreate } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("Back at step 2 returns to step 1 instead of closing", () => {
    const { onClose } = renderModal();
    goToDetails();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Choose the type of plan you want to create")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CreatePlanModal — validation", () => {
  it("rejects a whitespace-only plan name and stays on the details step", () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails({ name: "   " });

    submitStepTwo();

    expect(screen.getByText("Plan name is required.")).toBeTruthy();
    // Still on step 2 — the details inputs remain visible.
    expect(screen.getByPlaceholderText("Enter plan name")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("blocks Continue when the amount is zero and shows the field error on blur", () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails({ amount: "0" });

    expect(footerButton("Continue").disabled).toBe(true);

    fireEvent.blur(screen.getByPlaceholderText("₦0.00"));

    expect(screen.getByText("Enter an amount greater than 0.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("blocks Continue when the suggested slug is already taken", () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails({ slug: "taken" });

    expect(footerButton("Continue").disabled).toBe(true);
    expect(screen.getByText("That URL is taken — try another.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("CreatePlanModal — payload", () => {
  it("submits the recurring-plan contract and flashes success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { onCreate, onClose } = renderModal();
    goToDetails();
    fillRecurringDetails();
    submitStepTwo();

    submitCreate();

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Monthly Dues",
      amount: 5000,
      paymentType: "RECURRING",
      slug: "monthly-dues",
      audience: "ALL_MEMBERS",
      visibility: "PUBLIC",
      amountMode: "FIXED",
      activateImmediately: true,
      reminderFrequency: "EVERY_3_DAYS",
      reminderChannels: ["IN_APP"],
    });
    expect(payload.recurringPlan).toMatchObject({
      frequency: "MONTHLY",
      interval: 1,
      retryPolicy: "NO_RETRY",
      graceDays: 0,
    });
    expect(payload.recurringPlan.startAt).toEqual(expect.any(String));
    expect(payload.description).toBeUndefined();
    expect(payload.communityAccountId).toBeUndefined();

    // Success stage (onCreate resolved true).
    expect(await screen.findByText("Plan Created!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it("submits the one-time contract with dueAt and no recurringPlan", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { onCreate } = renderModal();
    // Choose the one-time plan type on step 1 before advancing.
    fireEvent.click(screen.getByText("One Time"));
    goToDetails();
    fireEvent.change(screen.getByPlaceholderText("Enter plan name"), {
      target: { value: "Event Fee" },
    });
    fireEvent.change(screen.getByPlaceholderText("₦0.00"), { target: { value: "2000" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. alumni-dues-2026"), {
      target: { value: "event-fee" },
    });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: "2026-12-31" },
    });

    submitStepTwo();
    const create = submitCreate();

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0];
    expect(payload.paymentType).toBe("ONE_TIME");
    expect(payload.dueAt).toEqual(expect.any(String));
    expect(payload.recurringPlan).toBeUndefined();
    expect(payload.startAt).toBeUndefined();
    expect(payload.reminderFrequency).toBe("EVERY_3_DAYS");
    expect(payload.reminderChannels).toEqual(["IN_APP"]);
    expect(create).toBeTruthy();

    expect(await screen.findByText("Plan Created!")).toBeTruthy();
  });

  it("saves reminders as DISABLED when the reminder toggle is off", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    fireEvent.click(screen.getByLabelText("Send automatic reminders to unpaid members"));
    submitStepTwo();

    submitCreate();

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0];
    expect(payload.reminderFrequency).toBe("DISABLED");
    expect(payload.reminderChannels).toBeUndefined();
    expect(await screen.findByText("Plan Created!")).toBeTruthy();
  });
});

// ── amountMode / visibility / audience ───────────────────────────────────────
// The create payload used to hardcode audience:ALL_MEMBERS, visibility:PUBLIC
// and amountMode:FIXED even though the endpoint has always accepted the full
// enums. These pin the wizard's real choices, and — more importantly — the two
// backend rules that make a naive selector fail: RECURRING accepts FIXED only,
// and a SELECTED_MEMBERS audience with nobody selected is silently accepted on
// create (the PATCH path rejects it, create does not).
function startOneTime() {
  fireEvent.click(screen.getByText("One Time"));
  goToDetails();
}

function fillOneTimeDetails({ name = "Event Fee", amount = "2000", slug = "event-fee" } = {}) {
  fireEvent.change(screen.getByPlaceholderText("Enter plan name"), { target: { value: name } });
  if (amount !== null) {
    fireEvent.change(screen.getByPlaceholderText("₦0.00"), { target: { value: amount } });
  }
  fireEvent.change(screen.getByPlaceholderText("e.g. alumni-dues-2026"), {
    target: { value: slug },
  });
  const dates = document.querySelectorAll('input[type="date"]');
  fireEvent.change(dates[dates.length - 1], { target: { value: "2026-12-31" } });
}

function setSelect(testId, value) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

function createPayload(onCreate) {
  return onCreate.mock.calls[0][0];
}

describe("CreatePlanModal — amountMode", () => {
  it("offers only FIXED for a recurring plan and explains why", () => {
    renderModal();
    goToDetails();

    const mode = screen.getByTestId("amount-mode");
    expect([...mode.options].map((o) => o.value)).toEqual(["FIXED"]);
    expect(screen.getByText("Recurring plans always bill a fixed amount.")).toBeTruthy();
  });

  it("offers all four modes for a one-time plan", () => {
    renderModal();
    startOneTime();

    expect([...screen.getByTestId("amount-mode").options].map((o) => o.value)).toEqual([
      "FIXED",
      "MINIMUM",
      "SUGGESTED",
      "VARIABLE",
    ]);
  });

  it("submits MINIMUM and SUGGESTED as sent, not as FIXED", async () => {
    for (const mode of ["MINIMUM", "SUGGESTED"]) {
      const { onCreate } = renderModal();
      startOneTime();
      fillOneTimeDetails();
      setSelect("amount-mode", mode);
      submitStepTwo();
      submitCreate();

      expect(createPayload(onCreate)).toMatchObject({ amountMode: mode, amount: 2000 });
      await screen.findByText("Plan Created!");
      cleanup();
    }
  });

  it("makes the amount optional for VARIABLE and sends 0 when it is left blank", async () => {
    const { onCreate } = renderModal();
    startOneTime();
    setSelect("amount-mode", "VARIABLE");
    fillOneTimeDetails({ amount: null });

    // The old gate was an unconditional Number(amount) > 0, which made a
    // VARIABLE plan impossible to create without inventing a figure.
    expect(footerButton("Continue").disabled).toBe(false);
    expect(screen.getByText("Leave blank and members pay any amount they choose.")).toBeTruthy();

    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).toMatchObject({
      paymentType: "ONE_TIME",
      amountMode: "VARIABLE",
      // VARIABLE + no figure is a real state: the service stores 0.
      amount: 0,
    });
    await screen.findByText("Plan Created!");
  });

  it("keeps a typed baseline when switching a VARIABLE plan's amount", async () => {
    const { onCreate } = renderModal();
    startOneTime();
    fillOneTimeDetails({ amount: "2500" });
    setSelect("amount-mode", "VARIABLE");
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).toMatchObject({ amountMode: "VARIABLE", amount: 2500 });
    await screen.findByText("Plan Created!");
  });

  it("clamps the payload back to FIXED if the plan type is switched after choosing VARIABLE", async () => {
    const { onCreate } = renderModal();
    startOneTime();
    setSelect("amount-mode", "VARIABLE");
    fillOneTimeDetails({ amount: null });
    // Back to step 1, then change the plan type — the stale VARIABLE choice
    // must not reach the payload, or the backend 400s on the whitelist.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByText("Recurring"));
    goToDetails();
    fillOneTimeDetails({ amount: "5000" });
    fireEvent.change(screen.getByDisplayValue("Select frequency"), {
      target: { value: "MONTHLY" },
    });
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).toMatchObject({
      paymentType: "RECURRING",
      amountMode: "FIXED",
    });
    await screen.findByText("Plan Created!");
  });
});

describe("CreatePlanModal — visibility", () => {
  it("submits the chosen visibility instead of always PUBLIC", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("visibility", "MEMBERS_ONLY");
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).toMatchObject({ visibility: "MEMBERS_ONLY" });
    await screen.findByText("Plan Created!");
  });

  it("defaults to PUBLIC when untouched", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).toMatchObject({ visibility: "PUBLIC" });
    await screen.findByText("Plan Created!");
  });
});

describe("CreatePlanModal — selected members", () => {
  it("hides the member picker for the default all-members audience", () => {
    renderModal();
    goToDetails();

    expect(screen.queryByText("Members", { selector: "label" })).toBeNull();
  });

  it("blocks Continue while the selection is empty and says why", () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "SELECTED_MEMBERS");

    // The reason is shown unprompted: Continue is disabled, so a message that
    // only appeared on click would never reach the user.
    expect(footerButton("Continue").disabled).toBe(true);
    expect(screen.getByText("Choose at least one member for this plan to bill.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("submits the selected member record ids, and drops them again on deselect", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "SELECTED_MEMBERS");

    fireEvent.click(screen.getByLabelText("Ada Obi"));
    fireEvent.click(screen.getByLabelText("Bayo Ade"));
    submitStepTwo();
    submitCreate();

    // member.id, not a user id — the backend resolves these against
    // community members and 400s on anything it can't find.
    expect(createPayload(onCreate)).toMatchObject({
      audience: "SELECTED_MEMBERS",
      memberIds: ["member-a", "member-b"],
    });
    await screen.findByText("Plan Created!");

    cleanup();

    renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "SELECTED_MEMBERS");
    fireEvent.click(screen.getByLabelText("Chioma Eze"));
    fireEvent.click(screen.getByLabelText("Chioma Eze"));
    expect(footerButton("Continue").disabled).toBe(true);
    expect(screen.getByText("Choose at least one member for this plan to bill.")).toBeTruthy();
  });

  it("omits memberIds entirely for an all-members plan", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).not.toHaveProperty("memberIds");
    await screen.findByText("Plan Created!");
  });

  it("shows the chosen terms on the review step", () => {
    renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("visibility", "PRIVATE");
    setSelect("audience", "SELECTED_MEMBERS");
    fireEvent.click(screen.getByLabelText("Ada Obi"));
    submitStepTwo();

    expect(screen.getByText("Specific members")).toBeTruthy();
    expect(screen.getByText("Plan audience only")).toBeTruthy();
    expect(screen.getByText("Members selected")).toBeTruthy();
  });
});

describe("CreatePlanModal — pending & error", () => {
  it("disables Create Plan and shows Creating… while a create is in flight", () => {
    const props = {
      communityId: "comm-1",
      onClose: vi.fn(),
      onCreate: vi.fn(),
      creating: false,
      createError: null,
    };
    const view = render(<CreatePlanModal {...props} />);
    goToDetails();
    fillRecurringDetails();
    submitStepTwo();

    // The parent flips `creating` once the mutation is dispatched.
    view.rerender(<CreatePlanModal {...props} creating />);

    const create = footerButton("Creating…");
    expect(create).toBeTruthy();
    expect(create.disabled).toBe(true);
  });

  it("surfaces the create error from the parent", () => {
    renderModal({ createError: "Something went wrong creating the plan." });
    expect(screen.getByText("Something went wrong creating the plan.")).toBeTruthy();
  });
});

describe("CreatePlanModal — GROUP audience", () => {
  it("offers a GROUP option alongside the member audiences", () => {
    renderModal();
    goToDetails();

    const select = screen.getByTestId("audience");
    const values = [...select.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("GROUP");
    expect(values).toContain("ALL_MEMBERS");
    expect(values).toContain("SELECTED_MEMBERS");
  });

  it("mounts the group picker for GROUP and not for the other audiences", () => {
    const { unmount } = render(
      <CreatePlanModal
        communityId="comm-1"
        onClose={vi.fn()}
        onCreate={vi.fn()}
        creating={false}
        createError={null}
      />,
    );
    goToDetails();

    // ALL_MEMBERS — no picker, and crucially no groups request.
    expect(screen.queryByText("Groups", { selector: "label" })).toBeNull();
    expect(useCommunityGroupsMock).not.toHaveBeenCalled();
    unmount();

    cleanup();
    renderModal();
    goToDetails();
    setSelect("audience", "GROUP");
    expect(screen.getByText("Groups", { selector: "label" })).toBeTruthy();
    expect(useCommunityGroupsMock).toHaveBeenCalled();
  });

  it("blocks Continue with no groups chosen and says why, unprompted", () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "GROUP");

    // Continue is disabled, so a submit-only message would never be seen.
    expect(footerButton("Continue").disabled).toBe(true);
    expect(screen.getByText("Choose at least one group for this plan to bill.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("submits the selected group record ids, and drops them again on deselect", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "GROUP");

    fireEvent.click(screen.getByLabelText("Board"));
    fireEvent.click(screen.getByLabelText("Choir"));
    submitStepTwo();
    submitCreate();

    // group.id, not a user id — the backend resolves these against community
    // groups and 400s on anything it can't find.
    expect(createPayload(onCreate)).toMatchObject({
      audience: "GROUP",
      groupIds: ["group-a", "group-b"],
    });
    await screen.findByText("Plan Created!");

    cleanup();
    renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "GROUP");
    fireEvent.click(screen.getByLabelText("Board"));
    fireEvent.click(screen.getByLabelText("Board"));
    expect(footerButton("Continue").disabled).toBe(true);
    expect(screen.getByText("Choose at least one group for this plan to bill.")).toBeTruthy();
  });

  it("never sends memberIds for a GROUP plan, even after a member selection", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();

    setSelect("audience", "SELECTED_MEMBERS");
    fireEvent.click(screen.getByLabelText("Ada Obi"));
    setSelect("audience", "GROUP");
    fireEvent.click(screen.getByLabelText("Board"));
    submitStepTwo();
    submitCreate();

    const payload = createPayload(onCreate);
    expect(payload.audience).toBe("GROUP");
    expect(payload.groupIds).toEqual(["group-a"]);
    // A member list here would imply an audience the plan doesn't have.
    expect(payload).not.toHaveProperty("memberIds");
  });

  it("clears the previous audience's ids when switching, so they can't come back", () => {
    renderModal();
    goToDetails();
    fillRecurringDetails();

    setSelect("audience", "SELECTED_MEMBERS");
    fireEvent.click(screen.getByLabelText("Ada Obi"));
    setSelect("audience", "GROUP");
    // Member list is gone: the member picker is unmounted...
    expect(screen.queryByLabelText("Ada Obi")).toBeNull();

    // ...and does not silently reappear if the admin switches back.
    setSelect("audience", "SELECTED_MEMBERS");
    expect(screen.getByLabelText("Ada Obi").closest("input").checked).toBe(false);
  });

  it("clears both lists when moving to ALL_MEMBERS", () => {
    renderModal();
    goToDetails();
    fillRecurringDetails();

    setSelect("audience", "GROUP");
    fireEvent.click(screen.getByLabelText("Board"));
    setSelect("audience", "ALL_MEMBERS");
    setSelect("audience", "GROUP");

    expect(screen.getByLabelText("Board").closest("input").checked).toBe(false);
  });

  it("omits groupIds entirely for an all-members plan", async () => {
    const { onCreate } = renderModal();
    goToDetails();
    fillRecurringDetails();
    submitStepTwo();
    submitCreate();

    expect(createPayload(onCreate)).not.toHaveProperty("groupIds");
  });

  it("names the group count in the review step rather than calling it all members", () => {
    renderModal();
    goToDetails();
    fillRecurringDetails();
    setSelect("audience", "GROUP");
    fireEvent.click(screen.getByLabelText("Board"));
    submitStepTwo();

    // The old optionLabel fallback would have rendered GROUP as "All members".
    expect(screen.getByText("Specific groups")).toBeTruthy();
    expect(screen.getByText("Groups selected")).toBeTruthy();
    expect(screen.queryByText("All members")).toBeNull();
  });
});
