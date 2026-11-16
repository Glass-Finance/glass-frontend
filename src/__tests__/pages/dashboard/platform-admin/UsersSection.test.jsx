import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersSection from "../../../../pages/dashboard/platform-admin/UsersSection";
vi.mock("../../../../store/AuthContext", () => ({
  useAuth: () => ({ user: { role: "OPERATIONS_ADMIN" } }),
}));
import {
  getAdminUsers,
  getAdminUser,
  suspendUser,
  unsuspendUser,
  restoreUser,
  markUserForDeletion,
  anonymizeUser,
} from "../../../../api/admin";

// Platform-admin user moderation: every destructive action (suspend,
// unsuspend, restore, mark-for-deletion, anonymize) is gated behind a confirm
// modal with a required reason, and a 403 renders the Access-denied shell
// instead of a broken table. Mock the api module (not the hooks) so the real
// mutation onSuccess/invalidate wiring is exercised.

vi.mock("../../../../api/admin", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAdminUsers: vi.fn(),
    getAdminUser: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    restoreUser: vi.fn(),
    markUserForDeletion: vi.fn(),
    anonymizeUser: vi.fn(),
  };
});

function page(content) {
  return { data: { data: { content, totalElements: content.length, totalPages: 1 } } };
}

function userFixture(overrides = {}) {
  return {
    id: "user-1",
    email: "ada@example.com",
    userData: { firstName: "ada", lastName: "lovelace" },
    isPlatformAdmin: false,
    platformRole: null,
    // Suspension is accountNonLocked, NOT enabled — suspendUser() never touches
    // enabled. A fixture meaning "suspended" must set accountNonLocked: false.
    enabled: true,
    accountNonLocked: true,
    // Deliberately no `status`: UserDto does not serialize it yet, so fixtures
    // must match what the API actually sends. userStatus() falls back to
    // `enabled === false` to mean pending deletion. See the forward-path test
    // below for the `status` branch.
    emailVerified: true,
    lastLoginAt: "2026-01-01T10:00:00.000Z",
    metrics: { totalRelatedCommunities: 2 },
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersSection />
    </QueryClientProvider>,
  );
}

async function findRow() {
  const email = await screen.findByText("ada@example.com");
  return email.closest("tr");
}

// Row actions live behind the overflow menu now — open it first.
function openMenu(row, itemName) {
  fireEvent.click(within(row).getByRole("button", { name: /^Actions for/ }));
  return within(row).getByRole("button", { name: itemName, exact: true });
}

beforeEach(() => {
  getAdminUsers.mockResolvedValue(page([userFixture()]));
  getAdminUser.mockResolvedValue({
    data: {
      data: userFixture({
        userData: { firstName: "grace", lastName: "hopper" },
        phoneNumber: "+2348012345678",
        timezone: "Africa/Lagos",
        platformRole: "USER",
        phoneVerified: false,
        mfaEnabled: true,
        kycStatus: "APPROVED",
        metrics: {
          communitiesOwned: 1,
          communitiesJoined: 3,
          totalRelatedCommunities: 4,
          pendingInvites: 0,
          pendingJoinRequests: 2,
        },
      }),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UsersSection — rendering", () => {
  it("renders a user row with status, verification, and community count", async () => {
    renderSection();
    const row = await findRow();

    expect(screen.getByRole("heading", { name: "Users", level: 1 })).toBeTruthy();
    expect(within(row).getByText("Ada Lovelace")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();
    expect(within(row).getByText("✓ Verified")).toBeTruthy();
    expect(within(row).getByText("2")).toBeTruthy();
    expect(openMenu(row, "Suspend")).toBeTruthy();
  });

  it("maps each filter tab onto its backend query flag", async () => {
    renderSection();
    await findRow();

    // Initial mount is All users — no backend filter flags at all.
    expect(getAdminUsers.mock.calls[0][0]).not.toHaveProperty("enabled");
    expect(getAdminUsers.mock.calls[0][0]).not.toHaveProperty("emailVerified");

    // There is deliberately no "Suspended" tab: AdminUserQueryDto has no
    // accountNonLocked filter, so the old tab sent { enabled: false } and
    // returned pending-deletion accounts instead of suspended ones.
    expect(screen.queryByRole("button", { name: "Suspended" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Unverified" }));
    await waitFor(() =>
      expect(getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: false })),
    );
  });

  it("renders the Access denied shell on a 403", async () => {
    getAdminUsers.mockRejectedValue({ response: { status: 403 } });
    renderSection();

    expect(await screen.findByText("Access denied")).toBeTruthy();
    expect(screen.getByText("Platform admin rights required to view this data.")).toBeTruthy();
    expect(suspendUser).not.toHaveBeenCalled();
  });
});

describe("UsersSection — details", () => {
  it("shows the profile photo and falls back to initials when it fails", async () => {
    getAdminUser.mockResolvedValue({
      data: {
        data: userFixture({
          userData: {
            firstName: "ada",
            lastName: "lovelace",
            profileImage: { url: "https://example.com/profile.jpg" },
          },
        }),
      },
    });
    renderSection();
    fireEvent.click(await findRow());
    const photo = await screen.findByRole("img", { name: "Ada Lovelace profile picture" });
    expect(photo.getAttribute("src")).toBe("https://example.com/profile.jpg");
    fireEvent.error(photo);
    expect(screen.queryByRole("img", { name: "Ada Lovelace profile picture" })).toBeNull();
    expect(
      within(screen.getByRole("dialog", { name: "User details" })).getByText("AL"),
    ).toBeDefined();
  });

  it.each([undefined, { url: "javascript:alert(1)" }])(
    "uses initials for missing or unsafe profile images: %j",
    async (profileImage) => {
      getAdminUser.mockResolvedValue({
        data: {
          data: userFixture({
            userData: { firstName: "ada", lastName: "lovelace", profileImage },
          }),
        },
      });
      renderSection();
      fireEvent.click(await findRow());
      const dialog = await screen.findByRole("dialog", { name: "User details" });
      await waitFor(() => expect(within(dialog).getByText("AL")).toBeDefined());
      expect(within(dialog).queryByRole("img")).toBeNull();
    },
  );

  it("loads full details only when the row is clicked", async () => {
    renderSection();
    const row = await findRow();
    expect(getAdminUser).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(await screen.findByRole("dialog", { name: "User details" })).toBeDefined();
    expect(await screen.findByText("Grace Hopper")).toBeDefined();
    expect(getAdminUser).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("+2348012345678")).toBeDefined();
    expect(screen.getByText("Africa/Lagos")).toBeDefined();
    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
  });

  it("supports keyboard focus and restores it after closing", async () => {
    renderSection();
    const trigger = await screen.findByRole("button", { name: "View details for ada@example.com" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "User details" })).toBe(
      document.activeElement,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["Suspend", "Mark for deletion…", "Delete user…"])(
    "does not open details for the %s action",
    async (name) => {
      renderSection();
      const row = await findRow();
      fireEvent.click(openMenu(row, name));
      expect(screen.queryByRole("dialog", { name: "User details" })).toBeNull();
      expect(getAdminUser).not.toHaveBeenCalled();
    },
  );

  it("keeps Unsuspend independent from details", async () => {
    getAdminUsers.mockResolvedValue(page([userFixture({ accountNonLocked: false })]));
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Unsuspend", exact: true }));
    expect(getAdminUser).not.toHaveBeenCalled();
  });

  it("keeps KYC actions from opening a second user-details dialog", async () => {
    getAdminUsers.mockResolvedValue(
      page([userFixture({ platformRole: "USER", kycStatus: "APPROVED" })]),
    );
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Revoke KYC"));
    expect(await screen.findByRole("dialog", { name: "Revoke KYC" })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "User details" })).toBeNull();
    await waitFor(() => expect(getAdminUser).toHaveBeenCalledTimes(1));
  });

  it("handles missing profile data and verification flags without inferring false", async () => {
    getAdminUser.mockResolvedValue({
      data: { data: userFixture({ userData: null, accountName: "Example account" }) },
    });
    renderSection();
    fireEvent.click(await findRow());
    const dialog = await screen.findByRole("dialog", { name: "User details" });
    await waitFor(() => expect(within(dialog).getAllByText("Example account")).toHaveLength(2));
    expect(within(dialog).getByText("Phone verified").nextElementSibling.textContent).toBe("—");
  });

  it("shows missing metrics as unavailable instead of zero", async () => {
    getAdminUser.mockResolvedValue({ data: { data: userFixture({ metrics: null }) } });
    renderSection();
    fireEvent.click(await findRow());
    expect(await screen.findByText("Metrics unavailable")).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("handles an empty user response", async () => {
    getAdminUser.mockResolvedValue({ data: { data: null } });
    renderSection();
    fireEvent.click(await findRow());
    expect(await screen.findByText("User details are unavailable.")).toBeDefined();
  });

  it("shows permission errors without displaying the list snapshot as fresh details", async () => {
    getAdminUser.mockRejectedValue({ response: { status: 403 } });
    renderSection();
    fireEvent.click(await findRow());
    expect((await screen.findByRole("alert")).textContent).toContain("permission");
  });

  it("retries failed detail requests", async () => {
    getAdminUser.mockRejectedValueOnce(new Error("Offline"));
    renderSection();
    fireEvent.click(await findRow());
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Grace Hopper")).toBeDefined();
    expect(getAdminUser).toHaveBeenCalledTimes(2);
  });
});

describe("UsersSection — suspend", () => {
  it("requires a reason, sends it with the suspend call, and closes on success", async () => {
    suspendUser.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Suspend"));

    expect(screen.getByText("Suspend User")).toBeTruthy();
    const textarea = screen.getByPlaceholderText("Why is this user being suspended?");
    const form = textarea.closest("form");
    const submit = within(form).getByRole("button", { name: "Suspend" });
    expect(submit.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "Abusive content" } });
    expect(submit.disabled).toBe(false);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(suspendUser).toHaveBeenCalledWith("user-1", { reason: "Abusive content" }),
    );
    await waitFor(() => expect(screen.queryByText("Suspend User")).toBeNull());
  });

  it("keeps the modal open when the suspend API call fails", async () => {
    suspendUser.mockRejectedValue({ response: { status: 400, data: { message: "nope" } } });
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Suspend"));

    const textarea = screen.getByPlaceholderText("Why is this user being suspended?");
    fireEvent.change(textarea, { target: { value: "spam" } });
    fireEvent.submit(textarea.closest("form"));

    await waitFor(() => expect(suspendUser).toHaveBeenCalled());
    expect(screen.getByText("Suspend User")).toBeTruthy();
  });

  it("cancels without calling the API", async () => {
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Suspend"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Suspend User")).toBeNull();
    expect(suspendUser).not.toHaveBeenCalled();
  });
});

describe("UsersSection — unsuspend / delete / anonymize", () => {
  it("unsuspends a suspended user and closes the confirm modal", async () => {
    unsuspendUser.mockResolvedValue({});
    getAdminUsers.mockResolvedValue(page([userFixture({ accountNonLocked: false })]));
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Unsuspend" }));

    expect(screen.getByText("Unsuspend User")).toBeTruthy();
    const overlay = screen.getByText("Unsuspend User").closest("div.fixed");
    fireEvent.click(within(overlay).getByRole("button", { name: "Unsuspend" }));

    await waitFor(() => expect(unsuspendUser).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(screen.queryByText("Unsuspend User")).toBeNull());
  });

  it("marks an account for deletion only after the identifier is typed", async () => {
    markUserForDeletion.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Mark for deletion…"));

    expect(screen.getByText("Mark Ada Lovelace for deletion?")).toBeTruthy();
    const input = screen.getByPlaceholderText("Type the email to confirm");
    const form = input.closest("form");
    const submit = within(form).getByRole("button", { name: "Mark for deletion" });
    expect(submit.disabled).toBe(true);

    // A near-miss keeps the destructive button armed-off.
    fireEvent.change(input, { target: { value: "ada@wrong.example.com" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "ada@example.com" } });
    expect(submit.disabled).toBe(false);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(markUserForDeletion).toHaveBeenCalledWith("user-1", {
        reason: "Confirmed by typing the account identifier before deletion",
      }),
    );
    await waitFor(() => expect(screen.queryByText("Mark Ada Lovelace for deletion?")).toBeNull());
  });

  it("deletes an account permanently with a required reason", async () => {
    anonymizeUser.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(openMenu(row, "Delete user…"));

    expect(screen.getByText("Delete User")).toBeTruthy();
    const textarea = screen.getByPlaceholderText(
      "Why is this account being permanently deleted now?",
    );
    const form = textarea.closest("form");
    expect(within(form).getByRole("button", { name: "Delete user" }).disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "Data subject verified" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(anonymizeUser).toHaveBeenCalledWith("user-1", {
        reason: "Data subject verified",
      }),
    );
    await waitFor(() => expect(screen.queryByText("Delete User")).toBeNull());
  });
});

// The badge is derived from status + accountNonLocked (see userStatus() in
// platform-admin/shared.js). Suspension is NOT a status value and never
// touches `enabled`, so reading `enabled` alone — which the table used to do —
// rendered every suspended account as "Active".
describe("UsersSection — lifecycle status badge", () => {
  it("shows Active for an unlocked, enabled account", async () => {
    renderSection();
    const row = await findRow();
    expect(within(row).getByText("Active")).toBeTruthy();
  });

  it("shows Suspended for a locked account even though enabled is still true", async () => {
    getAdminUsers.mockResolvedValue(page([userFixture({ accountNonLocked: false })]));
    renderSection();

    const row = await findRow();
    expect(within(row).getByText("Suspended")).toBeTruthy();
    expect(within(row).queryByText("Active")).toBeNull();
  });

  it("shows Pending Deletion for a disabled account", async () => {
    // enabled=false is set only by the backend deletion flow, so it is the
    // pending-deletion signal until UserDto serializes `status`.
    getAdminUsers.mockResolvedValue(page([userFixture({ enabled: false })]));
    renderSection();

    const row = await findRow();
    expect(within(row).getByText("Pending Deletion")).toBeTruthy();
  });

  it("prefers a serialized status over the enabled fallback", async () => {
    // Forward path: once UserMapper sends `status`, it must win over the
    // enabled=false heuristic — otherwise a restored account (status ACTIVE,
    // enabled still false until the next save) would keep reading as deleted.
    getAdminUsers.mockResolvedValue(page([userFixture({ status: "ACTIVE", enabled: false })]));
    renderSection();

    const row = await findRow();
    expect(within(row).getByText("Active")).toBeTruthy();
  });
});

describe("UsersSection — recovery actions are contextual", () => {
  it("offers Unsuspend, not Suspend, on a suspended row", async () => {
    getAdminUsers.mockResolvedValue(page([userFixture({ accountNonLocked: false })]));
    renderSection();

    const row = await findRow();
    expect(within(row).getByRole("button", { name: "Unsuspend" })).toBeTruthy();
    // Re-suspending would 400 ("User is already suspended").
    fireEvent.click(within(row).getByRole("button", { name: /^Actions for/ }));
    expect(within(row).queryByRole("button", { name: "Suspend", exact: true })).toBeNull();
  });

  it("restores a pending-deletion account through the restore endpoint", async () => {
    restoreUser.mockResolvedValue({});
    getAdminUsers.mockResolvedValue(page([userFixture({ enabled: false })]));
    renderSection();

    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(restoreUser).toHaveBeenCalledWith("user-1"));
    expect(unsuspendUser).not.toHaveBeenCalled();
  });

  it("shows no recovery button on an active account", async () => {
    renderSection();
    const row = await findRow();

    expect(within(row).queryByRole("button", { name: "Restore" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Unsuspend" })).toBeNull();
  });

  it("omits Mark for deletion on a pending-deletion account, which would 409", async () => {
    getAdminUsers.mockResolvedValue(page([userFixture({ enabled: false })]));
    renderSection();

    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: /^Actions for/ }));

    // Mark for deletion only on ACTIVE; pending-deletion shows only Delete user (irreversible)
    expect(within(row).queryByRole("button", { name: "Mark for deletion…" })).toBeNull();
    // The irreversible delete action IS available on pending-deletion.
    expect(within(row).getByRole("button", { name: "Delete user…" })).toBeTruthy();
  });
});
