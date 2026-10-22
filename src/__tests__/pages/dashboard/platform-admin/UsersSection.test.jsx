import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersSection from "../../../../pages/dashboard/platform-admin/UsersSection";
vi.mock("../../../../store/AuthContext", () => ({
  useAuth: () => ({ user: { role: "OPERATIONS_ADMIN" } }),
}));
import {
  getAdminUsers,
  suspendUser,
  unsuspendUser,
  markUserForDeletion,
  anonymizeUser,
} from "../../../../api/admin";

// Platform-admin user moderation: every destructive action (suspend,
// unsuspend, mark-for-deletion, anonymize) is gated behind a confirm modal
// with a required reason, and a 403 renders the Access-denied shell instead
// of a broken table. Mock the api module (not the hooks) so the real
// mutation onSuccess/invalidate wiring is exercised.

vi.mock("../../../../api/admin", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAdminUsers: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
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
    enabled: true,
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

beforeEach(() => {
  getAdminUsers.mockResolvedValue(page([userFixture()]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UsersSection — rendering", () => {
  it("renders a user row with status, verification, and community count", async () => {
    renderSection();
    const row = await findRow();

    expect(within(row).getByText("Ada Lovelace")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();
    expect(within(row).getByText("Yes")).toBeTruthy();
    expect(within(row).getByText("2")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Suspend" })).toBeTruthy();
  });

  it("renders the Access denied shell on a 403", async () => {
    getAdminUsers.mockRejectedValue({ response: { status: 403 } });
    renderSection();

    expect(await screen.findByText("Access denied")).toBeTruthy();
    expect(screen.getByText("Platform admin rights required to view this data.")).toBeTruthy();
    expect(suspendUser).not.toHaveBeenCalled();
  });
});

describe("UsersSection — suspend", () => {
  it("requires a reason, sends it with the suspend call, and closes on success", async () => {
    suspendUser.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Suspend" }));

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
    fireEvent.click(within(row).getByRole("button", { name: "Suspend" }));

    const textarea = screen.getByPlaceholderText("Why is this user being suspended?");
    fireEvent.change(textarea, { target: { value: "spam" } });
    fireEvent.submit(textarea.closest("form"));

    await waitFor(() => expect(suspendUser).toHaveBeenCalled());
    expect(screen.getByText("Suspend User")).toBeTruthy();
  });

  it("cancels without calling the API", async () => {
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Suspend" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Suspend User")).toBeNull();
    expect(suspendUser).not.toHaveBeenCalled();
  });
});

describe("UsersSection — unsuspend / delete / anonymize", () => {
  it("unsuspends a suspended user and closes the confirm modal", async () => {
    unsuspendUser.mockResolvedValue({});
    getAdminUsers.mockResolvedValue(page([userFixture({ enabled: false })]));
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Unsuspend" }));

    expect(screen.getByText("Unsuspend User")).toBeTruthy();
    const overlay = screen.getByText("Unsuspend User").closest("div.fixed");
    fireEvent.click(within(overlay).getByRole("button", { name: "Unsuspend" }));

    await waitFor(() => expect(unsuspendUser).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(screen.queryByText("Unsuspend User")).toBeNull());
  });

  it("marks an account for deletion with a required reason", async () => {
    markUserForDeletion.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Mark User for Deletion")).toBeTruthy();
    const textarea = screen.getByPlaceholderText("Why is this account being marked for deletion?");
    const form = textarea.closest("form");
    expect(within(form).getByRole("button", { name: "Mark for Deletion" }).disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "GDPR request" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(markUserForDeletion).toHaveBeenCalledWith("user-1", { reason: "GDPR request" }),
    );
    await waitFor(() => expect(screen.queryByText("Mark User for Deletion")).toBeNull());
  });

  it("anonymizes an account with a required reason", async () => {
    anonymizeUser.mockResolvedValue({});
    renderSection();
    const row = await findRow();
    fireEvent.click(within(row).getByRole("button", { name: "Anonymize" }));

    expect(screen.getByText("Anonymize User")).toBeTruthy();
    const textarea = screen.getByPlaceholderText("Why is this account being anonymized now?");
    const form = textarea.closest("form");
    expect(within(form).getByRole("button", { name: "Anonymize Now" }).disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "Data subject verified" } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(anonymizeUser).toHaveBeenCalledWith("user-1", {
        reason: "Data subject verified",
      }),
    );
    await waitFor(() => expect(screen.queryByText("Anonymize User")).toBeNull());
  });
});
