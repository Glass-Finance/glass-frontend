import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OverviewSection from "../../../../pages/dashboard/platform-admin/OverviewSection";
import * as admin from "../../../../api/admin";

vi.mock("../../../../api/admin", async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminAuditLogs: vi.fn(),
  getAdminBalances: vi.fn(),
  getAdminCommunities: vi.fn(),
  getAdminKycAttempts: vi.fn(),
  getAdminObligations: vi.fn(),
  getAdminPaymentLinks: vi.fn(),
  getAdminReconciliationFindings: vi.fn(),
  getAdminReconciliationRuns: vi.fn(),
  getAdminTransactions: vi.fn(),
  getAdminUsers: vi.fn(),
}));

function totalEnvelope(totalElements) {
  return { data: { data: { content: [], totalElements, totalPages: 1 } } };
}

function listEnvelope(content, totalElements = content.length) {
  return { data: { data: { content, totalElements, totalPages: 1 } } };
}

const EXPIRED_LINKS = [
  { id: "pl-1", title: "Departmental Dues" },
  { id: "pl-2", title: "Football Levy" },
  { id: "pl-3", title: "Library Fees" },
  { id: "pl-4", title: "Test Funds" },
];

const OVERDUE_OBLIGATIONS = [
  { id: "ob-1", community: { name: "Wesley reading club" } },
  { id: "ob-2", community: { name: "Microsoft Developer Group" } },
];

const RUNS = ["2026-10-23", "2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19"].map(
  (day, i) => ({
    id: `run-${i + 1}`,
    runType: "FULL",
    startedAt: `${day}T03:00:00.000Z`,
    windowFrom: "2026-10-09",
    windowTo: day,
    residual: 0,
    findingsTotal: 0,
    status: "COMPLETED",
  }),
);

const ACTIVITY = [
  {
    id: "log-1",
    event: "LOGIN",
    platformRoleName: "Super Admin",
    result: "SUCCESS",
    entityType: "SESSION",
    occurredAt: "2026-10-26T13:44:00.000Z",
  },
  {
    id: "log-2",
    event: "USER_SUSPENDED",
    platformRoleName: "Ops Admin",
    result: "SUCCESS",
    entityType: "USER",
    occurredAt: "2026-10-26T13:46:00.000Z",
  },
  {
    id: "log-3",
    event: "REFRESH_TOKEN_CREATED",
    platformRoleName: "Super Admin",
    result: "SUCCESS",
    entityType: "SESSION",
    occurredAt: "2026-10-26T13:41:00.000Z",
  },
  {
    id: "log-4",
    event: "REFRESH_TOKEN_CREATED",
    platformRoleName: "Super Admin",
    result: "SUCCESS",
    entityType: "SESSION",
    occurredAt: "2026-10-26T13:42:00.000Z",
  },
  {
    id: "log-5",
    event: "TOKEN_ROTATED",
    platformRoleName: "Super Admin",
    result: "SUCCESS",
    entityType: "SESSION",
    occurredAt: "2026-10-26T13:43:00.000Z",
  },
];

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(OverviewSection)),
    ),
  );
}

beforeEach(() => {
  admin.getAdminCommunities.mockResolvedValue(totalEnvelope(10));
  admin.getAdminUsers.mockResolvedValue(totalEnvelope(60));
  admin.getAdminPaymentLinks.mockImplementation((params = {}) => {
    if (params.status === "ACTIVE") return Promise.resolve(totalEnvelope(2));
    if (params.status === "EXPIRED") {
      if (params.pageSize === 4) return Promise.resolve(listEnvelope(EXPIRED_LINKS));
      return Promise.resolve(totalEnvelope(4));
    }
    return Promise.resolve(totalEnvelope(6));
  });
  admin.getAdminTransactions.mockImplementation((params = {}) => {
    if (params.status === "ABANDONED") return Promise.resolve(totalEnvelope(1));
    if (params.status === "FAILED") {
      return Promise.resolve(
        listEnvelope([
          {
            id: "txn-fail-1",
            community: { name: "Wesley reading club" },
            amount: 2000,
            currency: "NGN",
          },
        ]),
      );
    }
    return Promise.resolve(totalEnvelope(18));
  });
  admin.getAdminObligations.mockImplementation((params = {}) => {
    if (params.status === "OVERDUE") {
      return Promise.resolve(listEnvelope(OVERDUE_OBLIGATIONS, 2));
    }
    return Promise.resolve(totalEnvelope(16));
  });
  admin.getAdminKycAttempts.mockResolvedValue(totalEnvelope(0));
  admin.getAdminReconciliationFindings.mockResolvedValue(totalEnvelope(0));
  admin.getAdminReconciliationRuns.mockResolvedValue(listEnvelope(RUNS, 83));
  admin.getAdminAuditLogs.mockResolvedValue(listEnvelope(ACTIVITY, 4118));
  admin.getAdminBalances.mockResolvedValue({
    data: {
      data: {
        currency: "NGN",
        residual: 0,
        reconciles: true,
        balances: [
          { code: "PROCESSOR_FEE", displayName: "Processor fees", amount: 8.1, currency: "NGN" },
          { code: "MEMBER_INFLOW", displayName: "Gross collected", amount: 540, currency: "NGN" },
          {
            code: "NET_PAYABLE",
            displayName: "Net pending settlement",
            amount: 0,
            currency: "NGN",
          },
          {
            code: "PLATFORM_COMMISSION",
            displayName: "Platform commission",
            amount: 31.9,
            currency: "NGN",
          },
          {
            code: "SETTLED_TO_BANK",
            displayName: "Settled to bank",
            amount: 500,
            currency: "NGN",
          },
        ],
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OverviewSection", () => {
  it("renders the stat cards and the issue rows that actually exist", async () => {
    renderSection();

    expect(await screen.findByRole("heading", { name: "Overview", level: 1 })).toBeTruthy();
    // Each panel resolves its own query — wait for the two whose data drives
    // the assertions below before reading synchronously.
    expect(await screen.findByText("Registered on the platform")).toBeTruthy();
    expect(await screen.findByText("3 open")).toBeTruthy();

    expect(screen.getByText("Registered users")).toBeTruthy();
    expect(screen.getByText("2 active · 4 expired")).toBeTruthy();
    expect(screen.getAllByText("Across all communities")).toHaveLength(2);
    expect(screen.getByText("Queue is empty")).toBeTruthy();

    expect(screen.getByText("Unpaid obligations past due")).toBeTruthy();
    expect(
      screen.getByText(
        "Wesley reading club and Microsoft Developer Group both have overdue obligations.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Recent payments abandoned")).toBeTruthy();
    expect(screen.getByText(/1 abandoned, 1 failed/)).toBeTruthy();
    expect(screen.getByText("4 of 6 payment links have expired")).toBeTruthy();
    expect(
      screen.getByText(
        "Departmental Dues, Football Levy, Library Fees and Test Funds are no longer collecting.",
      ),
    ).toBeTruthy();

    // The queue row is always on, and reads clear when both backlogs are 0.
    expect(screen.getByText("Reconciliation and KYC queue")).toBeTruthy();
    expect(screen.getByText("Clear")).toBeTruthy();
    expect(screen.getByText("0 findings · 0 in review")).toBeTruthy();

    expect(screen.getByRole("link", { name: "Review obligations" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open payment links" })).toBeTruthy();
  });

  it("lists platform money in the design's order and marks it reconciled", async () => {
    renderSection();

    expect(await screen.findByText("Gross collected")).toBeTruthy();
    expect(screen.getByText("Reconciled")).toBeTruthy();

    const moneyPanel = screen.getByText("Platform money").closest("section");
    const text = moneyPanel.textContent;
    const order = [
      "₦0.00", // residual
      "Gross collected",
      "Settled to bank",
      "Net pending settlement",
      "Platform commission",
      "Processor fees",
    ].map((label) => text.indexOf(label));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    expect(within(moneyPanel).getAllByText("₦540.00")).toHaveLength(1);
    expect(within(moneyPanel).getAllByText("₦500.00")).toHaveLength(1);
    expect(within(moneyPanel).getAllByText("₦31.90")).toHaveLength(1);
    expect(within(moneyPanel).getAllByText("₦8.10")).toHaveLength(1);
    expect(within(moneyPanel).getAllByText("₦0.00")).toHaveLength(2); // residual + net pending
    expect(screen.getByRole("link", { name: "Open balances" })).toBeTruthy();
  });

  it("shows the runs table and groups token activity behind Show all", async () => {
    renderSection();

    expect(await screen.findByText("All 83 runs")).toBeTruthy();
    expect(await screen.findByText("4,118 logs")).toBeTruthy();

    expect(screen.getAllByText("✓ Completed")).toHaveLength(5);
    expect(screen.getAllByText(/\d{2} Oct 2026 – \d{2} Oct 2026/)).toHaveLength(5);

    expect(screen.getByText("Super Admin signed in")).toBeTruthy();
    expect(screen.getByText("Login · Success")).toBeTruthy();
    expect(screen.getByText("User suspended")).toBeTruthy();
    expect(screen.getByText("Ops Admin · Success")).toBeTruthy();

    // Token rows collapse to one group row until expanded.
    expect(screen.getAllByText("Refresh token created")).toHaveLength(1);
    expect(screen.getByText("Super Admin · 3 events")).toBeTruthy();
    expect(screen.queryByText("Token rotated")).toBeNull();
    expect(
      screen.getByText(
        "Refresh-token events are grouped by default. Actors show as names, not UUIDs.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getAllByText("Refresh token created")).toHaveLength(3); // group + 2 rows
    expect(screen.getByText("Token rotated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });
});
