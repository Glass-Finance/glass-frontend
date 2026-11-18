import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Members from "../../../pages/dashboard/Members";
import { useActiveCommunityId } from "../../../hooks/useActiveCommunityId";
import { useCommunity } from "../../../hooks/useCommunity";
import { useMembersWithPayments } from "../../../hooks/useMembersWithPayments";
import { useCommunityMembers, useRoles } from "../../../hooks/useCommunityMembers";
import { useJoinRequests } from "../../../hooks/useJoinRequests";

// Member removal is the last Tier 1 item from the test-coverage scoping
// plan. Like payout-account removal, it's gated behind ConfirmDialog
// (src/components/dashboard/ConfirmDialog.jsx) rather than firing on a
// single click -- these tests pin that the trash/remove icon alone never
// triggers removal, only the explicit confirm does, and that a failed
// removal surfaces a real error rather than failing silently.

vi.mock("../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(),
}));
vi.mock("../../../hooks/useCommunity", () => ({
  useCommunity: vi.fn(),
}));
vi.mock("../../../hooks/useMembersWithPayments", () => ({
  useMembersWithPayments: vi.fn(),
}));
vi.mock("../../../hooks/useCommunityMembers", () => ({
  useCommunityMembers: vi.fn(),
  useRoles: vi.fn(),
}));
vi.mock("../../../hooks/useJoinRequests", async () => {
  const actual = await vi.importActual("../../../hooks/useJoinRequests");
  return { ...actual, useJoinRequests: vi.fn() };
});

// The page reads the account's KYC status so it can explain the 403 that a
// KYC-incomplete community admin gets from the members endpoint. useKycGate
// needs an AuthProvider (useAuth) and issues a live /kyc summary request, so
// it's stubbed here to the benign already-approved state. The gated-403
// behaviour itself is covered in Members.kycNotice.test.jsx.
vi.mock("../../../hooks/useKycGate", () => ({
  useKycGate: () => ({
    status: "APPROVED",
    isApproved: true,
    isLoading: false,
    isError: false,
    exempt: false,
  }),
}));

function member(overrides = {}) {
  return {
    id: "member-1",
    firstName: "Amina",
    lastName: "Bello",
    email: "amina@example.com",
    role: { name: "Community Member", code: "COMMUNITY_MEMBER" },
    status: "ACTIVE",
    billingExempt: false,
    planCount: 1,
    paidCount: 1,
    totalCount: 1,
    failedCount: 0,
    obligations: [],
    transactions: [],
    ...overrides,
  };
}

let removeMemberMutate;
let inviteMember;

beforeEach(() => {
  useActiveCommunityId.mockReturnValue("comm-1");
  useCommunity.mockReturnValue({
    data: { id: "comm-1", name: "Kings College Alumni", slug: "kca" },
  });
  useMembersWithPayments.mockReturnValue({
    members: [member()],
    obligations: [],
    transactions: [],
    isLoading: false,
    error: null,
  });

  removeMemberMutate = vi.fn();
  inviteMember = { mutateAsync: vi.fn(), isPending: false };
  useCommunityMembers.mockReturnValue({
    inviteMember,
    removeMember: { mutate: removeMemberMutate, isPending: false },
  });
  useRoles.mockReturnValue({ data: [{ id: "role-1", name: "Community Member" }] });

  useJoinRequests.mockReturnValue({
    requests: [],
    isLoading: false,
    error: null,
    approve: vi.fn(),
    reject: vi.fn(),
    isMutating: false,
  });
});

function renderPage() {
  // A QueryClientProvider is required now that the page reaches for
  // useQueryClient() (it invalidates the community queries when a KYC
  // verification completes). Nothing here queries, so a bare client is enough.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Members />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Members removal flow", () => {
  it("does not call removeMember.mutate just from clicking the remove icon", async () => {
    renderPage();

    (await screen.findByTitle("Remove member")).click();

    // Confirm dialog should now be open, showing the member's name in the
    // description, but nothing should have fired yet.
    await screen.findByText("Remove Member");
    expect(removeMemberMutate).not.toHaveBeenCalled();
  });

  it("calls removeMember.mutate with the correct member id only after confirming", async () => {
    renderPage();

    (await screen.findByTitle("Remove member")).click();
    (await screen.findByText("Remove")).click();

    await waitFor(() => expect(removeMemberMutate).toHaveBeenCalledTimes(1));
    expect(removeMemberMutate).toHaveBeenCalledWith(
      "member-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("clicking Cancel in the confirm dialog never calls removeMember.mutate", async () => {
    renderPage();

    (await screen.findByTitle("Remove member")).click();
    (await screen.findByText("Cancel")).click();

    await waitFor(() => expect(screen.queryByText("Remove Member")).toBeNull());
    expect(removeMemberMutate).not.toHaveBeenCalled();
  });

  it("does not render a remove control when there are no members", async () => {
    useMembersWithPayments.mockReturnValue({
      members: [],
      obligations: [],
      transactions: [],
      isLoading: false,
      error: null,
    });
    renderPage();

    await waitFor(() => expect(screen.queryByTitle("Remove member")).toBeNull());
  });
});

describe("Members payment statistics display", () => {
  it("shows the server obligation-plan count and paid/total status", async () => {
    useMembersWithPayments.mockReturnValue({
      members: [member({ planCount: 5, paidCount: 3, totalCount: 5 })],
      obligations: [],
      isLoading: false,
      error: null,
    });
    renderPage();
    const status = await screen.findByText("3/5 Paid");
    expect(status.closest("tr").children[2].textContent).toBe("5");
  });

  it("shows 0/0 Paid for explicit zero counts on a billing-exempt member", async () => {
    useMembersWithPayments.mockReturnValue({
      members: [member({ billingExempt: true, planCount: 0, paidCount: 0, totalCount: 0 })],
      obligations: [],
      isLoading: false,
      error: null,
    });
    renderPage();
    const status = await screen.findByText("0/0 Paid");
    expect(status.closest("tr").children[2].textContent).toBe("0");
  });

  it("shows unavailable counts without presenting missing stats as paid or zero", async () => {
    useMembersWithPayments.mockReturnValue({
      members: [member({ planCount: null, paidCount: null, totalCount: null })],
      obligations: [],
      isLoading: false,
      error: null,
    });
    renderPage();
    const row = (await screen.findByText("Amina Bello")).closest("tr");
    expect(row.children[2].textContent).toBe("—");
    expect(row.children[3].textContent).toBe("—");
    expect(screen.queryByText("0/0 Paid")).toBeNull();
  });
});
