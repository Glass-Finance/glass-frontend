import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The Communities Home KYC status chip, restored upstream in b07a2ec5.
//
// It is a passive status read-out on the screen where the create-a-community
// decision is made, so it deliberately shows EVERY state, approved included.
// What it must never do is lie: an unknown status is held back entirely rather
// than rendered as "Not started", platform staff are exempt (they cannot start
// a personal attempt, per docs/kyc.md), and the kill switch hides it.
//
// Those are the guards that matter, and each one is a way for the UI to mislead
// a real user, so each is pinned here as observable rendering rather than a
// source-text search: if the chip appears when it should not, or vanishes when
// it should, a test fails.
//
// The wizard is the REAL KycWizardModal (mocked only at its data hook, matching
// Groups.kycNotice.test.jsx), so "the trigger opens the wizard" means the
// shipped dialog actually opens.

const { mockAuth, mockKycGate, mockFlags, mockKycVerification } = vi.hoisted(() => ({
  mockAuth: { current: {} },
  mockKycGate: { current: {} },
  mockFlags: { current: { kycDisabled: false } },
  mockKycVerification: { current: null },
}));

vi.mock("../../../store/AuthContext", () => ({
  useAuth: () => mockAuth.current,
}));

vi.mock("../../../hooks/useKycGate", () => ({
  useKycGate: () => mockKycGate.current,
}));

vi.mock("../../../lib/flags", () => ({
  kycDisabled: () => mockFlags.current.kycDisabled,
}));

vi.mock("../../../hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));

// The wizard's own data layer. Mirrors KycWizardModal.test.jsx and
// Groups.kycNotice.test.jsx: the modal stays real, only its hook is faked.
vi.mock("../../../hooks/useKycVerification", () => ({
  useKycVerification: () => mockKycVerification.current,
}));

// Page-level data hooks. The chip lives in the header, so the community list
// itself is irrelevant here.
//
// NOTE: one community is returned deliberately, with the card stubbed. With an
// empty list the page renders its "No communities yet" empty state, which
// references a lucide `Users` icon that CommunitiesHome.jsx never imports --
// that throws `ReferenceError: Users is not defined`. That is a pre-existing
// defect on `main` (introduced in d2c5965e, present in origin/main), NOT
// something these tests introduce or may fix here; it is reported separately.
// Seeding one community keeps every assertion below about the chip.
vi.mock("../../../pages/dashboard/CommunitiesHomeSections", () => ({
  CommunityCard: ({ community }) => <div>community:{community.id}</div>,
}));

vi.mock("../../../hooks/useCommunities", () => ({
  useCommunitiesWithMetrics: () => ({
    data: { communities: [{ id: "c1", name: "Kings College Alumni" }] },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../../../hooks/useInvites", () => ({
  useInvites: () => ({
    invites: [],
    isLoading: false,
    accept: vi.fn(),
    reject: vi.fn(),
    isAccepting: false,
    isRejecting: false,
  }),
}));
vi.mock("../../../hooks/usePayments", () => ({
  useGlobalOverview: () => ({ upcoming: [], recentActivity: [], isLoading: false }),
}));
vi.mock("../../../hooks/useNotifications", () => ({
  useAllNotifications: () => ({ notifications: [], unreadCount: 0 }),
}));
vi.mock("../../../hooks/useCommunityMap", () => ({
  useCommunityMap: () => ({}),
}));

import CommunitiesHome from "../../../pages/dashboard/CommunitiesHome";

/** The gate shape CommunitiesHome reads: status plus the two "unknown" flags. */
function gate(overrides = {}) {
  return {
    gateOpen: false,
    closeGate: vi.fn(),
    completeGate: vi.fn(),
    openGate: vi.fn(),
    enforce: vi.fn(() => true),
    isApproved: false,
    status: "NOT_STARTED",
    isLoading: false,
    isError: false,
    exempt: false,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <CommunitiesHome />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The chip's trigger is identified by its accessible name, which is the only
// handle a screen-reader user has on it.
const chip = () => screen.queryByRole("button", { name: /identity verification status/i });
const wizard = () => screen.queryByRole("dialog", { name: /identity verification/i });

describe("CommunitiesHome KYC status chip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.current = { user: { firstName: "Adaeze" }, isPlatformAdmin: false };
    mockKycGate.current = gate();
    mockFlags.current = { kycDisabled: false };
    mockKycVerification.current = {
      summary: { status: "NOT_STARTED", canStart: true, attemptsAllowed: true },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("shows the chip once the status has settled", () => {
    renderPage();

    expect(chip()).toBeTruthy();
    // NOT_STARTED is the label the shared status map renders.
    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("still shows the chip for an approved status", () => {
    // This is the screen where the create-a-community decision is made, so a
    // settled APPROVED is a result worth reading, not something to hide.
    mockKycGate.current = gate({ status: "APPROVED", isApproved: true });
    renderPage();

    expect(chip()).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
  });

  it("falls back to 'Not started' when a settled summary carries no status", () => {
    // A settled summary with no KYC record is genuinely "not started" -- this
    // is the documented fallback, not an unknown status wearing its clothes.
    mockKycGate.current = gate({ status: null });
    renderPage();

    expect(chip()).toBeTruthy();
    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("hides the chip under the KYC kill switch", () => {
    mockFlags.current = { kycDisabled: true };
    renderPage();

    expect(chip()).toBeNull();
    // The page itself still renders -- the switch hides KYC, not Communities.
    expect(screen.getByRole("heading", { name: /your communities/i })).toBeTruthy();
  });

  it("hides the chip while the KYC status is still loading", () => {
    // "Still loading" must never read as "Not started".
    mockKycGate.current = gate({ isLoading: true });
    renderPage();

    expect(chip()).toBeNull();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  it("hides the chip when the KYC status could not be retrieved", () => {
    // A failed summary must not masquerade as a definite status.
    mockKycGate.current = gate({ isError: true });
    renderPage();

    expect(chip()).toBeNull();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  it("never shows the chip to a platform administrator", () => {
    // Platform staff are backend-exempt and cannot start a personal attempt,
    // so the screen redirects them away entirely.
    mockAuth.current = { user: { firstName: "Adaeze" }, isPlatformAdmin: true };
    renderPage();

    expect(chip()).toBeNull();
    expect(screen.queryByRole("heading", { name: /your communities/i })).toBeNull();
  });

  it("keeps an accessible name on the trigger and opens the wizard", async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = chip();
    expect(trigger).toBeTruthy();
    expect(wizard()).toBeNull();

    await user.click(trigger);

    await waitFor(() => expect(wizard()).toBeTruthy());
  });

  it("leaves the wizard closed until the trigger is used", () => {
    renderPage();

    expect(chip()).toBeTruthy();
    expect(wizard()).toBeNull();
  });
});
