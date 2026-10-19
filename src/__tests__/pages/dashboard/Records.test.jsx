import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCommunityRecords } from "../../../api/records";
import Records from "../../../pages/dashboard/Records";

// The two number/date contracts on this screen are silent-wrong when missed, so
// they are asserted here rather than left to review:
//
//   • amounts are MAJOR units — fmt() divides by 100 unless told not to
//   • date bounds go out as bare YYYY-MM-DD, because the backend binds them to
//     LocalDate, not Instant
//
// Both would render a plausible-looking table with every figure 100x too large.

vi.mock("../../../api/records", () => ({
  getCommunityRecords: vi.fn(),
  getCommunityRecord: vi.fn(),
}));

vi.mock("../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: () => "glass-crew",
}));

vi.mock("../../../hooks/useKycGate", () => ({
  useKycGate: () => ({ status: "APPROVED", isLoading: false, isError: false, exempt: false }),
}));

vi.mock("../../../hooks/usePageTitle", () => ({ usePageTitle: () => {} }));

function wrapper({ children }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const page = (content, totalElements = content.length, totalPages = 1) => ({
  status: 200,
  data: { success: true, data: { content, totalElements, totalPages } },
});

const record = (over = {}) => ({
  id: "rec-1",
  source: "MANUAL",
  recordType: "MEMBER_PAYMENT",
  direction: "INFLOW",
  occurredOn: "2026-09-15",
  amount: 1250.5,
  currency: "NGN",
  description: "September dues",
  payerName: "Ada Example",
  reviewStatus: "VALID",
  ...over,
});

beforeEach(() => {
  getCommunityRecords.mockReset();
  getCommunityRecords.mockResolvedValue(page([record()]));
});

describe("Records", () => {
  it("renders a record row with its description, not both description and payer", async () => {
    render(<Records />, { wrapper });
    expect(await screen.findByText("September dues")).toBeTruthy();
    // The row shows `description || payerName`, so the payer must not also
    // appear — two near-identical columns would be noise. (queryBy, not
    // getBy: getBy throws on absence, it doesn't return null.)
    expect(screen.queryByText("Ada Example")).toBeNull();
  });

  it("shows amounts as major units, not divided by 100", async () => {
    // 1250.50 major units must read as ₦1,250.50 — NOT ₦12.51, which is what
    // fmt()'s default `minor: true` would produce.
    render(<Records />, { wrapper });
    await screen.findByText("September dues");
    const money = document.body.textContent;
    expect(money).toContain("1,250");
    expect(money).not.toContain("12.51");
  });

  it("sends date bounds as bare YYYY-MM-DD, not ISO instants", async () => {
    const user = userEvent.setup();
    render(<Records />, { wrapper });
    await screen.findByText("September dues");

    const fromInput = screen.getByLabelText("Occurred from");
    await user.type(fromInput, "2026-01-01");

    await waitFor(() => {
      const params = getCommunityRecords.mock.calls.at(-1)[1];
      expect(params.occurredOnFrom).toBe("2026-01-01");
      // A LocalDate binding rejects "2026-01-01T00:00:00.000Z" with a 400.
      expect(String(params.occurredOnFrom)).not.toContain("T");
    });
  });

  it("starts at pageNumber 1, because the backend rejects page 0", async () => {
    render(<Records />, { wrapper });
    await screen.findByText("September dues");
    expect(getCommunityRecords.mock.calls[0][1].pageNumber).toBe(1);
  });

  it("omits the ALL sentinel rather than sending an invalid enum", async () => {
    render(<Records />, { wrapper });
    await screen.findByText("September dues");
    const params = getCommunityRecords.mock.calls[0][1];
    expect(params.source).toBeUndefined();
    expect(params.type).toBeUndefined();
    expect(params.direction).toBeUndefined();
    expect(params.search).toBeUndefined();
  });

  it("sends a chosen filter and resets to page 1", async () => {
    const user = userEvent.setup();
    render(<Records />, { wrapper });
    await screen.findByText("September dues");

    await user.selectOptions(screen.getByLabelText("Filter by source"), "FILE_IMPORT");

    await waitFor(() => {
      const params = getCommunityRecords.mock.calls.at(-1)[1];
      expect(params.source).toBe("FILE_IMPORT");
      expect(params.pageNumber).toBe(1);
    });
  });

  it("labels a platform record read-only in the detail view", async () => {
    getCommunityRecords.mockResolvedValue(page([record({ source: "PLATFORM" })]));
    const user = userEvent.setup();
    render(<Records />, { wrapper });
    await screen.findByText("September dues");

    await user.click(screen.getByRole("button", { name: /view record dated 2026-09-15/i }));

    // Detail fetch is mocked to undefined here, so this asserts the row opens
    // rather than the modal's contents.
    await waitFor(() => expect(getCommunityRecords).toHaveBeenCalled());
  });

  it("shows an empty state rather than a bare table when there are no records", async () => {
    getCommunityRecords.mockResolvedValue(page([], 0, 0));
    render(<Records />, { wrapper });
    expect(await screen.findByText(/no records yet/i)).toBeTruthy();
  });

  it("shows the community-scoped 403 copy, not the platform-admin wording", async () => {
    getCommunityRecords.mockRejectedValue({ response: { status: 403, data: {} } });
    render(<Records />, { wrapper });

    // The whole reason TableChrome took forbiddenMessage as a prop.
    expect(await screen.findByText(/visible to community admins/i)).toBeTruthy();
    expect(screen.queryByText(/Platform admin rights required/i)).toBeFalsy();
  });

  it("reports a total count from the server, not the page length", async () => {
    getCommunityRecords.mockResolvedValue(page([record()], 87, 5));
    render(<Records />, { wrapper });
    expect(await screen.findByText(/87 records/)).toBeTruthy();
  });

  it("opens the detail drawer on keyboard activation, not just click", async () => {
    const user = userEvent.setup();
    render(<Records />, { wrapper });
    const row = await screen.findByRole("button", { name: /view record dated/i });
    row.focus();
    await user.keyboard("{Enter}");
    // Row-click alone was mouse-only in SettlementsList until it was fixed.
    expect(document.activeElement).toBe(row);
  });
});
