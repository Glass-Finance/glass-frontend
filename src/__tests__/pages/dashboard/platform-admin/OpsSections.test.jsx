import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionsSection from "../../../../pages/dashboard/platform-admin/TransactionsSection";
import ObligationsSection from "../../../../pages/dashboard/platform-admin/ObligationsSection";
import AuditLogsSection from "../../../../pages/dashboard/platform-admin/AuditLogsSection";
import {
  getAdminTransactions,
  getAdminTransaction,
  exportAdminTransactions,
  getAdminObligations,
  getAdminObligation,
  exportAdminObligations,
  getAdminAuditLogs,
  getAdminAuditLog,
  exportAdminAuditLogs,
} from "../../../../api/admin";

// The three platform-wide ops tabs (transactions, obligations, audit logs).
// What these pin, beyond "the table renders":
//
//  - pageNumber is sent 1-based. These three DTOs extend the same PageQueryDto
//    as every other admin list, so pageNumber=0 is the 400 "Illegal Argument
//    Entered" the groups pagination bug turned on.
//  - Status/result filters only send a value when one is actually selected.
//  - A rejected code is cleared, and a 403 renders the Access-denied shell
//    rather than an empty table that looks like "no data".
//  - The audit-log detail renders the old/new JSON as text, never as markup —
//    that payload is free-form and can carry user-supplied strings.

vi.mock("../../../../api/admin", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAdminTransactions: vi.fn(),
    getAdminTransaction: vi.fn(),
    exportAdminTransactions: vi.fn(),
    getAdminObligations: vi.fn(),
    getAdminObligation: vi.fn(),
    exportAdminObligations: vi.fn(),
    getAdminAuditLogs: vi.fn(),
    getAdminAuditLog: vi.fn(),
    exportAdminAuditLogs: vi.fn(),
  };
});

function page(content, totalPages = 1) {
  return { data: { data: { content, totalElements: content.length, totalPages } } };
}

function transactionFixture(overrides = {}) {
  return {
    id: "txn-1",
    internalReference: "GLASS-REF-001",
    status: "SUCCESSFUL",
    amount: 500000,
    baseAmount: 450000,
    billedAmount: 500000,
    net: 450000,
    platformFee: 25000,
    processorFee: 25000,
    currency: "NGN",
    channel: "CARD",
    provider: "PAYSTACK",
    amountMode: "FIXED",
    internalRef: "GLASS-REF-001",
    community: { id: "c1", name: "Acme Group" },
    member: { firstName: "ada", lastName: "lovelace", email: "ada@example.com" },
    createdAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

function obligationFixture(overrides = {}) {
  return {
    id: "obl-1",
    status: "OVERDUE",
    amount: 100000,
    amountPaid: 40000,
    amountMode: "FIXED",
    attemptCount: 3,
    autoDebitAttemptCount: 2,
    manualAttemptCount: 1,
    dueAt: "2026-01-10T10:00:00.000Z",
    community: { id: "c1", name: "Acme Group" },
    member: { firstName: "ada", lastName: "lovelace", memberRef: "ACM-001" },
    ...overrides,
  };
}

function auditFixture(overrides = {}) {
  return {
    id: "log-1",
    event: "KYC_APPROVED",
    description: "KYC attempt approved",
    result: "SUCCESS",
    entityType: "KycAttempt",
    platformRoleName: "COMPLIANCE_ADMIN",
    occurredAt: "2026-01-06T09:30:00.000Z",
    ...overrides,
  };
}

function renderSection(Component) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TransactionsSection", () => {
  beforeEach(() => {
    getAdminTransactions.mockResolvedValue(page([transactionFixture()]));
  });

  it("sends pageNumber 1-based on first load", async () => {
    renderSection(TransactionsSection);
    await screen.findByText("GLASS-REF-001");

    // Page state is 0-indexed locally, so the first request must be
    // pageNumber: 1 — sending 0 is the 400 the backend rejects.
    expect(getAdminTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
    );
  });

  it("omits the status filter until one is chosen", async () => {
    renderSection(TransactionsSection);
    await screen.findByText("GLASS-REF-001");

    expect(getAdminTransactions.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("sends the chosen status, and drops it again when reset to All", async () => {
    renderSection(TransactionsSection);
    await screen.findByText("GLASS-REF-001");

    fireEvent.change(await screen.findByDisplayValue("All statuses"), {
      target: { value: "FAILED" },
    });
    await waitFor(() =>
      expect(getAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "FAILED", pageNumber: 1 }),
      ),
    );

    fireEvent.change(screen.getByDisplayValue("Failed"), { target: { value: "ALL" } });

    // Resetting to All rebuilds params identical to the very first load, so
    // React Query serves the cached first page and deliberately issues no new
    // request. Assert the filter is off rather than counting calls: every
    // request actually made must never carry a status other than the one
    // currently selected.
    await waitFor(() => expect(screen.getByDisplayValue("All statuses")).toBeDefined());
    for (const [params] of getAdminTransactions.mock.calls) {
      expect([undefined, "FAILED"]).toContain(params.status);
    }
  });

  it("renders payer, community, amount and status", async () => {
    renderSection(TransactionsSection);
    const ref = await screen.findByText("GLASS-REF-001");
    const row = ref.closest("tr");

    expect(row.textContent).toContain("Acme Group");
    expect(row.textContent).toContain("ada lovelace");
    expect(row.textContent).toContain("SUCCESSFUL");
    expect(row.textContent).toContain("₦500,000.00");
  });

  it("falls back to the user placeholder when there is no member", async () => {
    getAdminTransactions.mockResolvedValue(
      page([transactionFixture({ member: null, user: { firstName: "grace", email: "g@x.com" } })]),
    );
    renderSection(TransactionsSection);

    const ref = await screen.findByText("GLASS-REF-001");
    expect(ref.closest("tr").textContent).toContain("grace");
  });

  it("opens the detail modal and loads the full transaction", async () => {
    getAdminTransaction.mockResolvedValue({
      data: { data: transactionFixture({ gatewayReference: "PS_REF_99", failureReason: null }) },
    });
    renderSection(TransactionsSection);

    fireEvent.click(await screen.findByText("GLASS-REF-001"));

    expect(await screen.findByText("Gateway reference")).toBeDefined();
    expect(getAdminTransaction).toHaveBeenCalledWith("txn-1");
    expect(screen.getAllByText("₦500,000.00")).toHaveLength(3);
    expect(screen.getAllByText("₦450,000.00")).toHaveLength(2);
    expect(screen.getByText("₦50,000.00")).toBeDefined();
  });

  it("surfaces the failure reason when the transaction failed", async () => {
    getAdminTransaction.mockResolvedValue({
      data: { data: transactionFixture({ status: "FAILED", failureReason: "Insufficient funds" }) },
    });
    renderSection(TransactionsSection);

    fireEvent.click(await screen.findByText("GLASS-REF-001"));

    expect(await screen.findByText("Insufficient funds")).toBeDefined();
  });

  it("renders the Access-denied shell on a 403 instead of an empty table", async () => {
    getAdminTransactions.mockRejectedValue({ response: { status: 403 } });
    renderSection(TransactionsSection);

    expect(await screen.findByText("Access denied")).toBeDefined();
    expect(screen.queryByText("No transactions found")).toBeNull();
  });

  it("shows the empty state when the list comes back with no rows", async () => {
    getAdminTransactions.mockResolvedValue(page([]));
    renderSection(TransactionsSection);

    expect(await screen.findByText("No transactions found")).toBeDefined();
  });

  it("exports through the job flow, passing the current filters", async () => {
    exportAdminTransactions.mockResolvedValue({
      data: { data: { id: "job-1", status: "COMPLETED", fileData: { url: "https://x/y.csv" } } },
    });
    renderSection(TransactionsSection);
    await screen.findByText("GLASS-REF-001");

    fireEvent.change(await screen.findByDisplayValue("All statuses"), {
      target: { value: "ABANDONED" },
    });
    await waitFor(() =>
      expect(getAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ABANDONED" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    await waitFor(() =>
      expect(exportAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ABANDONED" }),
      ),
    );
  });
});

describe("ObligationsSection", () => {
  beforeEach(() => {
    getAdminObligations.mockResolvedValue(page([obligationFixture()]));
  });

  it("sends pageNumber 1-based on first load", async () => {
    renderSection(ObligationsSection);
    await screen.findByText("ACM-001");

    expect(getAdminObligations).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
    );
  });

  it("renders amount, amount paid, status, due date and attempt count", async () => {
    renderSection(ObligationsSection);
    const ref = await screen.findByText("ACM-001");
    const row = ref.closest("tr");

    expect(row.textContent).toContain("Acme Group");
    expect(row.textContent).toContain("OVERDUE");
    expect(row.textContent).toContain("₦100,000.00");
    expect(row.textContent).toContain("₦40,000.00");
    expect(row.textContent).toContain("3");
  });

  it("shows outstanding in the detail only when something is still owed", async () => {
    getAdminObligation.mockResolvedValue({ data: { data: obligationFixture() } });
    renderSection(ObligationsSection);

    fireEvent.click(await screen.findByText("ACM-001"));

    // 100000 owed, 40000 paid -> 60000 outstanding.
    expect(await screen.findByText("Outstanding")).toBeDefined();
  });

  it("shows no outstanding figure on a fully-paid obligation", async () => {
    getAdminObligation.mockResolvedValue({
      data: { data: obligationFixture({ amountPaid: 100000 }) },
    });
    renderSection(ObligationsSection);

    fireEvent.click(await screen.findByText("ACM-001"));

    await screen.findByText("Amount paid");
    // The card stays put (stable layout) but carries a dash rather than a
    // misleading ₦0.00 — nothing is owed on a settled obligation.
    const card = screen.getByText("Outstanding").parentElement;
    expect(card.textContent).toBe("Outstanding—");
  });

  it("shows the outstanding balance on a partially-paid obligation", async () => {
    getAdminObligation.mockResolvedValue({ data: { data: obligationFixture() } });
    renderSection(ObligationsSection);

    fireEvent.click(await screen.findByText("ACM-001"));

    const card = await screen.findByText("Outstanding").then((el) => el.parentElement);
    expect(card.textContent).not.toContain("—");
    expect(card.textContent).toContain("₦60,000.00");
  });

  it("shows the retry counters, since a spent obligation won't self-heal", async () => {
    getAdminObligation.mockResolvedValue({ data: { data: obligationFixture() } });
    renderSection(ObligationsSection);

    fireEvent.click(await screen.findByText("ACM-001"));

    expect(await screen.findByText("Auto-debit")).toBeDefined();
    expect(await screen.findByText("Manual")).toBeDefined();
  });

  it("renders the Access-denied shell on a 403", async () => {
    getAdminObligations.mockRejectedValue({ response: { status: 403 } });
    renderSection(ObligationsSection);

    expect(await screen.findByText("Access denied")).toBeDefined();
  });

  it("exports through the job flow, passing the current filters", async () => {
    exportAdminObligations.mockResolvedValue({
      data: { data: { id: "job-1", status: "COMPLETED", fileData: { url: "https://x/y.csv" } } },
    });
    renderSection(ObligationsSection);
    await screen.findByText("ACM-001");

    fireEvent.change(await screen.findByDisplayValue("All statuses"), {
      target: { value: "OVERDUE" },
    });
    await waitFor(() =>
      expect(getAdminObligations).toHaveBeenCalledWith(
        expect.objectContaining({ status: "OVERDUE" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    await waitFor(() =>
      expect(exportAdminObligations).toHaveBeenCalledWith(
        expect.objectContaining({ status: "OVERDUE" }),
      ),
    );
  });
});

describe("AuditLogsSection", () => {
  beforeEach(() => {
    getAdminAuditLogs.mockResolvedValue(page([auditFixture()]));
  });

  it("sends pageNumber 1-based on first load", async () => {
    renderSection(AuditLogsSection);
    await screen.findByText("KYC_APPROVED");

    expect(getAdminAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 1, pageSize: 20 }),
    );
  });

  it("renders event, description, entity and result", async () => {
    renderSection(AuditLogsSection);
    const event = await screen.findByText("KYC_APPROVED");
    const row = event.closest("tr");

    expect(row.textContent).toContain("KYC attempt approved");
    expect(row.textContent).toContain("KycAttempt");
    expect(row.textContent).toContain("Success");
  });

  it("omits result until a filter is chosen, then sends only valid enum values", async () => {
    renderSection(AuditLogsSection);
    await screen.findByText("KYC_APPROVED");

    expect(getAdminAuditLogs.mock.calls[0][0]).not.toHaveProperty("result");

    fireEvent.change(await screen.findByDisplayValue("All results"), {
      target: { value: "FAILED" },
    });
    await waitFor(() =>
      expect(getAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ result: "FAILED", pageNumber: 1 }),
      ),
    );
  });

  it("marks a failed event distinctly", async () => {
    getAdminAuditLogs.mockResolvedValue(
      page([auditFixture({ result: "FAILED", event: "KYC_REJECTED" })]),
    );
    renderSection(AuditLogsSection);

    const event = await screen.findByText("KYC_REJECTED");
    expect(event.closest("tr").textContent).toContain("Failed");
  });

  it("loads detail on click and renders the old/new values as text", async () => {
    getAdminAuditLog.mockResolvedValue({
      data: {
        data: auditFixture({
          comment: "Documents looked fine",
          oldValue: { status: "PENDING" },
          newValue: { status: "APPROVED" },
        }),
      },
    });
    renderSection(AuditLogsSection);

    fireEvent.click(await screen.findByText("KYC_APPROVED"));

    expect(await screen.findByText("Documents looked fine")).toBeDefined();
    expect(await screen.findByText("Previous value")).toBeDefined();
    expect(await screen.findByText("New value")).toBeDefined();
    // Serialized, not injected as markup.
    expect(await screen.findByText(/"status": "APPROVED"/)).toBeDefined();
  });

  it("never renders audit-log JSON as HTML", async () => {
    // The old/new payload is free-form and can contain user-supplied strings.
    // If it were injected with dangerouslySetInnerHTML this would become a
    // stored-XSS sink in the platform admin panel.
    getAdminAuditLog.mockResolvedValue({
      data: {
        data: auditFixture({ newValue: { note: "<img src=x onerror=alert(1)>" } }),
      },
    });
    renderSection(AuditLogsSection);

    fireEvent.click(await screen.findByText("KYC_APPROVED"));

    // Present as literal text content, and no element was actually created.
    expect(await screen.findByText(/onerror=alert\(1\)/)).toBeDefined();
    expect(document.querySelector("img[onerror]")).toBeNull();
  });

  it("renders the Access-denied shell on a 403", async () => {
    getAdminAuditLogs.mockRejectedValue({ response: { status: 403 } });
    renderSection(AuditLogsSection);

    expect(await screen.findByText("Access denied")).toBeDefined();
  });

  it("shows the empty state when nothing matches", async () => {
    getAdminAuditLogs.mockResolvedValue(page([]));
    renderSection(AuditLogsSection);

    expect(await screen.findByText("No audit logs found")).toBeDefined();
  });

  it("exports through the job flow, passing the current filters", async () => {
    exportAdminAuditLogs.mockResolvedValue({
      data: { data: { id: "job-1", status: "COMPLETED", fileData: { url: "https://x/y.csv" } } },
    });
    renderSection(AuditLogsSection);
    await screen.findByText("KYC_APPROVED");

    fireEvent.change(await screen.findByDisplayValue("All results"), {
      target: { value: "FAILED" },
    });
    await waitFor(() =>
      expect(getAdminAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ result: "FAILED" })),
    );

    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    await waitFor(() =>
      expect(exportAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ result: "FAILED" }),
      ),
    );
  });
});
