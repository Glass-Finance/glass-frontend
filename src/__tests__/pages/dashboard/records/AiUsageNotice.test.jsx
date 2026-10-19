import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AiUsageNotice from "../../../../pages/dashboard/records/AiUsageNotice";
import { getRecordImportUsage } from "../../../../api/communityAiUsage";
import { getMe } from "../../../../api/members";
vi.mock("../../../../api/members", async (importOriginal) => ({
  ...(await importOriginal()),
  getMe: vi.fn(),
}));
vi.mock("../../../../api/communityAiUsage", () => ({ getRecordImportUsage: vi.fn() }));
afterEach(cleanup);
function Location() {
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  );
}
it("opens the all-feature usage settings for this community without losing the compact notice", async () => {
  getMe.mockResolvedValue({ data: { data: { timezone: "America/New_York" } } });
  getRecordImportUsage.mockResolvedValue({
    data: {
      data: {
        mode: "LIMITED",
        remainingUnits: 8,
        reservedUnits: 1,
        resetsAt: "2026-11-01T00:00:00Z",
      },
    },
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/dashboard/records/imports?community=alumni"]}>
        <AiUsageNotice communityId="community-a" allowed />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/8 AI imports remaining/)).toBeTruthy();
  expect(await screen.findByText(/Oct 31, 2026/)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "View AI usage" }));
  expect(screen.getByRole("status").textContent).toBe(
    "/dashboard/settings/community/ai-usage?community=community-a",
  );
});
