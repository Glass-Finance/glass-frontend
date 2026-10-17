import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanMembersModal from "../../../../pages/dashboard/payments/PlanMembersModal";
import { getPaymentLinkMembers } from "../../../../api/payments";
import { getCommunityObligations } from "../../../../api/transactions";
import { waiveObligation } from "../../../../api/communities";
import { useCommunityGroups } from "../../../../hooks/useGroups";
import { toastSuccess, toastWarning, toastInfo } from "../../../../utils/toast";

// PlanMembersModal owns the group-scoped waive flow: rows come from the
// payment-link members endpoint (server-side groupId filter), the actual
// obligation ids are resolved from the community obligations list, and each
// matching unpaid obligation gets one PATCH to the waive endpoint. These tests
// pin exactly that chain — selection → id resolution → per-obligation calls →
// result reporting — because a regression here silently waives (or fails to
// waive) real money owed.

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../../../utils/toast", () => ({
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastInfo: vi.fn(),
  toastProgress: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../../../api/payments", () => ({ getPaymentLinkMembers: vi.fn() }));
vi.mock("../../../../api/transactions", () => ({ getCommunityObligations: vi.fn() }));
vi.mock("../../../../api/communities", () => ({ waiveObligation: vi.fn() }));
vi.mock("../../../../api/exports", () => ({ exportCommunityObligations: vi.fn() }));

vi.mock("../../../../hooks/useGroups", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useCommunityGroups: vi.fn() };
});

const PLAN = { id: "plan-1", name: "certificate 1" };

const ROWS = [
  {
    memberId: "m1",
    firstName: "ada",
    lastName: "Obi",
    email: "ada@example.test",
    obligationStatus: "DUE",
    amountPaid: 0,
    totalAmountDue: 5000,
    joinedAt: "2026-01-05",
  },
  {
    memberId: "m2",
    firstName: "bayo",
    lastName: "Ade",
    email: "bayo@example.test",
    obligationStatus: "DUE",
    amountPaid: 0,
    totalAmountDue: 5000,
    joinedAt: "2026-01-06",
  },
  {
    memberId: "m3",
    firstName: "chioma",
    lastName: "Eze",
    email: "chioma@example.test",
    obligationStatus: "PAID",
    amountPaid: 5000,
    totalAmountDue: 5000,
    joinedAt: "2026-01-07",
  },
];

const OBLIGATIONS = [
  { id: "ob-1", status: "DUE", member: { id: "m1" }, paymentLink: { id: "plan-1" } },
  { id: "ob-1b", status: "WAIVED", member: { id: "m1" }, paymentLink: { id: "plan-1" } },
  { id: "ob-2", status: "DUE", member: { id: "m2" }, paymentLink: { id: "plan-1" } },
  { id: "ob-3", status: "PAID", member: { id: "m3" }, paymentLink: { id: "plan-1" } },
];

const GROUPS = [
  { id: "group-1", name: "Certificate 1", status: "ACTIVE" },
  { id: "group-2", name: "Old Cohort", status: "ARCHIVED" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPaymentLinkMembers).mockResolvedValue({ data: { data: ROWS } });
  vi.mocked(getCommunityObligations).mockResolvedValue({ data: { data: OBLIGATIONS } });
  vi.mocked(waiveObligation).mockResolvedValue({ data: { success: true } });
  vi.mocked(useCommunityGroups).mockReturnValue({ data: { content: GROUPS } });
});

afterEach(() => {
  cleanup();
});

function renderModal(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    plan: PLAN,
    communityId: "comm-1",
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <QueryClientProvider client={client}>
      <PlanMembersModal {...props} />
    </QueryClientProvider>,
  );
  return props;
}

async function renderLoaded() {
  const props = renderModal();
  await screen.findByText("Ada Obi");
  return props;
}

function rowCheckboxes() {
  // [0] is the header select-all; rows follow in render order.
  return screen.getAllByRole("checkbox");
}

async function openWaiveForSelected(rowIndex) {
  fireEvent.click(rowCheckboxes()[rowIndex]);
  const trigger = await screen.findByRole("button", { name: "Waive (1)" });
  fireEvent.click(trigger);
  await screen.findByText("Reason (optional)");
  return trigger;
}

describe("PlanMembersModal — group filter", () => {
  it("drops archived groups and refetches members with the selected groupId", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    const [, groupSelect] = screen.getAllByRole("combobox");
    const options = [...groupSelect.options].map((o) => o.textContent);
    expect(options).toEqual(["All groups", "Certificate 1"]);

    fireEvent.change(groupSelect, { target: { value: "group-1" } });

    await waitFor(() =>
      expect(getPaymentLinkMembers).toHaveBeenLastCalledWith("comm-1", "plan-1", {
        pageSize: 500,
        groupId: "group-1",
      }),
    );
    // First fetch (no group) had no groupId key at all.
    expect(getPaymentLinkMembers.mock.calls[0][2]).toEqual({ pageSize: 500 });
  });

  it("clears the selection when the group changes", async () => {
    await renderLoaded();
    fireEvent.click(rowCheckboxes()[1]);
    await screen.findByRole("button", { name: "Waive (1)" });

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    const [, groupSelect] = screen.getAllByRole("combobox");
    fireEvent.change(groupSelect, { target: { value: "group-1" } });

    // Rows re-render after the refetch, but the old selection must not
    // survive into the new row set.
    await screen.findByText("Ada Obi");
    expect(screen.queryByRole("button", { name: /Waive \(/ })).toBeNull();
    expect(screen.queryByText(/1 selected/)).toBeNull();
  });
});

describe("PlanMembersModal — waive", () => {
  it("waives only the selected members' unpaid obligations, with the reason", async () => {
    await renderLoaded();

    // Rows 1 and 2 are DUE (indexes 1..2 after the header checkbox); row 3 is
    // PAID and stays unchecked. ob-1b (WAIVED) and ob-3 (PAID) must be skipped.
    fireEvent.click(rowCheckboxes()[1]);
    fireEvent.click(rowCheckboxes()[2]);
    fireEvent.click(await screen.findByRole("button", { name: "Waive (2)" }));
    await screen.findByText("Reason (optional)");

    fireEvent.change(screen.getByPlaceholderText("e.g. Certificate fee waived for this cohort"), {
      target: { value: "Cohort fee waived" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Waive 2" }));

    await waitFor(() => expect(waiveObligation).toHaveBeenCalledTimes(2));
    expect(getCommunityObligations).toHaveBeenCalledWith("comm-1", {
      paymentLinkId: "plan-1",
      pageSize: 1000,
    });
    expect(waiveObligation).toHaveBeenCalledWith("comm-1", "ob-1", {
      reason: "Cohort fee waived",
    });
    expect(waiveObligation).toHaveBeenCalledWith("comm-1", "ob-2", {
      reason: "Cohort fee waived",
    });
    const waivedIds = waiveObligation.mock.calls.map((c) => c[1]);
    expect(waivedIds).not.toContain("ob-1b");
    expect(waivedIds).not.toContain("ob-3");

    expect(toastSuccess).toHaveBeenCalledWith("Waived 2 obligations");
    await waitFor(() => expect(screen.queryByText("Reason (optional)")).toBeNull());
    expect(screen.queryByRole("button", { name: /Waive \(/ })).toBeNull();
  });

  it("counts only waivable rows toward the trigger, even via select-all", async () => {
    await renderLoaded();
    fireEvent.click(rowCheckboxes()[0]); // selects all three rows incl. PAID
    // m1 + m2 are unpaid; m3 is PAID → two waivable.
    await screen.findByRole("button", { name: "Waive (2)" });
    expect(screen.queryByRole("button", { name: "Waive (3)" })).toBeNull();
    expect(screen.getByText(/3 selected/)).toBeTruthy();
  });

  it("reports nothing-to-waive when no unpaid obligation matches the selection", async () => {
    await renderLoaded();
    vi.mocked(getCommunityObligations).mockResolvedValue({ data: { data: [] } });

    await openWaiveForSelected(1);
    fireEvent.click(screen.getByRole("button", { name: "Waive 1" }));

    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
    expect(toastInfo.mock.calls[0][0]).toBe("Nothing to waive");
    expect(waiveObligation).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Reason (optional)")).toBeNull());
  });

  it("surfaces a full-batch failure through toast.error", async () => {
    await renderLoaded();
    vi.mocked(waiveObligation).mockRejectedValue(new Error("Waive failed"));

    await openWaiveForSelected(1);
    fireEvent.click(screen.getByRole("button", { name: "Waive 1" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(toastErrorMock.mock.calls[0][0]).toBe("Waive failed");
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Reason (optional)")).toBeNull());
  });

  it("reports partial failure as a warning with both counts", async () => {
    await renderLoaded();
    vi.mocked(waiveObligation)
      .mockResolvedValueOnce({ data: { success: true } })
      .mockRejectedValueOnce(new Error("boom"));

    fireEvent.click(rowCheckboxes()[1]);
    fireEvent.click(rowCheckboxes()[2]);
    fireEvent.click(await screen.findByRole("button", { name: "Waive (2)" }));
    await screen.findByText("Reason (optional)");
    fireEvent.click(screen.getByRole("button", { name: "Waive 2" }));

    await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(1));
    expect(toastWarning.mock.calls[0][0]).toBe("Some obligations could not be waived");
    expect(toastWarning.mock.calls[0][1].description).toBe("1 waived · 1 failed");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
