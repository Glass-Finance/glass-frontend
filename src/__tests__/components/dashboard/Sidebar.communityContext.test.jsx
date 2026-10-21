import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "../../../components/dashboard/Sidebar";
import { useAuth } from "../../../store/AuthContext";
import { useCommunities } from "../../../hooks/useCommunities";

// The Sidebar resolves an "active community" for every link it renders, and
// then *persists* that value to the glass_community localStorage key. That key
// is not a private cache: useActiveCommunityId() reads it as the session-wide
// active community, and CommunityAdminGuard, Notifications and Settings all
// resolve from it.
//
// So the distinction these tests pin is between a community that was actually
// *chosen* (?community=, or a stored selection that still resolves) and one
// the sidebar merely inferred. Inferring is fine for keeping a single-community
// admin's nav live on a bare deep link, but persisting it would spread an
// unchosen community past the sidebar into every community-scoped surface --
// and with two or more admin communities there is nothing to infer from
// without guessing, since [0] is just whatever the backend ordered first.
//
// Note the sidebar is deliberately *not* the authority on whether a ?community=
// is permitted. CommunityAdminGuard fails closed and bounces unauthorized
// destinations; the sidebar's job is only to stop substituting a different
// community for the one the URL names.

vi.mock("../../../store/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../../hooks/useCommunities", () => ({ useCommunities: vi.fn() }));
// These carry no community-resolution logic and would otherwise drag the api
// client and toast layer into the render; stubbed at the boundary the component
// imports them through.
vi.mock("../../../hooks/useInvites", () => ({ useInvites: () => ({ invites: [] }) }));
vi.mock("../../../hooks/useNotifications", () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));
vi.mock("../../../hooks/useMyAccount", () => ({
  useMyMemberRecord: () => ({ data: { billingExempt: true } }),
}));
vi.mock("../../../hooks/useKeyboardShortcuts", () => ({
  useRegisterShortcutGroup: () => {},
  useShortcutsHelp: () => ({}),
  useRegisterShortcut: () => {},
  useEscapeToClose: () => {},
}));
vi.mock("../../../utils/communityRole", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, resolveIsPayingAdmin: vi.fn().mockResolvedValue(false) };
});
vi.mock("../../../utils/toast", () => ({ toastSuccess: vi.fn() }));

const OWNED_A = { id: "comm-A", slug: "comm-a", name: "Alumni", owned: true };
const OWNED_B = { id: "comm-B", slug: "comm-b", name: "Church", owned: true };
// UUID-shaped, and deliberately *not* derivable from its slug: real backend ids
// are uuids, so nothing downstream can be passing by accident.
const OWNED_UUID = {
  id: "3f6c1a52-8b1e-4d70-9c34-2b7e5a90d118",
  slug: "market-square-traders",
  name: "Market Square",
  owned: true,
};
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

const KEY = "glass_community";

// Renders the real Sidebar next to a router that reports the full current URL,
// so navigation assertions are on the real target -- query string included --
// rather than on a navigate spy. Sidebar is a sibling of <Routes> rather than a
// layout route element because DashboardLayout (not Sidebar) owns the <Outlet>.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderSidebar({
  communities,
  path = "/dashboard/notifications",
  search = "",
  mobileOpen = false,
  onCloseMobile,
} = {}) {
  useCommunities.mockReturnValue({ data: { communities }, isLoading: false });
  return render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <LocationProbe />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} />
      <Routes>
        <Route path="/dashboard/home" element={<div>Communities overview</div>} />
        <Route path="/dashboard/notifications" element={<div>Notifications destination</div>} />
        <Route path="/dashboard/admin" element={<div>Admin destination</div>} />
        <Route path="/dashboard/admin/paying" element={<div>Paying admin destination</div>} />
        <Route path="/dashboard/payments" element={<div>Payments destination</div>} />
        <Route path="/dashboard/members" element={<div>Members destination</div>} />
        <Route path="/dashboard/groups" element={<div>Groups destination</div>} />
        <Route path="/dashboard/settings" element={<div>Settings destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function storedSlug() {
  const raw = localStorage.getItem(KEY);
  return raw === null ? null : JSON.parse(raw).slug;
}

function navButton(label) {
  return screen.getByRole("button", { name: new RegExp(`^${label}`) });
}

function currentUrl() {
  return screen.getByTestId("location").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuth.mockReturnValue({
    logout: vi.fn(),
    user: { email: "admin@example.com" },
    isPlatformAdmin: false,
  });
});

afterEach(cleanup);

describe("Sidebar communities overview — mobile drawer", () => {
  it("shows admin communities and opens the selected community dashboard", async () => {
    const user = userEvent.setup();
    const onCloseMobile = vi.fn();
    renderSidebar({
      communities: [OWNED_A, PROMOTED_ADMIN, PLAIN_MEMBER],
      path: "/dashboard/home",
      mobileOpen: true,
      onCloseMobile,
    });

    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Your communities" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Alumni/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Union/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Society/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Alumni/ }));

    await waitFor(() => {
      expect(currentUrl()).toBe("/dashboard/admin?community=comm-a");
    });
    expect(storedSlug()).toBe("comm-a");
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("shows an empty state when the user has no communities to manage", () => {
    renderSidebar({
      communities: [PLAIN_MEMBER],
      path: "/dashboard/home",
      mobileOpen: true,
    });

    expect(screen.getByText("No communities to manage yet.")).toBeTruthy();
  });

  it("does not add the mobile chooser to the desktop overview rail", () => {
    renderSidebar({ communities: [OWNED_A], path: "/dashboard/home" });

    expect(screen.queryByRole("navigation", { name: "Your communities" })).toBeNull();
  });
});

describe("Sidebar community context — multiple admin communities, nothing resolved", () => {
  // The core hazard: [0] is backend ordering, not user intent. Acting on it
  // silently drops a multi-community admin into an arbitrary community.
  it("does not fall back to the first admin community", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    // Header falls back to the generic label rather than naming a community.
    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(screen.queryByText("Church")).toBeNull();
  });

  it("leaves community-scoped nav links disabled instead of pointing at one", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    // Payments/Members/Groups/Settings all need a community to build a URL.
    for (const label of ["Payments", "Members", "Groups", "Settings"]) {
      expect(navButton(label).disabled).toBe(true);
    }
    // Home still works -- it targets the overview, which owns the choice.
    expect(navButton("Dashboard").disabled).toBe(false);
  });

  it("does not write glass_community", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    expect(storedSlug()).toBeNull();
  });

  it("leaves the URL with no community attached", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    expect(currentUrl()).toBe("/dashboard/notifications");
  });

  it("does not guess even when the list order would favor the second community", () => {
    renderSidebar({ communities: [OWNED_B, OWNED_A] });

    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(storedSlug()).toBeNull();
  });
});

describe("Sidebar community context — exactly one admin community", () => {
  it("keeps navigation usable, resolving against the sole community", () => {
    renderSidebar({ communities: [OWNED_A, PLAIN_MEMBER] });

    // Header names it, so nav can build real hrefs.
    expect(screen.getByText("Alumni")).toBeTruthy();
    expect(navButton("Payments").disabled).toBe(false);
  });

  it("gives the mobile community name its own line before the role and switcher controls", () => {
    renderSidebar({ communities: [{ ...OWNED_A, name: "Wesley reading club" }] });

    const name = screen.getByText("Wesley reading club");
    expect(name.parentElement.className).toContain("flex-col");
    expect(name.parentElement.className).toContain("flex-1");
    expect(name.parentElement.className).toContain("md:flex-row");
    expect(name.className).toContain("break-words");
    expect(name.className).not.toContain("truncate");
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Switch community" })).toBeTruthy();
  });

  it("navigates community-scoped links with that community's ?community=", async () => {
    const user = userEvent.setup();
    renderSidebar({ communities: [OWNED_A, PLAIN_MEMBER] });

    await user.click(navButton("Payments"));
    expect(currentUrl()).toBe("/dashboard/payments?community=comm-a");
  });

  it("does NOT persist the fallback to glass_community", () => {
    renderSidebar({ communities: [OWNED_A, PLAIN_MEMBER] });

    // The whole point: liveness without turning an inference into a session-
    // wide "active community" that useActiveCommunityId() would then hand to
    // CommunityAdminGuard, Notifications and Settings.
    expect(storedSlug()).toBeNull();
  });

  it("counts promoted admins, not just owners", () => {
    renderSidebar({ communities: [PROMOTED_ADMIN, PLAIN_MEMBER] });

    expect(screen.getByText("Union")).toBeTruthy();
    expect(storedSlug()).toBeNull();
  });

  it("leaves nav live across the whole link set, not just Payments", () => {
    renderSidebar({ communities: [OWNED_A, PLAIN_MEMBER] });

    for (const label of ["Payments", "Members", "Groups", "Settings", "Dashboard"]) {
      expect(navButton(label).disabled).toBe(false);
    }
  });
});

describe("Sidebar community context — no admin communities", () => {
  it("keeps the existing no-community state", () => {
    renderSidebar({ communities: [PLAIN_MEMBER] });

    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(navButton("Payments").disabled).toBe(true);
    expect(navButton("Dashboard").disabled).toBe(false);
    expect(storedSlug()).toBeNull();
  });

  it("keeps the empty rail placeholder", () => {
    renderSidebar({ communities: [PLAIN_MEMBER] });

    // The "—" tile means "no admin communities", not a rendering failure.
    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("Sidebar community context — explicit ?community= wins", () => {
  it("uses the named community and persists it", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B], search: "?community=comm-b" });

    expect(screen.getByText("Church")).toBeTruthy();
    expect(navButton("Payments").disabled).toBe(false);

    // Explicit context is chosen, so it syncs into the snapshot as before.
    expect(storedSlug()).toBe("comm-b");
  });

  it("navigates against the explicitly named community, not the first one", async () => {
    const user = userEvent.setup();
    renderSidebar({ communities: [OWNED_A, OWNED_B], search: "?community=comm-b" });

    await user.click(navButton("Payments"));
    expect(currentUrl()).toBe("/dashboard/payments?community=comm-b");
  });
});

describe("Sidebar community context — ?community= accepts an id or a slug", () => {
  // ?community= reaches the sidebar from several places that resolve against a
  // community id rather than a slug (a notification row's communityId, a link
  // built from a community object). CommunityAdminGuard, Settings and
  // useNotifications all match id-or-slug; the sidebar matching on slug only
  // meant a uuid resolved everywhere else and here fell back to "no community",
  // which disabled the nav links and left the rail unhighlighted on a page the
  // rest of the app had already resolved.
  it("resolves ?community=<slug>", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B], search: "?community=comm-b" });

    expect(screen.getByText("Church")).toBeTruthy();
    expect(navButton("Payments").disabled).toBe(false);
  });

  it("resolves ?community=<id> to the same community the slug resolves to", () => {
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A, OWNED_B],
      search: `?community=${OWNED_UUID.id}`,
    });

    expect(screen.getByText("Market Square")).toBeTruthy();
    // Not just "something" resolved -- it is the community the uuid names.
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(screen.queryByText("Church")).toBeNull();
  });

  it("navigates against the id-resolved community's slug", async () => {
    const user = userEvent.setup();
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A, OWNED_B],
      search: `?community=${OWNED_UUID.id}`,
    });

    await user.click(navButton("Payments"));
    // Links are built from the resolved community's slug, so a uuid query
    // yields the same destination the slug query would.
    expect(currentUrl()).toBe("/dashboard/payments?community=market-square-traders");
  });

  it("highlights the rail tile for an id query, not just a slug query", () => {
    // The rail's own marker, not the resolution the header reads: a uuid query
    // that resolved but left the rail dark would still look unselected.
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A, OWNED_B],
      search: `?community=${OWNED_UUID.id}`,
    });

    const activeTile = screen.getByTitle("Market Square").parentElement;
    expect(activeTile.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    expect(
      screen.getByTitle("Church").parentElement.querySelector('span[aria-hidden="true"]'),
    ).toBeNull();
  });

  it("persists an id-resolved community as chosen context", () => {
    // Resolution by id is still an explicit ?community=, so it syncs into
    // glass_community exactly as a slug query does -- normalized to the stored
    // community object, so other consumers get a slug they can resolve.
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A, OWNED_B],
      search: `?community=${OWNED_UUID.id}`,
    });

    expect(storedSlug()).toBe("market-square-traders");
  });

  it("still resolves nothing for an unknown ?community= (no arbitrary pick)", () => {
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A, OWNED_B],
      search: "?community=3f6c1a52-0000-4000-8000-000000000000",
    });

    // An unmatched uuid must not fall through to the single-community
    // inference or the first admin community -- three admin communities here.
    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(screen.queryByText("Market Square")).toBeNull();
    expect(storedSlug()).toBeNull();
  });

  it("does not let an id-resolved community bypass the no-inference rule", () => {
    // A sole admin community found by id is still explicit context, not the
    // fallback, so this must not blur the PR #94 distinction: the fallback only
    // ever engages when *nothing* resolved.
    renderSidebar({ communities: [OWNED_UUID], search: `?community=${OWNED_UUID.id}` });

    expect(screen.getByText("Market Square")).toBeTruthy();
    // Chosen, therefore persisted -- same as the slug case above.
    expect(storedSlug()).toBe("market-square-traders");
  });
});

describe("Sidebar community context — no regression to the no-inference rule", () => {
  it("does not persist a single administered community found by id alone", () => {
    // Nothing in the URL or the snapshot names a community, so the sole admin
    // community is only *inferred* for nav liveness. A uuid id must not change
    // that: the id never enters the picture without an explicit ?community=.
    renderSidebar({ communities: [OWNED_UUID, PLAIN_MEMBER] });

    expect(screen.getByText("Market Square")).toBeTruthy();
    expect(storedSlug()).toBeNull();
  });

  it("does not let an inferred uuid community overwrite a stale stored one", () => {
    // Stored A no longer resolves; the uuid community is the only remaining
    // admin community, so it is inferred for nav liveness -- and still must not
    // be written over A's snapshot.
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_UUID, PLAIN_MEMBER] });

    expect(screen.getByText("Market Square")).toBeTruthy();
    expect(storedSlug()).toBe("comm-a");
  });

  it("lets ?community=<id> override a different stored selection", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({
      communities: [OWNED_UUID, OWNED_A],
      search: `?community=${OWNED_UUID.id}`,
    });

    expect(screen.getByText("Market Square")).toBeTruthy();
    expect(storedSlug()).toBe("market-square-traders");
  });

  it("resolves a stored community by its id when the snapshot carries one", () => {
    // glass_community is written from a community object, but only a snapshot
    // whose slug is absent (older write, hand-edited) leaves id as the value
    // useActiveCommunityId-style readers fall back to. Resolving it keeps the
    // stored path on the same id-or-slug footing as the query path.
    localStorage.setItem(KEY, JSON.stringify({ id: OWNED_UUID.id }));
    renderSidebar({ communities: [OWNED_UUID, OWNED_A] });

    expect(screen.getByText("Market Square")).toBeTruthy();
    expect(storedSlug()).toBe("market-square-traders");
  });
});

describe("Sidebar community context — unauthorized ?community= is not substituted", () => {
  it("does not swap a member-only community for an administered one", async () => {
    const user = userEvent.setup();
    // comm-d is one the user belongs to but doesn't administer. It resolves,
    // so the sidebar reflects the URL; CommunityAdminGuard is what fails closed
    // and bounces. The sidebar must not paper over that by pointing its links
    // at a community this user does administer.
    renderSidebar({ communities: [OWNED_A, OWNED_B, PLAIN_MEMBER], search: "?community=comm-d" });

    expect(screen.getByText("Society")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(screen.queryByText("Church")).toBeNull();

    await user.click(navButton("Payments"));
    expect(currentUrl()).toBe("/dashboard/payments?community=comm-d");
  });

  it("does not substitute an admin community for an unknown ?community=", () => {
    // Nothing resolves at all, and two admin communities exist -- the case
    // that previously fell through to filter(isCommunityAdmin)[0].
    renderSidebar({ communities: [OWNED_A, OWNED_B], search: "?community=not-a-community" });

    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(screen.queryByText("Church")).toBeNull();
    expect(storedSlug()).toBeNull();
  });
});

describe("Sidebar community context — existing stored selection", () => {
  it("resolves from glass_community when no ?community= is present", async () => {
    const user = userEvent.setup();
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    expect(screen.getByText("Alumni")).toBeTruthy();

    await user.click(navButton("Payments"));
    expect(currentUrl()).toBe("/dashboard/payments?community=comm-a");
  });

  it("leaves a matching stored selection untouched", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    expect(storedSlug()).toBe("comm-a");
  });

  it("prefers a stored selection over the single-community fallback", () => {
    // Stored A resolves, so it wins outright and B is never a candidate.
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A] });

    expect(screen.getByText("Alumni")).toBeTruthy();
    expect(storedSlug()).toBe("comm-a");
  });

  it("lets ?community= override a different stored selection", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A, OWNED_B], search: "?community=comm-b" });

    expect(screen.getByText("Church")).toBeTruthy();
    expect(storedSlug()).toBe("comm-b");
  });
});

describe("Sidebar community context — propagation hazard regressions", () => {
  // With multiple admin communities a stale snapshot must not cause a
  // different community to be written over it.
  it("does not overwrite a stored community A with the fallback candidate B", () => {
    // Stored A no longer resolves (role revoked, list refetched), and B is the
    // only remaining admin community.
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_B, PLAIN_MEMBER] });

    // B is used for liveness...
    expect(screen.getByText("Church")).toBeTruthy();
    // ...but A's stored snapshot is not clobbered by that inference.
    expect(storedSlug()).toBe("comm-a");
  });

  it("does not overwrite a stored community when no admin community exists", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [PLAIN_MEMBER] });

    expect(storedSlug()).toBe("comm-a");
    expect(screen.getByText("Your Communities")).toBeTruthy();
  });

  it("does not overwrite a stored community when several exist but none resolves", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_B, PROMOTED_ADMIN] });

    expect(screen.getByText("Your Communities")).toBeTruthy();
    expect(storedSlug()).toBe("comm-a");
  });

  it("does not clear a previously valid glass_community", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A, OWNED_B] });

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(OWNED_A));
  });
});

describe("Sidebar community context — communities overview", () => {
  it("never picks a community on the overview, even with several available", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B], path: "/dashboard/home" });

    expect(screen.getByText("Communities overview")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(screen.queryByText("Church")).toBeNull();
    expect(storedSlug()).toBeNull();
  });

  it("does not let a stored selection override the overview's own purpose", () => {
    localStorage.setItem(KEY, JSON.stringify(OWNED_A));
    renderSidebar({ communities: [OWNED_A, OWNED_B], path: "/dashboard/home" });

    expect(screen.getByText("Communities overview")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    // The existing snapshot survives untouched by merely visiting the overview.
    expect(storedSlug()).toBe("comm-a");
  });

  it("still renders the admin community rail so a choice is available", () => {
    renderSidebar({ communities: [OWNED_A, OWNED_B], path: "/dashboard/home" });

    // The rail is the "pick one" affordance, so both must remain reachable.
    expect(screen.getByTitle("Alumni")).toBeTruthy();
    expect(screen.getByTitle("Church")).toBeTruthy();
  });

  it("does not use the single-community fallback on the overview either", () => {
    renderSidebar({ communities: [OWNED_A], path: "/dashboard/home" });

    expect(screen.getByText("Communities overview")).toBeTruthy();
    expect(screen.queryByText("Alumni")).toBeNull();
    expect(storedSlug()).toBeNull();
  });
});
