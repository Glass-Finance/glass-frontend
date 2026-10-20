import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Topbar from "../../../components/dashboard/Topbar";

// Regression: the account block's name line used to render the literal string
// "Loading..." while AuthContext's GET /user/me was in flight, so the signed-in
// member's name appeared to be "Loading...". getInitials already handled the
// same gap deliberately ("?" derived from the email), so the two halves of the
// account block disagreed about what "no user yet" means.
//
// The hydration gap is now placeholder bars, which also stops the header
// changing height once the real name arrives.

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
// The search hook owns a React Query of its own; stub it so this file keeps
// testing the account menu without standing up a QueryClient.
vi.mock("../../../hooks/useCommunitySearch", () => ({
  useCommunitySearch: () => useCommunitySearch(),
}));
// The panel is only opened on click; stub it so it contributes no DOM here.
vi.mock("../../../components/dashboard/NotificationsPanel", () => ({
  default: () => <div data-testid="notifications-panel" />,
}));

function renderTopbar() {
  return render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
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
});

describe("Topbar account — pre-hydration", () => {
  it("does not render the literal string 'Loading...' as the member's name", () => {
    // user is undefined until GET /user/me resolves.
    useAuth.mockReturnValue({ user: undefined, logout: vi.fn() });

    renderTopbar();

    expect(screen.queryByText("Loading...")).toBeNull();
    expect(document.body.textContent).not.toContain("Loading...");
  });

  it("renders placeholder bars in the name and email slots", () => {
    useAuth.mockReturnValue({ user: undefined, logout: vi.fn() });

    const { container } = renderTopbar();

    // Two bars: the name line and the email line.
    expect(container.querySelectorAll('[aria-hidden="true"].animate-pulse').length).toBe(2);
  });

  it("marks the region busy on a container that is not aria-hidden", () => {
    useAuth.mockReturnValue({ user: undefined, logout: vi.fn() });

    const { container } = renderTopbar();

    const busy = container.querySelector("[aria-busy]");
    expect(busy).not.toBeNull();
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.getAttribute("aria-hidden")).toBeNull();
  });

  it("still falls back to initials for the avatar, matching getInitials' contract", () => {
    useAuth.mockReturnValue({ user: undefined, logout: vi.fn() });

    const { container } = renderTopbar();

    // getInitials(null) === "?" — documented, intentional, unchanged here.
    expect(container.textContent).toContain("?");
  });
});

describe("Topbar account — hydrated", () => {
  it("renders the real name and email, with no bars and no busy flag", () => {
    useAuth.mockReturnValue({
      user: { firstName: "ada", lastName: "lovelace", email: "ada@example.com" },
      logout: vi.fn(),
    });

    const { container } = renderTopbar();

    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("ada@example.com")).toBeDefined();
    expect(container.querySelector("[aria-busy]")).toBeNull();
  });

  it("falls back to the email when the profile has no first name", () => {
    useAuth.mockReturnValue({ user: { email: "grace@example.com" }, logout: vi.fn() });

    renderTopbar();

    // The name line falls back to the email, and the email line below it
    // carries the same value -- two occurrences is the correct rendering, not
    // a duplicate-node bug.
    expect(screen.getAllByText("grace@example.com")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Loading...");
  });
});

// The account block used to be a disclosure menu whose only item was
// "Settings", pointing at a hub that mixes personal, finance and
// community-scoped destinations. That was two levels of indirection away from
// a click on the member's own face, and a second "Settings" entry beside the
// sidebar's own, landing somewhere else. It is now a direct link to the
// personal profile page -- the same model the member app's header photo
// already uses (/member/profile).
describe("Topbar account — direct link to the personal profile", () => {
  it("links the account block to /dashboard/settings/account/profile", () => {
    useAuth.mockReturnValue({
      user: { firstName: "ada", lastName: "lovelace", email: "ada@example.com" },
      logout: vi.fn(),
    });

    renderTopbar();

    const link = screen.getByRole("link", { name: /your profile/i });
    expect(link.getAttribute("href")).toBe("/dashboard/settings/account/profile");
  });

  it("renders the link even before the profile has hydrated", () => {
    // The link must not appear only once /user/me resolves, or the header
    // would lose its account affordance for the length of that request.
    useAuth.mockReturnValue({ user: undefined, logout: vi.fn() });

    renderTopbar();

    const link = screen.getByRole("link", { name: /your profile/i });
    expect(link.getAttribute("href")).toBe("/dashboard/settings/account/profile");
  });

  it("opens no dropdown menu and offers no duplicate Settings entry", () => {
    useAuth.mockReturnValue({
      user: { firstName: "ada", lastName: "lovelace", email: "ada@example.com" },
      logout: vi.fn(),
    });

    renderTopbar();

    // No menu role, no menu items, and no "Log out" stranded in the topbar --
    // sign-out lives on the sidebar rail (desktop) and in the drawer's
    // labelled Log Out row (mobile).
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.queryByRole("button", { name: /log ?out/i })).toBeNull();
  });
});
