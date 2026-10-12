import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Regression: the Communities Home empty state renders <Users>, but `Users` was
// never imported from lucide-react. Any user with zero communities -- the
// first-run state for every new member -- hit that branch and got
// `ReferenceError: Users is not defined` instead of the page.
//
// This file deliberately exercises that branch, which the KYC-chip suite
// (CommunitiesHome.kycChip.test.jsx) seeds a community to avoid. Keeping them
// separate means the chip assertions stay independent of the empty-state path.
//
// The assertion is behavioural, not a source-text search: React throws while
// rendering the missing icon, so re-introducing the defect fails this suite.

const { mockAuth, mockKycGate, mockFlags, mockKycVerification } = vi.hoisted(() => ({
  mockAuth: { current: {} },
  mockKycGate: { current: {} },
  mockFlags: { current: { kycDisabled: false } },
  mockKycVerification: { current: null },
}));

vi.mock("../../../store/AuthContext", () => ({ useAuth: () => mockAuth.current }));
vi.mock("../../../hooks/useKycGate", () => ({ useKycGate: () => mockKycGate.current }));
vi.mock("../../../lib/flags", () => ({ kycDisabled: () => mockFlags.current.kycDisabled }));
vi.mock("../../../hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("../../../hooks/useKycVerification", () => ({
  useKycVerification: () => mockKycVerification.current,
}));

// No cards render in the empty state, but stubbing the module keeps the
// harness independent of CommunitiesHomeSections' internals.
vi.mock("../../../pages/dashboard/CommunitiesHomeSections", () => ({
  CommunityCard: ({ community }) => <div>community:{community.id}</div>,
}));

vi.mock("../../../hooks/useCommunities", () => ({
  // The state under test: a brand-new member with no communities.
  useCommunitiesWithMetrics: () => ({ data: { communities: [] }, isLoading: false, error: null }),
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
vi.mock("../../../hooks/useCommunityMap", () => ({ useCommunityMap: () => ({}) }));

import CommunitiesHome from "../../../pages/dashboard/CommunitiesHome";

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

describe("CommunitiesHome empty state (zero communities)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.current = { user: { firstName: "Adaeze" }, isPlatformAdmin: false };
    mockKycGate.current = {
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
    };
    mockFlags.current = { kycDisabled: false };
    mockKycVerification.current = {
      summary: { status: "NOT_STARTED", canStart: true, attemptsAllowed: true },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("renders the empty state instead of throwing on the missing Users icon", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("shows the empty-state heading", () => {
    renderPage();

    expect(screen.getByText("No communities yet")).toBeTruthy();
  });

  it("keeps the empty state's supporting copy", () => {
    renderPage();

    expect(screen.getByText("Create or join a community to get started.")).toBeTruthy();
  });

  it("still renders the page header and its call to action", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /your communities/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /join community/i })).toBeTruthy();
  });

  it("renders no community cards for an empty list", () => {
    renderPage();

    expect(screen.queryByText(/^community:/)).toBeNull();
  });
});
