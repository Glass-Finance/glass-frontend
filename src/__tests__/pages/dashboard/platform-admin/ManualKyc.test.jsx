import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersSection from "../../../../pages/dashboard/platform-admin/UsersSection";
import KycSection from "../../../../pages/dashboard/platform-admin/KycSection";
import * as api from "../../../../api/admin";

const actor = vi.hoisted(() => ({ role: "OPERATIONS_ADMIN" }));
vi.mock("../../../../store/AuthContext", () => ({ useAuth: () => ({ user: actor }) }));
vi.mock("../../../../api/admin", async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  getAdminKycAttempts: vi.fn(),
  getAdminKycAttempt: vi.fn(),
  approveKycBypass: vi.fn(),
  revokeKyc: vi.fn(),
  decideKyc: vi.fn(),
}));

const userId = "22222222-2222-4222-8222-222222222222";
const attemptId = "11111111-1111-4111-8111-111111111111";
const response = (data) => ({ data: { data } });
const target = (overrides = {}) => ({
  id: userId,
  email: "ada@example.com",
  platformRole: "USER",
  enabled: true,
  userData: { firstName: "Ada", lastName: "Okafor" },
  kycStatus: "NOT_STARTED",
  ...overrides,
});
const attempt = (overrides = {}) => ({
  id: attemptId,
  user: { id: userId, firstName: "Ada", lastName: "Okafor", email: "ada@example.com" },
  status: "IN_REVIEW",
  canApprove: true,
  ...overrides,
});
function renderPage(Component = UsersSection) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
  return client;
}
async function openApproval() {
  // UsersSection: the action lives in the row overflow menu (list loads
  // async). KycSection: it's a direct button inside the attempt dialog.
  const menuTrigger = await screen.findByRole("button", { name: /^Actions for/ }).catch(() => null);
  if (menuTrigger) fireEvent.click(menuTrigger);
  fireEvent.click(await screen.findByRole("button", { name: "Approve manually" }));
  return screen.findByRole("dialog");
}
function submit(dialog, reason = "  Reviewed offline  ") {
  fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole("button", { name: /^(Approve manually|Revoke KYC)$/ }));
}
beforeEach(() => {
  vi.resetAllMocks();
  actor.role = "OPERATIONS_ADMIN";
  api.getAdminUsers.mockResolvedValue(response({ content: [target()], totalElements: 1 }));
  api.getAdminUser.mockResolvedValue(response(target()));
  api.getAdminKycAttempts.mockResolvedValue(response({ content: [attempt()], totalElements: 1 }));
  api.getAdminKycAttempt.mockResolvedValue(response(attempt()));
  api.approveKycBypass.mockResolvedValue(
    response({ status: "APPROVED", attemptId: null, decisionReason: null, revokedReason: null }),
  );
  api.revokeKyc.mockResolvedValue(response({ status: "REVOKED", attemptId: null }));
  api.decideKyc.mockResolvedValue(response({ status: "APPROVED" }));
});
afterEach(cleanup);

describe("manual KYC approval", () => {
  it.each(["NOT_STARTED", "PENDING", "IN_REVIEW", "REJECTED", "ERROR", "EXPIRED", "REVOKED"])(
    "approves account status %s without requiring an attempt",
    async (status) => {
      api.getAdminUsers.mockResolvedValue(response({ content: [target({ kycStatus: status })] }));
      api.getAdminUser.mockResolvedValue(response(target({ kycStatus: status })));
      renderPage();
      const dialog = await openApproval();
      await within(dialog).findByLabelText("Reason");
      expect(within(dialog).getByText(userId)).toBeTruthy();
      expect(within(dialog).getByText("ada@example.com")).toBeTruthy();
      const confirm = within(dialog).getByRole("button", { name: "Approve manually" });
      expect(confirm.disabled).toBe(true);
      fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "   " } });
      expect(confirm.disabled).toBe(true);
      submit(dialog);
      await waitFor(() =>
        expect(api.approveKycBypass).toHaveBeenCalledWith(userId, { reason: "Reviewed offline" }),
      );
      expect(await within(dialog).findByText("KYC approved")).toBeTruthy();
      expect(within(dialog).getByText("No verification attempt")).toBeTruthy();
      expect(api.getAdminKycAttempt).not.toHaveBeenCalled();
    },
  );

  it("waits for fresh user data and prevents submitting stale approval eligibility", async () => {
    let resolveUser;
    api.getAdminUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );
    renderPage();
    const dialog = await openApproval();
    expect(within(dialog).queryByLabelText("Reason")).toBeNull();
    resolveUser(response(target({ kycStatus: "APPROVED" })));
    await within(dialog).findByText(/already approved/i);
    expect(api.approveKycBypass).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole("button", { name: "Approve manually" })).toBeNull();
  });

  it("blocks repeat submissions while approval is pending", async () => {
    api.approveKycBypass.mockReturnValue(new Promise(() => {}));
    renderPage();
    const dialog = await openApproval();
    await within(dialog).findByLabelText("Reason");
    submit(dialog);
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /Approve manually/ }).disabled).toBe(true),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /Approve manually/ }));
    expect(api.approveKycBypass).toHaveBeenCalledTimes(1);
  });

  it("refreshes user and attempt caches after approval and shows the retained bypass reason", async () => {
    api.approveKycBypass.mockResolvedValue(
      response({ status: "APPROVED", attemptId, decisionReason: "Admin bypass: Reviewed offline" }),
    );
    const client = renderPage();
    client.setQueryData(["admin-kyc-attempts", {}], { content: [] });
    client.setQueryData(["admin-kyc-attempt", attemptId], attempt());
    const dialog = await openApproval();
    await within(dialog).findByLabelText("Reason");
    submit(dialog);
    expect(await within(dialog).findByText("Admin bypass: Reviewed offline")).toBeTruthy();
    expect(within(dialog).getByText(attemptId)).toBeTruthy();
    await waitFor(() => expect(api.getAdminUsers.mock.calls.length).toBeGreaterThan(1));
    expect(api.getAdminUser.mock.calls.length).toBeGreaterThan(1);
    expect(client.getQueryState(["admin-kyc-attempts", {}]).isInvalidated).toBe(true);
    expect(client.getQueryState(["admin-kyc-attempt", attemptId]).isInvalidated).toBe(true);
  });

  it("refreshes on conflict and requires reviewing refreshed state before retry", async () => {
    api.approveKycBypass.mockRejectedValueOnce({ response: { status: 409 } });
    renderPage();
    const dialog = await openApproval();
    await within(dialog).findByLabelText("Reason");
    submit(dialog);
    const review = await within(dialog).findByRole("button", { name: "Review refreshed state" });
    await waitFor(() => expect(review.disabled).toBe(false));
    expect(api.getAdminUser.mock.calls.length).toBeGreaterThan(1);
    expect(within(dialog).queryByRole("button", { name: "Approve manually" })).toBeNull();
    fireEvent.click(review);
    submit(dialog);
    await waitFor(() => expect(api.approveKycBypass).toHaveBeenCalledTimes(2));
  });

  it.each([400, 403, 404, 500])(
    "keeps the reason and displays HTTP %s failures without success",
    async (status) => {
      api.approveKycBypass.mockRejectedValue({ response: { status } });
      renderPage();
      const dialog = await openApproval();
      await within(dialog).findByLabelText("Reason");
      submit(dialog);
      expect(await within(dialog).findByRole("alert")).toBeTruthy();
      expect(within(dialog).getByLabelText("Reason").value).toBe("  Reviewed offline  ");
      expect(within(dialog).queryByText("KYC approved")).toBeNull();
    },
  );

  it.each(["COMPLIANCE_ADMIN", "SUPPORT_AGENT", "USER", "UNKNOWN", undefined])(
    "hides actions for actor role %s",
    async (role) => {
      actor.role = role;
      renderPage();
      await screen.findByText("ada@example.com");
      fireEvent.click(await screen.findByRole("button", { name: /^Actions for/ }));
      expect(screen.queryByRole("button", { name: "Approve manually" })).toBeNull();
      expect(api.getAdminUser).not.toHaveBeenCalled();
    },
  );

  it.each([
    { platformRole: "OPERATIONS_ADMIN" },
    { platformRole: null },
    { userData: null },
    { enabled: false },
    { kycStatus: null },
    { kycStatus: "UNKNOWN" },
  ])("hides approval for ineligible or unknown target data %j", async (overrides) => {
    api.getAdminUsers.mockResolvedValue(response({ content: [target(overrides)] }));
    renderPage();
    await screen.findByText("ada@example.com");
    fireEvent.click(await screen.findByRole("button", { name: /^Actions for/ }));
    expect(screen.queryByRole("button", { name: "Approve manually" })).toBeNull();
  });
});

describe("user-level KYC revocation", () => {
  it("revokes profile-only approval with a trimmed reason", async () => {
    const approved = target({ kycStatus: "APPROVED" });
    api.getAdminUsers.mockResolvedValue(response({ content: [approved] }));
    api.getAdminUser.mockResolvedValue(response(approved));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /^Actions for/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Revoke KYC", exact: true }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Reason");
    submit(dialog, "  Approval withdrawn  ");
    await waitFor(() =>
      expect(api.revokeKyc).toHaveBeenCalledWith(userId, { reason: "Approval withdrawn" }),
    );
    expect(await within(dialog).findByText("KYC revoked")).toBeTruthy();
    expect(within(dialog).getByText("No verification attempt")).toBeTruthy();
  });
});

describe("KYC attempt actions", () => {
  async function openAttempt() {
    renderPage(KycSection);
    fireEvent.click(await screen.findByRole("button", { name: /Review/ }));
    await screen.findByText("KYC attempt");
  }
  it("keeps evidence approval and manual approval separate", async () => {
    await openAttempt();
    expect(await screen.findByRole("button", { name: "Approve manually" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve", exact: true }));
    fireEvent.change(screen.getByLabelText("User-visible reason"), {
      target: { value: "Evidence reviewed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(api.decideKyc).toHaveBeenCalledWith(attemptId, {
        decision: "APPROVE",
        reason: "Evidence reviewed",
      }),
    );
    expect(api.approveKycBypass).not.toHaveBeenCalled();
  });
  it.each(["INITIATED", "PROCESSING", "IN_REVIEW", "REJECTED", "ERROR", "EXPIRED", "REVOKED"])(
    "allows bypass from %s despite evidence-review blockers",
    async (status) => {
      api.getAdminKycAttempt.mockResolvedValue(
        response(
          attempt({ status, canApprove: false, approvalBlockingReasons: ["ID_NUMBER_MISSING"] }),
        ),
      );
      await openAttempt();
      expect(screen.queryByRole("button", { name: "Approve", exact: true })).toBeNull();
      const dialog = await openApproval();
      await within(dialog).findByLabelText("Reason");
      expect(within(dialog).getByText(/regardless of verification stage/i)).toBeTruthy();
      submit(dialog);
      await waitFor(() =>
        expect(api.approveKycBypass).toHaveBeenCalledWith(userId, { reason: "Reviewed offline" }),
      );
    },
  );
  it("uses account status when a historical attempt disagrees", async () => {
    api.getAdminUser.mockResolvedValue(response(target({ kycStatus: "APPROVED" })));
    api.getAdminKycAttempt.mockResolvedValue(response(attempt({ status: "REJECTED" })));
    await openAttempt();
    expect(await screen.findByRole("button", { name: "Revoke KYC" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve manually" })).toBeNull();
  });
  it("does not offer revocation based on a historical approved attempt", async () => {
    api.getAdminKycAttempt.mockResolvedValue(response(attempt({ status: "APPROVED" })));
    await openAttempt();
    await screen.findByRole("button", { name: "Approve manually" });
    expect(screen.queryByRole("button", { name: /^Revoke/ })).toBeNull();
  });
  it("displays the current account status in the confirmation", async () => {
    renderPage();
    const dialog = await openApproval();
    expect(await within(dialog).findByText("Current KYC: Not started")).toBeTruthy();
  });
});
