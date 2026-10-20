import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The records export, at the page level.
//
// Two things this pins that are easy to get wrong:
//
//  1. The export is gated on community.recordbook.export, which is a SEPARATE
//     permission from community.recordbook.read. A reader without it must not
//     see the button — the backend would reject it with a 403 anyway, but
//     offering a button that always fails is worse than not offering it.
//
//  2. The export takes the SAME filters as the list, minus pagination. The
//     backend uses the list filters and sort, and "page number and size do not
//     limit the export" — so the export must cover every matching record, not
//     the twenty on screen, and must not send pageNumber/pageSize.

vi.mock("../../../hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("../../../hooks/useRecordBookAccess", () => ({
  useRecordBookAccess: () => access,
}));
vi.mock("../../../hooks/useCommunityRecords", () => ({
  useCommunityRecords: () => ({
    data: { content: [], totalElements: 0, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    error: null,
  }),
  useRecordMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../../hooks/useExportJob", () => ({
  useExportJob: () => ({ run: runExport, isExporting: false }),
}));
vi.mock("../../../api/exports", () => ({
  exportCommunityRecords: vi.fn(),
}));
vi.mock("../../../pages/dashboard/records/RecordDetailPanel", () => ({
  default: () => null,
}));
vi.mock("../../../pages/dashboard/records/RecordFormModal", () => ({
  default: () => null,
}));
vi.mock("../../../pages/dashboard/records/RecordDeleteSummary", () => ({
  default: () => null,
}));

import Records from "../../../pages/dashboard/Records";
import { exportCommunityRecords } from "../../../api/exports";

let access;
let runExport;

beforeEach(() => {
  runExport = vi.fn();
  exportCommunityRecords.mockReset();
  access = {
    id: "c1",
    identifier: "my community",
    loading: false,
    error: null,
    read: true,
    create: false,
    update: false,
    delete: false,
    import: false,
    export: true,
    usage: false,
  };
});

function renderRecords(entry = "/dashboard/records") {
  // RecordFilters reads the community member list through React Query, so the
  // page needs a provider even though the export itself does not.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <Records />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("records export", () => {
  it("offers the export to a community that holds the export permission", () => {
    renderRecords();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });

  it("hides the export from a reader who has read but not export", () => {
    access.export = false;
    renderRecords();
    expect(screen.queryByRole("button", { name: /export csv/i })).toBeNull();
    // ...and the page itself still works for them.
    expect(screen.getByRole("heading", { name: /records/i })).toBeTruthy();
  });

  it("sends the current filters and no pagination", () => {
    renderRecords();
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(runExport).toHaveBeenCalledTimes(1);
    const trigger = runExport.mock.calls[0][0];
    trigger();
    expect(exportCommunityRecords).toHaveBeenCalledWith("c1", {}, "CSV");
    const params = exportCommunityRecords.mock.calls[0][1];
    expect(params).not.toHaveProperty("pageNumber");
    expect(params).not.toHaveProperty("pageSize");
  });

  it("exports the records the list is filtered to", () => {
    // The backend uses the list filters, so the export must carry them —
    // otherwise "Export CSV" silently produces the unfiltered set while the
    // user is looking at a filtered one.
    renderRecords("/dashboard/records?importJobId=job-9");
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    runExport.mock.calls[0][0]();
    expect(exportCommunityRecords.mock.calls[0][1]).toMatchObject({ importJobId: "job-9" });
  });
});
