import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import JoinRequests from "../../../pages/dashboard/JoinRequests";
import { useJoinRequests } from "../../../hooks/useJoinRequests";
import { useActiveCommunityId } from "../../../hooks/useActiveCommunityId";

// Approving/rejecting a join request is Tier 1 in the test-coverage
// scoping plan: it directly changes community membership. Note that error
// display for a failed approve/reject is deliberately NOT tested here --
// JoinRequests.jsx relies on a global mutation-cache error handler to toast
// the reason (per its own code comment), so that behavior belongs to a
// test of the query-client config itself, not this component. What this
// component does own -- and what's tested here -- is calling the mutation
// with the correct request id, keeping other rows interactive while one
// row is busy, and correctly separating pending vs. already-processed
// requests.

vi.mock("../../../hooks/useJoinRequests", async () => {
  const actual = await vi.importActual("../../../hooks/useJoinRequests");
  return { ...actual, useJoinRequests: vi.fn() };
});
vi.mock("../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(),
}));

function pendingRequest(overrides = {}) {
  return {
    id: "req-1",
    status: "PENDING",
    requestedUser: { firstName: "Amina", lastName: "Bello", email: "amina@example.com" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

let approve;
let reject;

beforeEach(() => {
  useActiveCommunityId.mockReturnValue("comm-1");
  approve = vi.fn().mockResolvedValue({});
  reject = vi.fn().mockResolvedValue({});
});

function mockRequests(requests) {
  useJoinRequests.mockReturnValue({
    requests,
    isLoading: false,
    error: null,
    approve,
    reject,
    isMutating: false,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <JoinRequests />
    </MemoryRouter>,
  );
}

describe("JoinRequests approve/reject flow", () => {
  it("calls approve with the correct request id", async () => {
    mockRequests([pendingRequest({ id: "req-42" })]);
    renderPage();

    (await screen.findByText("Approve")).click();

    await waitFor(() => expect(approve).toHaveBeenCalledWith("req-42"));
    expect(reject).not.toHaveBeenCalled();
  });

  it("calls reject with the correct request id", async () => {
    mockRequests([pendingRequest({ id: "req-42" })]);
    renderPage();

    (await screen.findByText("Reject")).click();

    await waitFor(() => expect(reject).toHaveBeenCalledWith("req-42"));
    expect(approve).not.toHaveBeenCalled();
  });

  it("disables only the row being acted on, not every pending request", async () => {
    // A slow mutation on one row shouldn't block responding to a different
    // row -- this is the specific behavior the component's own comment
    // calls out ("so approving one request doesn't freeze the rest").
    let resolveFirst;
    approve.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockRequests([
      pendingRequest({ id: "req-1", requestedUser: { firstName: "Amina", lastName: "Bello" } }),
      pendingRequest({ id: "req-2", requestedUser: { firstName: "Chidi", lastName: "Okafor" } }),
    ]);
    renderPage();

    const approveButtons = await screen.findAllByText("Approve");
    approveButtons[0].click();

    await waitFor(() => {
      expect(approveButtons[0].disabled).toBe(true);
    });
    // The second row's Approve button must still be clickable while the
    // first row's mutation is in flight.
    expect(approveButtons[1].disabled).toBe(false);

    resolveFirst({});
  });

  it("shows Approve/Reject only for pending requests, and a status chip for processed ones", async () => {
    mockRequests([
      pendingRequest({ id: "req-1" }),
      pendingRequest({ id: "req-2", status: "APPROVED", reviewedAt: new Date().toISOString() }),
    ]);
    renderPage();

    await screen.findByText("Approve");
    await screen.findByText("Reject");
    await screen.findByText("Approved");

    // Only one actionable row -- the processed one shouldn't also render
    // action buttons.
    expect(screen.getAllByText("Approve")).toHaveLength(1);
  });

  it("separates pending and processed requests into their own sections", async () => {
    mockRequests([
      pendingRequest({ id: "req-1" }),
      pendingRequest({ id: "req-2", status: "REJECTED", reviewedAt: new Date().toISOString() }),
    ]);
    renderPage();

    await screen.findByText("Awaiting review");
    await screen.findByText("Recently processed");
  });

  it("shows the empty state and no request cards when there are no pending requests", async () => {
    mockRequests([]);
    renderPage();

    await screen.findByText("No pending join requests");
    expect(screen.queryByText("Approve")).toBeNull();
  });
});

// docs/design-system.md §2.1 confirm-pair conformance (sweep batch C3): the
// cancel/reject action is the transparent outline role, never a filled
// pill; the confirm action is primary. Classes are asserted literally --
// if the spec changes, the spec file changes first.
describe("JoinRequests — design system conformance", () => {
  it("Reject is outline-caution: transparent, danger label, black/10 border, 4px radius", async () => {
    mockRequests([pendingRequest()]);
    renderPage();

    const reject = (await screen.findByText("Reject")).closest("button");
    const cls = reject.className;
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("text-danger");
    expect(cls).toContain("border-black/10");
    expect(cls).toContain("rounded-g-1");
    expect(cls).not.toContain("bg-danger");
  });

  it("Approve is primary: brand fill, white label, 4px radius", async () => {
    mockRequests([pendingRequest()]);
    renderPage();

    const approve = (await screen.findByText("Approve")).closest("button");
    const cls = approve.className;
    expect(cls).toContain("bg-brand");
    expect(cls).toContain("text-white");
    expect(cls).toContain("rounded-g-1");
  });
});
