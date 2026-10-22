import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettlementsSection from "../../../../pages/dashboard/platform-admin/SettlementsSection";
import PaymentLinksSection from "../../../../pages/dashboard/platform-admin/PaymentLinksSection";
import ReconciliationSection from "../../../../pages/dashboard/platform-admin/ReconciliationSection";
import BalancesSection from "../../../../pages/dashboard/platform-admin/BalancesSection";
import * as admin from "../../../../api/admin";

vi.mock("../../../../api/admin", async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminSettlements: vi.fn(),
  getAdminSettlement: vi.fn(),
  getAdminPaymentLinks: vi.fn(),
  getAdminReconciliationRuns: vi.fn(),
  getAdminReconciliationFindings: vi.fn(),
  getAdminBalances: vi.fn(),
}));

function page(content) {
  return { data: { data: { content, totalElements: content.length, totalPages: 1 } } };
}

function renderSection(Component) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(Component)));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("platform-admin amount displays", () => {
  it("shows settlement totals, fees, variances and linked transaction amounts as returned", async () => {
    const settlement = {
      id: "s1",
      gatewaySettlementId: "SETTLEMENT-1",
      gross: 12345.67,
      fees: 100.25,
      deductions: 20.5,
      net: 12224.92,
      variance: -0.01,
      currency: "NGN",
      status: "SUCCESS",
      transactions: [{ id: "st1", reference: "LINKED-TXN", net: 11000.35, currency: "NGN" }],
    };
    admin.getAdminSettlements.mockResolvedValue(page([settlement]));
    admin.getAdminSettlement.mockResolvedValue({ data: { data: settlement } });
    renderSection(SettlementsSection);

    const row = (await screen.findByText("SETTLEMENT-1")).closest("tr");
    for (const amount of ["₦12,345.67", "₦120.75", "₦12,224.92", "-₦0.01"]) {
      expect(within(row).getByText(amount)).toBeDefined();
    }
    fireEvent.click(row);
    expect(await screen.findByText("₦11,000.35")).toBeDefined();
    expect(screen.getAllByText("₦120.75")).toHaveLength(2);
  });

  it("shows payment-link amounts and collected metrics without rescaling", async () => {
    admin.getAdminPaymentLinks.mockResolvedValue(
      page([
        {
          id: "p1",
          title: "Annual dues",
          amount: 25000.5,
          currency: "NGN",
          metrics: { amountCollected: 75001.5 },
        },
      ]),
    );
    renderSection(PaymentLinksSection);

    expect(await screen.findByText("₦25,000.50")).toBeDefined();
    expect(screen.getByText("₦75,001.50")).toBeDefined();
  });

  it("retains small reconciliation finding variances", async () => {
    admin.getAdminReconciliationRuns.mockResolvedValue(page([]));
    admin.getAdminReconciliationFindings.mockResolvedValue(
      page([
        {
          id: "f1",
          findingType: "FEE_VARIANCE",
          status: "RESOLVED",
          severity: "LOW",
          amount: 5000.25,
          variance: 0.01,
          currency: "NGN",
        },
      ]),
    );
    renderSection(ReconciliationSection);

    expect(await screen.findByText("₦5,000.25")).toBeDefined();
    expect(screen.getByText("₦0.01")).toBeDefined();
  });

  it("keeps balance amounts and residuals in major units with two decimals", async () => {
    admin.getAdminBalances.mockResolvedValue({
      data: {
        data: {
          currency: "NGN",
          residual: -0.01,
          reconciles: false,
          balances: [{ code: "CASH", amount: 1036427.56, currency: "NGN" }],
        },
      },
    });
    renderSection(BalancesSection);

    expect(await screen.findByText("₦1,036,427.56")).toBeDefined();
    expect(screen.getByText("-₦0.01")).toBeDefined();
  });
});
