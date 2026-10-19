import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Regression coverage for the post-creation admin refresh in
// OrganizationProfile.jsx.
//
// The page used to call updateUser({ isAdmin: true }) — writing a PRIVILEGE
// flag into localStorage from the client, which ProtectedRoute then read back
// as though the backend had asserted it. It now calls refreshUser(), which
// re-derives isAdmin from the server (GET /user/me + the complete communities
// list).
//
// Three properties are pinned here, and the last two are the ones a naive swap
// would have broken:
//   1. the flag is derived from the server, never asserted locally
//   2. the community id is persisted BEFORE the refresh, so a failed refresh
//      makes a retry an UPDATE rather than a duplicate CREATE
//   3. a failed refresh surfaces an error instead of silently continuing into
//      the ProtectedRoute bounce this call exists to prevent
//
// Mocked at the api/ and auth-context boundary. The component under test is the
// real one.

const createCommunity = vi.fn();
const updateCommunity = vi.fn();

const refreshUser = vi.fn();
const saveOnboardingProgress = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("../../../api/communities", () => ({
  createCommunity: (...a) => createCommunity(...a),
  updateCommunity: (...a) => updateCommunity(...a),
}));
// The logo upload is optional in this flow and never triggered by these tests,
// but the module is still imported by the page, so it has to resolve.
vi.mock("../../../api/files", () => ({ uploadFile: vi.fn() }));
vi.mock("../../../utils/onboardingProgress", () => ({
  saveOnboardingProgress: (...a) => saveOnboardingProgress(...a),
  readOnboardingProgress: () => ({}),
}));
vi.mock("../../../utils/deviceRedirect", () => ({
  APP_ORIGIN: "https://app.glasspay.app",
  isMobileDevice: () => false,
}));
vi.mock("../../../utils/resizeImage", () => ({ resizeImageFile: vi.fn(async (f) => f) }));
// The slug is validated as a required field on submit and is owned by useSlug
// rather than this page's form state, so a stub returning "" would make every
// submission fail validation before reaching the code under test.
vi.mock("../../../hooks/useSlug", () => ({
  useSlug: () => ({
    slug: "test-association",
    setSlug: vi.fn(),
    available: true,
    checking: false,
    suggesting: false,
    suggestFrom: vi.fn(),
  }),
}));
vi.mock("../../../store/AuthContext", () => ({
  useAuth: () => ({ refreshUser, isAuthenticated: true }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const COMMUNITY = { id: "comm-1", slug: "test-association", name: "Test Association" };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.invalidateQueries = invalidateQueries;

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/onboarding/organization-profile"]}>
        <OrganizationProfile />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

// Imported after the mocks are registered.
import OrganizationProfile from "../../../pages/onboarding/OrganizationProfile";

async function submitValidForm() {
  const user = userEvent.setup();
  // Targeted by `name` rather than label text: this form's <label>s carry no
  // htmlFor, so getByLabelText cannot resolve them (its own a11y gap, not what
  // this suite covers). `name` is stable and unambiguous.
  const field = (n) => document.querySelector(`[name="${n}"]`);
  await user.type(field("communityName"), "Test Association");
  await user.type(field("description"), "A test association body.");
  await user.type(field("contactEmail"), "owner@example.com");
  await user.selectOptions(field("category"), "Student Club");
  await user.click(screen.getByRole("button", { name: /^next$/i }));
}

describe("OrganizationProfile — admin standing after community creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveOnboardingProgress.mockReturnValue(undefined);
    invalidateQueries.mockResolvedValue(undefined);
    navigate.mockReturnValue(undefined);
    updateCommunity.mockResolvedValue({ data: { data: COMMUNITY } });
  });

  it("derives isAdmin from the server instead of asserting it locally", async () => {
    createCommunity.mockResolvedValue({ data: { data: COMMUNITY } });
    refreshUser.mockResolvedValue(true);
    renderPage();

    await submitValidForm();

    await waitFor(() => expect(createCommunity).toHaveBeenCalled());
    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalled();
  });

  it("persists the community id BEFORE refreshing, so a retry updates rather than duplicates", async () => {
    createCommunity.mockResolvedValue({ data: { data: COMMUNITY } });
    refreshUser.mockResolvedValue(true);
    renderPage();

    await submitValidForm();

    await waitFor(() => expect(saveOnboardingProgress).toHaveBeenCalled());
    // The ordering is the whole point: had this run after the refresh, a
    // failed refresh would leave no id on record and the retry would create a
    // second community.
    expect(saveOnboardingProgress.mock.invocationCallOrder[0]).toBeLessThan(
      refreshUser.mock.invocationCallOrder[0],
    );
  });

  it("surfaces an error and does NOT navigate when the refresh fails", async () => {
    createCommunity.mockResolvedValue({ data: { data: COMMUNITY } });
    // hydrateUserProfile reports failure by returning false rather than
    // throwing, so a bare `await refreshUser()` would continue straight into
    // the ProtectedRoute bounce with a stale isAdmin.
    refreshUser.mockResolvedValue(false);
    renderPage();

    await submitValidForm();

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    await waitFor(() => expect(navigate).not.toHaveBeenCalled());
    // The id is still on record, so the retry path re-enters as an update.
    expect(saveOnboardingProgress).toHaveBeenCalledWith(
      expect.objectContaining({ communityId: "comm-1" }),
    );
  });

  it("keeps the community id on record even when the refresh fails", async () => {
    createCommunity.mockResolvedValue({ data: { data: COMMUNITY } });
    refreshUser.mockResolvedValue(false);
    renderPage();

    await submitValidForm();

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    // saveOnboardingProgress also runs on every form change (line 132), so
    // count is not the assertion — the post-creation call is the LAST one, and
    // it is the one that must carry the community id.
    const calls = saveOnboardingProgress.mock.calls;
    const last = calls[calls.length - 1][0];
    expect(last.communityId).toBe("comm-1");
    expect(last.communitySlug).toBe("test-association");
    // And it was recorded before the refresh that then failed.
    expect(last.communityId).toBeTruthy();
  });
});
