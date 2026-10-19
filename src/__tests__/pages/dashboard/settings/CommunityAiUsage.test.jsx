import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import CommunityAiUsage from "../../../../pages/dashboard/settings/community/CommunityAiUsage";
import { getCommunityAiUsage } from "../../../../api/communityAiUsage";
import { useRecordBookAccess } from "../../../../hooks/useRecordBookAccess";
import { getMe } from "../../../../api/members";
vi.mock("../../../../api/members", async (importOriginal) => ({
  ...(await importOriginal()),
  getMe: vi.fn(),
}));
vi.mock("../../../../api/communityAiUsage", () => ({
  getCommunityAiUsage: vi.fn(),
  getRecordImportUsage: vi.fn(),
}));
vi.mock("../../../../hooks/useRecordBookAccess", () => ({ useRecordBookAccess: vi.fn() }));
const limited = {
  id: "policy-a",
  communityId: "a",
  feature: "RECORD_IMPORT",
  mode: "LIMITED",
  meterType: "OPERATIONS",
  periodType: "MONTHLY",
  allowanceUnits: 100,
  adjustmentUnits: 10,
  consumedUnits: 20,
  reservedUnits: 5,
  remainingUnits: 85,
  periodStartsAt: "2026-10-01T00:00:00Z",
  resetsAt: "2026-11-01T00:00:00Z",
};
const envelope = (content, pageNumber = 1, totalPages = 1) => ({
  data: {
    data: {
      content,
      pageNumber,
      totalPages,
      totalElements: totalPages === 1 ? content.length : 11,
    },
  },
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const node = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CommunityAiUsage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(node());
  return { ...view, client, refresh: () => view.rerender(node()) };
}
beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue({ data: { data: { timezone: "America/New_York" } } });
  useRecordBookAccess.mockReturnValue({
    id: "a",
    community: { id: "a", name: "Alumni" },
    usage: true,
    loading: false,
  });
  getCommunityAiUsage.mockResolvedValue(envelope([limited]));
});
afterEach(cleanup);
describe("community AI usage settings", () => {
  it("shows allowance rules with a single sentence explaining the usage unit", async () => {
    mount();
    const feature = await screen.findByRole("region", { name: "Spreadsheet imports" });
    expect(feature.textContent).toMatch("20");
    expect(feature.textContent).toMatch("85");
    expect(feature.textContent).toMatch("5");
    expect(within(feature).getByText("Allowance rules")).toBeTruthy();
    expect(feature.textContent).toContain("100 operations per month");
    expect(feature.textContent).toContain("+10 operations");
    expect(feature.textContent).not.toContain("Managed by Glass");
    expect(feature.textContent).toContain("Next reset");
    await waitFor(() => expect(feature.textContent).toContain("Oct 31, 2026"));
    expect(feature.textContent).toContain("8:00 PM EDT");
    expect(screen.getByText(/last updated/i).textContent).toMatch(/EDT|EST/);
    expect(within(feature).getByText("Each unit represents one spreadsheet import.")).toBeTruthy();
    expect(feature.textContent).not.toMatch(/unsuccessful|uncertain|fresh rerun/i);
    expect(within(feature).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(within(feature).getByRole("progressbar").getAttribute("aria-valuemax")).toBe("110");
    expect(getCommunityAiUsage).toHaveBeenCalledWith("a", {
      pageNumber: 1,
      pageSize: 10,
      sortBy: "feature",
      dir: "asc",
    });
    expect(screen.getByText(/last updated/i)).toBeTruthy();
  });
  it.each([
    ["UNLIMITED", null, "Unlimited"],
    ["DISABLED", null, "Disabled"],
    ["LIMITED", 0, "Allowance used up"],
  ])("explains %s without inventing a percentage", async (mode, remainingUnits, label) => {
    getCommunityAiUsage.mockResolvedValue(
      envelope([
        { ...limited, mode, allowanceUnits: mode === "LIMITED" ? 0 : null, remainingUnits },
      ]),
    );
    mount();
    const feature = await screen.findByRole("region", { name: "Spreadsheet imports" });
    expect(within(feature).getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
    expect(within(feature).queryByRole("progressbar")).toBeNull();
  });
  it("keeps unknown counts and dates unavailable and labels future features readably", async () => {
    getCommunityAiUsage.mockResolvedValue(
      envelope([
        { id: "future", feature: "MEMBER_ASSISTANCE", mode: "FUTURE", resetsAt: "not-a-date" },
      ]),
    );
    mount();
    const feature = await screen.findByRole("region", { name: "Member assistance" });
    expect(feature.textContent).toMatch("Unavailable");
    expect(feature.textContent).not.toContain("Invalid Date");
    expect(within(feature).queryByRole("progressbar")).toBeNull();
  });
  it("does not fetch or expose cached usage after permission is denied", async () => {
    const { refresh } = mount();
    await screen.findByRole("region", { name: "Spreadsheet imports" });
    useRecordBookAccess.mockReturnValue({ id: "a", usage: false, loading: false });
    refresh();
    expect(screen.getByText(/don't have permission/i)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Spreadsheet imports" })).toBeNull();
    expect(getCommunityAiUsage).toHaveBeenCalledTimes(1);
  });
  it("refreshes explicitly and marks retained values stale after a refresh error", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("region", { name: "Spreadsheet imports" });
    getCommunityAiUsage.mockRejectedValue(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/out of date/i);
    expect(screen.getByRole("region", { name: "Spreadsheet imports" })).toBeTruthy();
    getCommunityAiUsage.mockResolvedValue(envelope([{ ...limited, remainingUnits: 84 }]));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("region", { name: "Spreadsheet imports" }).textContent).toMatch("84");
  });
  it("hides retained usage if the server revokes access", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("region", { name: "Spreadsheet imports" });
    getCommunityAiUsage.mockRejectedValue({ response: { status: 403 } });
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/don't have permission/i)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Spreadsheet imports" })).toBeNull();
  });
  it("paginates on the server and renders an empty feature list clearly", async () => {
    const user = userEvent.setup();
    getCommunityAiUsage.mockImplementation(async (_, params) =>
      params.pageNumber === 1
        ? envelope([limited], 1, 2)
        : envelope([{ ...limited, id: "other", feature: "OTHER_FEATURE" }], 2, 2),
    );
    const { refresh } = mount();
    await screen.findByRole("region", { name: "Spreadsheet imports" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("region", { name: "Other feature" });
    expect(screen.queryByRole("region", { name: "Spreadsheet imports" })).toBeNull();
    useRecordBookAccess.mockReturnValue({
      id: "b",
      community: { name: "Union" },
      usage: true,
      loading: false,
    });
    getCommunityAiUsage.mockResolvedValue(envelope([]));
    refresh();
    expect(await screen.findByText("No AI features available")).toBeTruthy();
    expect(getCommunityAiUsage).toHaveBeenLastCalledWith(
      "b",
      expect.objectContaining({ pageNumber: 1 }),
    );
  });
});
