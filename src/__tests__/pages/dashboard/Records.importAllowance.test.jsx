import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Records from "../../../pages/dashboard/Records";
import { getCommunityRecords } from "../../../api/communityRecords";
import { getRecordImportUsage } from "../../../api/communityAiUsage";
import { getMe } from "../../../api/members";
import { useRecordBookAccess } from "../../../hooks/useRecordBookAccess";
import { useCommunityMembers } from "../../../hooks/useCommunityMembers";

// The Records screen carries the community's spreadsheet-import allowance, so
// an admin can see what is left before starting an import. The Imports screen
// shows the same notice; this one puts it next to the Import button.
//
// The screen's own machinery — the record list, the filters, the member roster
// behind the filters — is mocked at the module boundary. What is under test
// here is the notice's placement, the community it is read for, and the
// permission that gates it.

vi.mock("../../../hooks/useRecordBookAccess", () => ({ useRecordBookAccess: vi.fn() }));
vi.mock("../../../hooks/useCommunityMembers", () => ({ useCommunityMembers: vi.fn() }));
vi.mock("../../../hooks/usePageTitle", () => ({ usePageTitle: () => {} }));
vi.mock("../../../api/communityRecords", () => ({
  getCommunityRecords: vi.fn(),
  getCommunityRecord: vi.fn(),
  createCommunityRecord: vi.fn(),
  updateCommunityRecord: vi.fn(),
  deleteCommunityRecord: vi.fn(),
}));
vi.mock("../../../api/communityAiUsage", () => ({ getRecordImportUsage: vi.fn() }));
vi.mock("../../../api/members", async (importOriginal) => ({
  ...(await importOriginal()),
  getMe: vi.fn(),
}));

const COMMUNITY = { id: "comm-1", slug: "alumni", name: "Alumni", defaultCurrency: "NGN" };

function access(overrides = {}) {
  return {
    community: COMMUNITY,
    id: COMMUNITY.id,
    identifier: COMMUNITY.slug,
    loading: false,
    error: null,
    read: true,
    create: true,
    update: true,
    delete: true,
    import: true,
    usage: true,
    ...overrides,
  };
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard/records?community=alumni"]}>
        <Records />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useCommunityMembers.mockReturnValue({ members: [], isLoading: false, isError: false });
  getCommunityRecords.mockResolvedValue({
    data: { data: { content: [], totalElements: 0, totalPages: 1 } },
  });
  getMe.mockResolvedValue({ data: { data: { timezone: "America/New_York" } } });
  getRecordImportUsage.mockResolvedValue({
    data: { data: { mode: "UNLIMITED", remainingUnits: null } },
  });
});

afterEach(cleanup);

describe("Records screen import allowance", () => {
  it("shows the community's import allowance", async () => {
    useRecordBookAccess.mockReturnValue(access());
    mount();

    expect(await screen.findByText(/Unlimited AI imports/)).toBeTruthy();
    // Read for the canonical community UUID, not the slug in the URL.
    expect(getRecordImportUsage).toHaveBeenCalledWith("comm-1");
  });

  it("says nothing when the role may not read usage at all", async () => {
    useRecordBookAccess.mockReturnValue(access({ usage: false }));
    mount();

    await waitFor(() => expect(getCommunityRecords).toHaveBeenCalled());
    expect(screen.queryByText(/AI imports/)).toBeNull();
    expect(screen.queryByRole("button", { name: "View AI usage" })).toBeNull();
    // Not even fetched: a role that cannot read usage has no business
    // requesting it.
    expect(getRecordImportUsage).not.toHaveBeenCalled();
  });
});
