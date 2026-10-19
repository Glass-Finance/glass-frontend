import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Settings from "../../../../pages/dashboard/settings/Settings";
import { useAuth } from "../../../../store/AuthContext";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useCommunities } from "../../../../hooks/useCommunities";
import { useKycSummary } from "../../../../hooks/useKyc";

// Settings sits deliberately outside CommunityAdminGuard, because the account
// level pages (profile, security, notifications) apply to no single community.
// Its *community-scoped* children are guarded, though — Community Profile,
// Member Access and Payout Account all live under CommunityAdminGuard, which
// fails closed by redirecting to /dashboard/home whenever it can't resolve a
// community the user actually administers.
//
// That redirect is correct as a security boundary but useless as UX: arriving
// from CommunitiesHome (which intentionally carries no ?community=, since its
// whole job is choosing one) meant the menu offered links that silently
// bounced back to the same page, reading as broken buttons. These tests pin
// that this page now explains the situation instead of guessing a community,
// and that it threads ?community= explicitly once one is genuinely resolved.
//
// The invariant that matters most: never silently pick a community. Not the
// first one, not a default, not any. useActiveCommunityId resolves exactly
// three ways (?community=, the glass_community snapshot, or null) and these
// tests must not grow a fourth.

vi.mock("../../../../store/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../../../hooks/useActiveCommunityId", () => ({ useActiveCommunityId: vi.fn() }));
vi.mock("../../../../hooks/useCommunities", () => ({ useCommunities: vi.fn() }));
// The KYC row reads the account-level verification summary, which is a React
// Query hook -- mocked at the same boundary as the others so this file stays
// about community context instead of standing up a QueryClient. The wizard
// modal is stubbed for the same reason: these tests assert the row's presence,
// its status, and that it opens the wizard *in place*, not the wizard's guts.
vi.mock("../../../../hooks/useKyc", () => ({ useKycSummary: vi.fn() }));
vi.mock("../../../../components/kyc/KycWizardModal", () => ({
  default: ({ open }) => (open ? <div>KYC wizard open</div> : null),
}));

const OWNED = { id: "comm-A", slug: "comm-a", name: "Alumni", owned: true };
const OTHER_OWNED = { id: "comm-B", slug: "comm-b", name: "Church", owned: true };
const PROMOTED_ADMIN = {
  id: "comm-C",
  slug: "comm-c",
  name: "Union",
  owned: false,
  memberRole: "COMMUNITY_ADMIN",
};
const PLAIN_MEMBER = {
  id: "comm-D",
  slug: "comm-d",
  name: "Society",
  owned: false,
  memberRole: "COMMUNITY_MEMBER",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ isPlatformAdmin: false });
  useActiveCommunityId.mockReturnValue(null);
  useCommunities.mockReturnValue({
    data: { communities: [OWNED, OTHER_OWNED] },
    isLoading: false,
  });
  // No status by default, so existing assertions see the same menu they did
  // before the KYC row was added.
  useKycSummary.mockReturnValue({ data: undefined });
});

// Renders the real Settings page inside a router that reports the full current
// URL, so each assertion is on the actual navigation target -- query string
// included -- rather than on a navigate spy or on the mere absence of a bounce.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function currentUrl() {
  return screen.getByTestId("location").textContent;
}

function renderSettings(initialPath = "/dashboard/settings/community") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route path="/dashboard/settings" element={<Settings />}>
          <Route path="account" element={<div>Account menu destination</div>} />
          <Route path="finance" element={<div>Finance menu destination</div>} />
          <Route path="community" element={<div>Community menu destination</div>} />
          <Route path="community/profile" element={<div>Community Profile destination</div>} />
          <Route path="community/ai-usage" element={<div>AI usage destination</div>} />
          <Route path="community/member-access" element={<div>Member Access destination</div>} />
          <Route path="account/profile" element={<div>Profile destination</div>} />
          <Route path="finance/paystack" element={<div>Payout Account destination</div>} />
        </Route>
        <Route path="/dashboard/home" element={<div>Communities Home destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Settings community context -- community-scoped destinations", () => {
  it("replaces community-scoped destinations with a clear state when no community resolves", () => {
    useActiveCommunityId.mockReturnValue(null);
    renderSettings("/dashboard/settings/community");

    expect(screen.getByText("Choose a community")).toBeTruthy();
    // The destinations that would have bounced must not be offered at all.
    expect(screen.queryByText("Community Profile")).toBeNull();
    expect(screen.queryByText("Member Access")).toBeNull();
  });

  it("navigates to /dashboard/home from the choose-community action", async () => {
    useActiveCommunityId.mockReturnValue(null);
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/community");

    await user.click(screen.getByRole("button", { name: /go to my communities/i }));

    expect(await screen.findByText("Communities Home destination")).toBeTruthy();
  });

  it("shows community-scoped destinations when a community is resolvable, and includes ?community= on navigation", async () => {
    useActiveCommunityId.mockReturnValue("comm-a");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/community");

    expect(screen.queryByText("Choose a community")).toBeNull();
    await user.click(screen.getByRole("button", { name: /community profile/i }));

    // Asserts the resolved community is carried in the URL, rather than left
    // to the ambient localStorage snapshot the old bare link depended on.
    expect(await screen.findByText("Community Profile destination")).toBeTruthy();
    expect(currentUrl()).toBe("/dashboard/settings/community/profile?community=comm-a");
  });

  it("preserves an existing ?community= rather than replacing it with another community", async () => {
    // Two communities the user administers; the URL asks for the second. A
    // first/default/any fallback would silently rewrite this to comm-a.
    useActiveCommunityId.mockReturnValue("comm-b");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/community?community=comm-b");

    await user.click(screen.getByRole("button", { name: /member access/i }));

    expect(await screen.findByText("Member Access destination")).toBeTruthy();
    // comm-b specifically -- a first/default/any fallback would rewrite this
    // to comm-a and silently act on the wrong community.
    expect(currentUrl()).toBe("/dashboard/settings/community/member-access?community=comm-b");
  });

  it("includes ?community= on Payout Account, the community-scoped Finance row", async () => {
    useActiveCommunityId.mockReturnValue("comm-a");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/finance");

    await user.click(screen.getByRole("button", { name: /payout account/i }));

    expect(await screen.findByText("Payout Account destination")).toBeTruthy();
    expect(currentUrl()).toBe("/dashboard/settings/finance/paystack?community=comm-a");
  });

  it("threads ?community= on the Community tab itself, keeping it explicit across the whole journey", async () => {
    useActiveCommunityId.mockReturnValue("comm-a");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    await user.click(screen.getByRole("button", { name: /^community$/i }));

    // The Community menu renders its own list rather than the child route, so
    // assert the destination via the URL and the items it offers.
    expect(currentUrl()).toBe("/dashboard/settings/community?community=comm-a");
    expect(screen.getByText("Community Profile")).toBeTruthy();
  });
});

describe("Settings community context -- account level stays account level", () => {
  it("renders account destinations without requiring any community", async () => {
    // /dashboard/settings is intentionally outside CommunityAdminGuard; a
    // missing community must never block it.
    useActiveCommunityId.mockReturnValue(null);
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    expect(screen.queryByText("Choose a community")).toBeNull();
    expect(screen.getByText("Profile")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^profile/i }));
    expect(await screen.findByText("Profile destination")).toBeTruthy();
  });

  it("leaves account-level navigation unchanged -- no ?community= is added", async () => {
    useActiveCommunityId.mockReturnValue("comm-a");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    await user.click(screen.getByRole("button", { name: /^profile/i }));

    expect(await screen.findByText("Profile destination")).toBeTruthy();
    // Account-level routes must stay bare even with a community in context.
    expect(currentUrl()).toBe("/dashboard/settings/account/profile");
  });

  it("does not show the choose-community state on the account tab even with no community", () => {
    useActiveCommunityId.mockReturnValue(null);
    renderSettings("/dashboard/settings/account");

    expect(screen.queryByText("Choose a community")).toBeNull();
    expect(screen.getByText("Security")).toBeTruthy();
  });
});

describe("Settings community context -- never silently picks a community", () => {
  it("does not offer community destinations for a stale community the user no longer administers", () => {
    // Resolves to a community the user is only a plain member of -- exactly
    // what CommunityAdminGuard rejects. Offering the link would recreate the
    // silent bounce.
    useActiveCommunityId.mockReturnValue("comm-d");
    useCommunities.mockReturnValue({ data: { communities: [PLAIN_MEMBER] }, isLoading: false });
    renderSettings("/dashboard/settings/community");

    expect(screen.getByText("Choose a community")).toBeTruthy();
    expect(screen.queryByText("Community Profile")).toBeNull();
  });

  it("does not treat an unresolvable id as the first community in the list", () => {
    // Two communities are available and the user administers both, but the
    // stored/URL id matches neither. Picking the first would edit a community
    // the user never chose.
    useActiveCommunityId.mockReturnValue("does-not-exist");
    useCommunities.mockReturnValue({
      data: { communities: [OWNED, OTHER_OWNED] },
      isLoading: false,
    });
    renderSettings("/dashboard/settings/community");

    expect(screen.getByText("Choose a community")).toBeTruthy();
    expect(screen.queryByText("Community Profile")).toBeNull();
  });

  it("still offers destinations for a promoted COMMUNITY_ADMIN who does not own the community", () => {
    // isCommunityAdmin is not ownership: admins of a community they don't own
    // must keep working.
    useActiveCommunityId.mockReturnValue("comm-c");
    useCommunities.mockReturnValue({ data: { communities: [PROMOTED_ADMIN] }, isLoading: false });
    renderSettings("/dashboard/settings/community");

    expect(screen.queryByText("Choose a community")).toBeNull();
    expect(screen.getByText("Community Profile")).toBeTruthy();
  });

  it("hides community-scoped entries from search while no community resolves", async () => {
    // Search previously offered Community Profile regardless of context, and
    // selecting it landed on a guarded route that bounced.
    useActiveCommunityId.mockReturnValue(null);
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    await user.type(screen.getByPlaceholderText("Find A Setting"), "community profile");
    await new Promise((r) => setTimeout(r, 200));

    expect(screen.queryByText(/no settings match/i)).toBeTruthy();
  });

  it("keeps the normal menus while the community list is still loading", () => {
    // A cold load must not flash "choose a community" before the real context
    // resolves -- that would misreport a perfectly valid session.
    useActiveCommunityId.mockReturnValue("comm-a");
    useCommunities.mockReturnValue({ data: undefined, isLoading: true });
    renderSettings("/dashboard/settings/community");

    expect(screen.queryByText("Choose a community")).toBeNull();
    expect(screen.getByText("Community Profile")).toBeTruthy();
  });
});

// KYC is personal, not community-scoped: it gates what *you* can create and
// manage, so it must never be threaded with ?community= or hidden by the
// choose-a-community state above.
describe("Settings -- Identity Verification row", () => {
  it("offers KYC on the account menu even when no community resolves", () => {
    useActiveCommunityId.mockReturnValue(null);
    renderSettings("/dashboard/settings/account");

    expect(screen.getByText("Identity Verification")).toBeTruthy();
  });

  it("does not thread ?community= onto KYC when several communities resolve", async () => {
    useActiveCommunityId.mockReturnValue("comm-a");
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    await user.click(screen.getByRole("button", { name: /identity verification/i }));

    // Opens the wizard in place rather than navigating -- and either way the
    // account-level row must carry no community scope.
    expect(screen.queryByTestId("location").textContent).not.toContain("community=");
  });

  it("opens the wizard instead of leaving Settings", async () => {
    const user = userEvent.setup();
    renderSettings("/dashboard/settings/account");

    await user.click(screen.getByRole("button", { name: /identity verification/i }));

    expect(screen.getByText("KYC wizard open")).toBeTruthy();
    // Still on the account menu behind the modal -- the Settings context the
    // user opened it from is preserved.
    expect(currentUrl()).toBe("/dashboard/settings/account");
  });

  it("shows the live account status beside the row", () => {
    useKycSummary.mockReturnValue({ data: { status: "NOT_STARTED" } });
    renderSettings("/dashboard/settings/account");

    expect(screen.getByText("Not started")).toBeTruthy();
  });
});

it("opens AI usage settings in the explicitly selected community", async () => {
  useActiveCommunityId.mockReturnValue("comm-b");
  const user = userEvent.setup();
  renderSettings("/dashboard/settings/community?community=comm-b");
  await user.click(screen.getByRole("button", { name: /AI usage & policy/i }));
  expect(await screen.findByText("AI usage destination")).toBeTruthy();
  expect(currentUrl()).toBe("/dashboard/settings/community/ai-usage?community=comm-b");
});
