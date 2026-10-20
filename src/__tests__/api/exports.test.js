import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../../api/client";
import {
  exportMyObligations,
  exportMyTransactions,
  exportCommunityRecords,
  exportAdminCommunityRecords,
} from "../../api/exports";

// The two member-scoped export triggers. Paths are literal so CI's
// `npm run audit:endpoints --strict` can prove they're deployed — GET
// /exports/{id} is caller-scoped, so polling a job started here works for a
// plain member exactly as it does for an admin.
vi.mock("../../api/client", () => ({
  default: { post: vi.fn() },
}));

beforeEach(() => {
  client.post.mockReset();
});

describe("member exports", () => {
  it("POSTs the member's own obligations export with no filters by default", () => {
    exportMyObligations({});
    expect(client.post).toHaveBeenCalledWith("/finance/obligations/me/export", null, {
      params: { format: "CSV" },
    });
  });

  it("POSTs the member's own transactions export with no filters by default", () => {
    exportMyTransactions({});
    expect(client.post).toHaveBeenCalledWith("/finance/transactions/me/export", null, {
      params: { format: "CSV" },
    });
  });

  it("forwards a selected status and format as query params, not a body", () => {
    exportMyTransactions({ status: "SUCCESS" }, "XLSX");
    const [url, body, config] = client.post.mock.calls[0];
    expect(url).toBe("/finance/transactions/me/export");
    expect(body).toBeNull();
    expect(config.params).toEqual({ status: "SUCCESS", format: "XLSX" });
  });
});

describe("community record export", () => {
  it("POSTs the record export with the list filters and no body", () => {
    // The backend uses the LIST filters and sort, and "page number and size do
    // not limit the export" — so the filters travel as query params and the
    // whole matching set is exported, not the visible page.
    exportCommunityRecords("my community", { source: "FILE_IMPORT", search: "dues" });
    expect(client.post).toHaveBeenCalledWith("/communities/my community/records/export", null, {
      params: { source: "FILE_IMPORT", search: "dues", format: "CSV" },
    });
  });

  it("defaults to CSV and accepts an explicit format", () => {
    exportCommunityRecords("c", {}, "PDF");
    expect(client.post.mock.calls[0][2].params.format).toBe("PDF");
  });

  it("keeps the platform-admin mirror on its own admin path", () => {
    // platform.recordbook.export, and it does NOT require community
    // membership — a different scope, not a different argument.
    exportAdminCommunityRecords("my community", {});
    expect(client.post.mock.calls[0][0]).toBe("/admin/communities/my community/records/export");
  });
});
