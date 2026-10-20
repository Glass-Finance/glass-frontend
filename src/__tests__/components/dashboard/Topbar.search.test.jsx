import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Topbar from "../../../components/dashboard/Topbar";

// The topbar search used to fetch inline: a debounced effect that called
// src/api/communities directly, kept the results in component state, and set
// an "open" flag when the response landed. It now goes through a React Query
// hook, and the panel's visibility is DERIVED (a dismissed-term marker plus
// whether the search has come back) rather than set in an effect.
//
// These tests pin that derived behaviour, because the old effect-based
// version had three separate places that could open the panel and one that
// closed it, and the derived version has to keep all four working.

const useAuth = vi.fn();
const useAllNotifications = vi.fn();
const useActiveCommunityId = vi.fn();
const useCommunities = vi.fn();
const useCommunitySearch = vi.fn();

vi.mock("../../../store/AuthContext", () => ({ useAuth: () => useAuth() }));
vi.mock("../../../hooks/useNotifications", () => ({
  useAllNotifications: () => useAllNotifications(),
}));
vi.mock("../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: () => useActiveCommunityId(),
}));
vi.mock("../../../hooks/useCommunities", () => ({
  useCommunities: () => useCommunities(),
}));
vi.mock("../../../hooks/useCommunitySearch", () => ({
  useCommunitySearch: () => useCommunitySearch(),
}));
vi.mock("../../../components/dashboard/NotificationsPanel", () => ({
  default: () => <div data-testid="notifications-panel" />,
}));

const RESULTS = {
  members: { content: [{ id: "m1", name: "Ada" }] },
  transactions: { content: [] },
  paymentLinks: { content: [] },
  settlements: { content: [] },
};

function renderTopbar() {
  return render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
}

async function typeSearch(value) {
  const input = screen.getByPlaceholderText(/search/i);
  await userEvent.type(input, value);
  // The debounce is 400ms; advance past it so the search term is published.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useActiveCommunityId.mockReturnValue("community-1");
  useCommunities.mockReturnValue({ data: { communities: [] } });
  useCommunitySearch.mockReturnValue({ results: null, searching: false, hasSearched: false });
  useAllNotifications.mockReturnValue({
    notifications: [],
    isLoading: false,
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
    isClearingAll: false,
  });
  useAuth.mockReturnValue({ user: { firstName: "Ada", lastName: "O" }, logout: vi.fn() });
});

describe("Topbar search panel — derived visibility", () => {
  it("stays closed while the search has not come back yet", async () => {
    renderTopbar();

    await typeSearch("ad");

    expect(screen.queryByText(/No results for/)).toBeNull();
  });

  it("opens once the search has come back", async () => {
    useCommunitySearch.mockReturnValue({
      results: RESULTS,
      searching: false,
      hasSearched: true,
    });
    renderTopbar();

    await typeSearch("ad");

    await waitFor(() => expect(screen.getByText("Members")).toBeTruthy());
  });

  it("shows the empty state when the search came back with nothing", async () => {
    useCommunitySearch.mockReturnValue({
      results: null,
      searching: false,
      hasSearched: true,
    });
    renderTopbar();

    await typeSearch("zz");

    await waitFor(() => expect(screen.getByText(/No results for/)).toBeTruthy());
  });

  it("closes again when the user clicks outside", async () => {
    useCommunitySearch.mockReturnValue({
      results: RESULTS,
      searching: false,
      hasSearched: true,
    });
    renderTopbar();

    await typeSearch("ad");
    await waitFor(() => expect(screen.getByText("Members")).toBeTruthy());

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    await waitFor(() => expect(screen.queryByText("Members")).toBeNull());
  });

  it("reopens for a new search after being dismissed", async () => {
    useCommunitySearch.mockReturnValue({
      results: RESULTS,
      searching: false,
      hasSearched: true,
    });
    renderTopbar();

    await typeSearch("ad");
    await waitFor(() => expect(screen.getByText("Members")).toBeTruthy());

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByText("Members")).toBeNull());

    // A different term is a different search, so the dismissal does not
    // carry over to it.
    useCommunitySearch.mockReturnValue({
      results: RESULTS,
      searching: false,
      hasSearched: true,
    });
    await typeSearch("grace");

    await waitFor(() => expect(screen.getByText("Members")).toBeTruthy());
  });
});
