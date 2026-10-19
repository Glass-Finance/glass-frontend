import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CommunityProfile from "../../../../../pages/dashboard/settings/community/CommunityProfile";
import { useCommunity, useUpdateCommunity } from "../../../../../hooks/useCommunity";
import { useFileUpload } from "../../../../../hooks/useFileUpload";

// The community profile page renders its form immediately and used to swap only
// the heading for the literal text "Loading…" while the query resolved, so on a
// cold visit the user saw a form whose name, logo and fields were all empty
// and then watched them fill in.
//
// These pin the fix: while loading the page is one busy skeleton region and
// none of the real form is reachable, and once the community resolves the form
// comes back with the real values.

vi.mock("../../../../../hooks/useCommunity", () => ({
  useCommunity: vi.fn(),
  useUpdateCommunity: vi.fn(),
}));
vi.mock("../../../../../hooks/useFileUpload", () => ({
  useFileUpload: vi.fn(),
}));
vi.mock("../../../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(() => "community-1"),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CommunityProfile />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CommunityProfile loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateCommunity.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useFileUpload.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it("shows a skeleton instead of an empty form while the community is loading", () => {
    useCommunity.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderPage();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    // The real form must be absent entirely -- an empty form under a skeleton
    // is the exact flash this change removes.
    expect(screen.queryByText("Community Information")).toBeNull();
    expect(screen.queryByText("Delete Community")).toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("hides the skeleton and shows the form once the community has resolved", () => {
    useCommunity.mockReturnValue({
      // `owned` gates the destructive Delete Community card, so the mock needs
      // it for that card to render at all.
      data: {
        id: "community-1",
        name: "Kings College Alumni",
        slug: "kings-college",
        owned: true,
      },
      isLoading: false,
    });
    const { container } = renderPage();

    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText("Community Information")).toBeTruthy();
    expect(screen.getByText("Delete Community")).toBeTruthy();
    // The real community name, not the "Community" fallback it used to show.
    expect(screen.getByText("Kings College Alumni")).toBeTruthy();
  });
});
