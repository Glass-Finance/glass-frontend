import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
vi.mock("../../../../hooks/useRecordBookAccess", () => ({
  useRecordBookAccess: () => ({
    id: "c",
    identifier: "crew",
    import: true,
    community: { defaultCurrency: "NGN" },
  }),
}));
vi.mock("../../../../hooks/useCommunityMembers", () => ({
  useCommunityMembers: () => ({ members: [] }),
}));
vi.mock("../../../../api/recordImports", () => ({
  getRecordImport: vi.fn(),
  getImportRows: vi.fn(),
  createImportRow: vi.fn(),
  updateImportRow: vi.fn(),
  deleteImportRow: vi.fn(),
  bulkUpdateImportRows: vi.fn(),
  commitRecordImport: vi.fn(),
  retryRecordImport: vi.fn(),
  rerunRecordImport: vi.fn(),
  discardRecordImport: vi.fn(),
}));
import { getRecordImport, getImportRows, commitRecordImport } from "../../../../api/recordImports";
import RecordImportDetail from "../../../../pages/dashboard/RecordImportDetail";
import { recordKeys, refreshRecordImportEvent } from "../../../../utils/recordBookQueryKeys";
const env = (data) => ({ data: { data } });
it("automatically shows review, freezes on 202, and shows results only after final status", async () => {
  let job = {
    id: "j",
    status: "QUEUED",
    communityId: "c",
    fileFormat: "CSV",
    reviewTotals: { VALID: 1 },
    timeline: [],
    fileData: { url: "https://example.com/source.csv" },
  };
  getRecordImport.mockImplementation(async () => env(job));
  getImportRows.mockResolvedValue(
    env({
      content: [{ id: "r", payerName: "Ada", amount: 25, currency: "NGN", reviewStatus: "VALID" }],
      totalPages: 1,
      totalElements: 1,
    }),
  );
  commitRecordImport.mockImplementation(async () => {
    job = { ...job, status: "COMMIT_QUEUED" };
    return env(job);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard/records/imports/j?community=crew"]}>
        <Routes>
          <Route path="/dashboard/records/imports/:jobId" element={<RecordImportDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getAllByText("Waiting to start").length).toBeGreaterThan(0));
  expect(screen.queryByText("Review your records")).toBeNull();
  expect(screen.getByRole("button", { name: "Back to imports" })).toBeTruthy();
  const openSource = vi.spyOn(window, "open").mockImplementation(() => null);
  fireEvent.click(screen.getByRole("button", { name: "Download source" }));
  expect(openSource).toHaveBeenCalledWith(
    "https://example.com/source.csv",
    "_blank",
    "noopener,noreferrer",
  );
  openSource.mockRestore();
  job = { ...job, status: "READY_FOR_REVIEW" };
  await act(async () =>
    refreshRecordImportEvent(
      client,
      { communityId: "c", jobId: "j", status: job.status, sequence: 1 },
      new Map(),
    ),
  );
  await screen.findByText("Review your records");
  fireEvent.click(screen.getByRole("button", { name: "Save records", exact: true }));
  fireEvent.click(screen.getAllByRole("button", { name: "Save records", exact: true }).at(-1));
  await waitFor(() => expect(screen.getAllByText("Saving records").length).toBeGreaterThan(0));
  expect(screen.queryByText("Your records have been saved")).toBeNull();
  job = { ...job, status: "COMMITTED", committedRows: 1, skippedRows: 0 };
  await act(async () =>
    refreshRecordImportEvent(
      client,
      { communityId: "c", jobId: "j", status: job.status, sequence: 2 },
      new Map(),
    ),
  );
  await screen.findByText("Your records have been saved");
  expect(client.getQueryData(recordKeys.job("c", "j")).status).toBe("COMMITTED");
});

it("groups import actions in the header and retains confirmation", async () => {
  getRecordImport.mockResolvedValue(
    env({ id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 1 }, timeline: [] }),
  );
  getImportRows.mockResolvedValue(env({ content: [], totalPages: 1 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard/records/imports/j?community=crew"]}>
        <Routes>
          <Route path="/dashboard/records/imports/:jobId" element={<RecordImportDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const actions = await screen.findByRole("button", { name: "Import actions" });
  expect(screen.queryByRole("menuitem", { name: "Discard import" })).toBeNull();
  fireEvent.click(actions);
  expect(screen.getByRole("menuitem", { name: "Start fresh import" })).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "Discard import" }));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Discard import?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
