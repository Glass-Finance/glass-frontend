import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettlementsList from "../../../../pages/dashboard/settlements/SettlementsList";

// Deliberately NOT mocked at the useCommunitySettlements boundary the way
// Payments.test.jsx does its hook: mocking the hook would hide the very wiring
// under test (page state -> hook -> api). Here the real hook runs and only the
// api module is stubbed, so reverting the page back to a 0-based pager or
// sending an unsupported filter would fail this suite. Same approach and
// rationale as Groups.pagination.test.jsx.
const { mockList, mockDetail } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockDetail: vi.fn(),
}));

vi.mock("../../../../api/transactions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCommunitySettlements: (...args) => mockList(...args),
    getCommunitySettlement: (...args) => mockDetail(...args),
  };
});

vi.mock("../../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(() => "glass-crew"),
}));

function axiosEnvelope(data) {
  return { data: { data } };
}

function page(content, overrides = {}) {
  return {
    content,
    pageNumber: 1,
    pageSize: 20,
    totalElements: content.length,
    totalPages: 1,
    ...overrides,
  };
}

const settlement = (over = {}) => ({
  id: "s1",
  gross: 250000,
  deductions: 2500,
  net: 247500,
  totalAmount: 250000,
  currency: "NGN",
  status: "SUCCESS",
  settledAt: "2026-10-01T10:30:00Z",
  matchedTransactionCount: 2,
  ...over,
});

/** A row's status badge — clicking anywhere in the row opens the drawer.
 *  (The cell under "Matched txns" renders the count, not that label.) */
function firstRow() {
  return screen.getByText("SUCCESS");
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard/payments?community=glass-crew"]}>
        <SettlementsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockList.mockReset();
  mockDetail.mockReset();
  mockList.mockResolvedValue(axiosEnvelope(page([settlement()])));
});

describe("SettlementsList", () => {
  it("displays settlement totals in major units with two decimal places", async () => {
    mockList.mockResolvedValue(
      axiosEnvelope(page([settlement({ gross: 500.5, deductions: 0, net: 500.5 })])),
    );
    renderPage();

    const row = await screen.findByRole("button", { name: /view settlement/i });
    expect(within(row).getAllByText("₦500.50")).toHaveLength(2);
    expect(within(row).getByText("₦0.00")).toBeDefined();
  });

  it("displays detail totals and matched transaction amounts in major units", async () => {
    mockDetail.mockResolvedValue(
      axiosEnvelope(
        settlement({
          gross: 1500.5,
          deductions: 25.25,
          net: 1475.25,
          totalAmount: 1500,
          transactions: [
            {
              id: "t1",
              amount: 500.5,
              currency: "NGN",
              status: "RECEIVED",
              paidAt: "2026-10-01T10:29:00Z",
              matched: true,
            },
          ],
        }),
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /view settlement/i }));
    await screen.findByText("Matched Transactions (2)");
    for (const amount of ["₦1,500.50", "₦25.25", "₦1,475.25", "₦1,500.00", "₦500.50"]) {
      expect(screen.getByText(amount)).toBeDefined();
    }
  });

  it("requests page 1 with no filters on first load", async () => {
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const [communityId, params] = mockList.mock.calls[0];
    expect(communityId).toBe("glass-crew");
    // 1-based pageNumber (pageNumber=0 is what 400s on the sibling finance
    // endpoints) and every filter omitted until chosen.
    expect(params).toMatchObject({ pageNumber: 1, pageSize: 20 });
    expect(params.search).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.settledFrom).toBeUndefined();
    expect(params.settledTo).toBeUndefined();
  });

  it("only offers the statuses a community caller can actually receive", async () => {
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const options = screen.getByLabelText("Filter by status").textContent;
    expect(options).toContain("Pending");
    expect(options).toContain("Settled");
    expect(options).toContain("Failed");
    // MISMATCHED / REVIEWED are filtered out of both list and detail by the
    // backend, so they must not be offered as filters here.
    expect(options).not.toContain("Mismatched");
    expect(options).not.toContain("Reviewed");
  });

  it("sends the chosen status and returns to page 1", async () => {
    renderPage();
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    mockList.mockResolvedValue(axiosEnvelope(page([settlement({ status: "FAILED" })])));
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "FAILED" } });

    await waitFor(() => {
      const last = mockList.mock.calls.at(-1)[1];
      expect(last.status).toBe("FAILED");
      expect(last.pageNumber).toBe(1);
    });
  });

  it("sends the date range as ISO instants", async () => {
    renderPage();
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Settled from"), { target: { value: "2026-09-01" } });
    await waitFor(() => {
      const last = mockList.mock.calls.at(-1)[1];
      // Asserted in local terms: the input is a local date, so the instant it
      // becomes depends on the viewer's timezone (local midnight, not UTC).
      const from = new Date(last.settledFrom);
      expect([from.getFullYear(), from.getMonth() + 1, from.getDate()]).toEqual([2026, 9, 1]);
      expect(from.getHours()).toBe(0);
      expect(last.settledTo).toBeUndefined();
    });
  });

  it("renders the community response fields and no admin-only columns", async () => {
    mockList.mockResolvedValue(axiosEnvelope(page([settlement()])));
    renderPage();

    await screen.findByText("Matched txns");
    const headers = [...document.querySelectorAll("th")].map((th) => th.textContent);
    expect(headers).toEqual(["Settled", "Gross", "Deductions", "Net", "Status", "Matched txns"]);
    // CommunitySettlementResponse has no fees / variance / failureReason, so
    // the admin section's columns cannot be copied here.
    expect(headers).not.toContain("Fees");
    expect(headers).not.toContain("Variance");
  });

  it("shows an access panel rather than an error when the API 403s", async () => {
    // Expected, not an edge case: the endpoints need
    // community.reconciliation.read, which COMMUNITY_MEMBER lacks.
    mockList.mockRejectedValue({ response: { status: 403 } });
    renderPage();

    expect(await screen.findByText(/don't have access to settlements/i)).toBeDefined();
    expect(screen.queryByText("Failed to load")).toBeNull();
  });

  it("shows the empty state when there are no settlements", async () => {
    mockList.mockResolvedValue(axiosEnvelope(page([])));
    renderPage();

    expect(await screen.findByText("No settlements found")).toBeDefined();
  });

  it("opens the detail drawer for a row and lists its transactions", async () => {
    mockDetail.mockResolvedValue(
      axiosEnvelope(
        settlement({
          transactions: [
            {
              id: "t1",
              amount: 25000,
              currency: "NGN",
              // Distinct text so the row is findable without asserting a
              // timestamp, which renders in the viewer's local timezone.
              status: "RECEIVED",
              paidAt: "2026-10-01T10:29:00Z",
              matched: true,
            },
          ],
        }),
      ),
    );
    renderPage();

    await screen.findByText("Matched txns");
    fireEvent.click(firstRow());
    await waitFor(() => expect(mockDetail).toHaveBeenCalledWith("glass-crew", "s1"));
    expect(await screen.findByText("Matched Transactions (2)")).toBeDefined();
    // The community transaction payload has no `reference` (the admin one
    // does), so each row is identified by its status and amount instead.
    expect(screen.getByText("RECEIVED")).toBeDefined();
  });

  it("explains a settlement that 404s instead of showing a raw failure", async () => {
    mockDetail.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    await screen.findByText("Matched txns");
    fireEvent.click(firstRow());
    expect(await screen.findByText(/no longer available/i)).toBeDefined();
    expect(screen.queryByText("Failed to load")).toBeNull();
  });

  it("includes the whole end date in the range", async () => {
    // Regression: new Date("2026-09-30") is UTC midnight, so a settlement made
    // later that day was cut off by the "to" bound.
    renderPage();
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Settled to"), { target: { value: "2026-09-30" } });
    await waitFor(() => {
      const settledTo = new Date(mockList.mock.calls.at(-1)[1].settledTo);
      expect(settledTo.getHours()).toBe(23);
      expect(settledTo.getMinutes()).toBe(59);
      // Still the chosen day, not the next one.
      expect(settledTo.getDate()).toBe(30);
    });
  });

  it("opens the drawer from the keyboard, not just a click", async () => {
    mockDetail.mockResolvedValue(axiosEnvelope(settlement({ transactions: [] })));
    renderPage();

    const row = await screen.findByRole("button", { name: /view settlement/i });
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(row, { key: "Enter" });

    await waitFor(() => expect(mockDetail).toHaveBeenCalledWith("glass-crew", "s1"));
  });

  it("pages forward with a 1-based pageNumber", async () => {
    mockList.mockResolvedValue(axiosEnvelope(page([settlement()], { totalPages: 3 })));
    renderPage();

    // Renders disabled on first paint (no data yet, so totalPages falls back
    // to 1), and there are no jest-dom matchers here to wait on that.
    await waitFor(() => expect(screen.getByLabelText("Next page").disabled).toBe(false));
    fireEvent.click(screen.getByLabelText("Next page"));
    await waitFor(() => expect(mockList.mock.calls.at(-1)[1].pageNumber).toBe(2));
  });
});
