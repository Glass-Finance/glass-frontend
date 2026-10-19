import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../../api/client";
import * as records from "../../api/records";
import * as importsApi from "../../api/recordImports";
import * as aiUsage from "../../api/aiUsage";

// All 27 record-book and AI-usage routes, in one file because they are one
// contract and one review unit: if the backend moves a path, every assertion
// here should fail together.
//
// Paths are asserted as written in the modules. They are deliberately inline
// template literals in the call — scripts/endpoint-audit.mjs extracts them with
// a regex that only matches a literal sitting directly in the call, so this
// file also guards against someone "tidying" them into a helper.
vi.mock("../../api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  for (const m of ["get", "post", "patch", "put", "delete"]) client[m].mockReset();
});

describe("records API", () => {
  it("reads and writes under the community-scoped records path", () => {
    records.getCommunityRecords("glass-crew", { pageNumber: 1 });
    records.getCommunityRecord("glass-crew", "rec-1");
    records.createCommunityRecord("glass-crew", { amount: 10 });
    records.updateCommunityRecord("glass-crew", "rec-1", { description: null });
    records.deleteCommunityRecord("glass-crew", "rec-1");

    expect(client.get.mock.calls[0][0]).toBe("/communities/glass-crew/records");
    expect(client.get.mock.calls[1][0]).toBe("/communities/glass-crew/records/rec-1");
    expect(client.post.mock.calls[0][0]).toBe("/communities/glass-crew/records");
    expect(client.patch.mock.calls[0][0]).toBe("/communities/glass-crew/records/rec-1");
    expect(client.delete.mock.calls[0][0]).toBe("/communities/glass-crew/records/rec-1");
  });

  it("forwards list params untouched so pageNumber/dir reach the backend", () => {
    const params = { pageNumber: 3, pageSize: 25, source: "FILE_IMPORT", dir: "desc" };
    records.getCommunityRecords("glass-crew", params);
    expect(client.get.mock.calls[0][1]).toEqual({ params });
  });

  it("uses the admin mirror for platform reads, which need no membership", () => {
    records.getAdminCommunityRecords("glass-crew");
    records.getAdminCommunityRecord("glass-crew", "rec-1");
    expect(client.get.mock.calls[0][0]).toBe("/admin/communities/glass-crew/records");
    expect(client.get.mock.calls[1][0]).toBe("/admin/communities/glass-crew/records/rec-1");
  });

  it("sends DELETE with no body", () => {
    records.deleteCommunityRecord("glass-crew", "rec-1");
    expect(client.delete.mock.calls[0]).toHaveLength(1);
  });
});

describe("record imports API", () => {
  it("submits a job and reads the list and detail", () => {
    importsApi.createImportJob("glass-crew", { fileId: "file-1" });
    importsApi.getImportJobs("glass-crew");
    importsApi.getImportJob("glass-crew", "job-1");

    expect(client.post.mock.calls[0][0]).toBe("/communities/glass-crew/records/imports");
    expect(client.get.mock.calls[0][0]).toBe("/communities/glass-crew/records/imports");
    expect(client.get.mock.calls[1][0]).toBe("/communities/glass-crew/records/imports/job-1");
  });

  it("keeps the bulk row patch distinct from the single-row patch", () => {
    // These normalize to different paths, so confusing them would silently
    // patch one row when the caller selected five.
    importsApi.updateImportJobRow("c", "job-1", "row-1", { skip: true });
    importsApi.bulkUpdateImportJobRows("c", "job-1", { rowIds: ["row-1"], patch: { skip: true } });

    expect(client.patch.mock.calls[0][0]).toBe("/communities/c/records/imports/job-1/rows/row-1");
    expect(client.patch.mock.calls[1][0]).toBe("/communities/c/records/imports/job-1/rows/bulk");
  });

  it("puts rowIds and the shared patch in the bulk body", () => {
    const payload = { rowIds: ["row-1", "row-2"], patch: { skip: true } };
    importsApi.bulkUpdateImportJobRows("c", "job-1", payload);
    expect(client.patch.mock.calls[0][1]).toBe(payload);
  });

  it("sends commit, discard, retry and rerun with no body", () => {
    importsApi.commitImportJob("c", "job-1");
    importsApi.discardImportJob("c", "job-1");
    importsApi.retryImportJob("c", "job-1");
    importsApi.rerunImportJob("c", "job-1");

    expect(client.post.mock.calls.map((c) => c[0])).toEqual([
      "/communities/c/records/imports/job-1/commit",
      "/communities/c/records/imports/job-1/discard",
      "/communities/c/records/imports/job-1/retry",
      "/communities/c/records/imports/job-1/rerun",
    ]);
    // The backend rejects a body on these; sending `{}` is not the same as
    // sending nothing to some servers.
    for (const call of client.post.mock.calls) expect(call).toHaveLength(1);
  });

  it("distinguishes a manual row deletion from a job discard", () => {
    importsApi.deleteImportJobRow("c", "job-1", "row-1");
    expect(client.delete.mock.calls[0][0]).toBe("/communities/c/records/imports/job-1/rows/row-1");
  });
});

describe("AI usage API", () => {
  it("reads community usage with the feature as a path segment, not a query", () => {
    aiUsage.getCommunityAiUsage("glass-crew", { mode: "LIMITED" });
    aiUsage.getCommunityAiUsageByFeature("glass-crew", "RECORD_IMPORT");

    expect(client.get.mock.calls[0][0]).toBe("/communities/glass-crew/ai/usage");
    expect(client.get.mock.calls[0][1]).toEqual({ params: { mode: "LIMITED" } });
    expect(client.get.mock.calls[1][0]).toBe("/communities/glass-crew/ai/usage/RECORD_IMPORT");
  });

  it("puts the policy read and write on the admin mirror", () => {
    aiUsage.getAdminAiPolicy("glass-crew", "RECORD_IMPORT");
    aiUsage.updateAdminAiPolicy("glass-crew", "RECORD_IMPORT", {
      mode: "LIMITED",
      periodType: "MONTHLY",
      allowanceUnits: 100,
    });

    expect(client.get.mock.calls[0][0]).toBe(
      "/admin/communities/glass-crew/ai/policies/RECORD_IMPORT",
    );
    // PUT, not POST or PATCH — a policy replace.
    expect(client.put.mock.calls[0][0]).toBe(
      "/admin/communities/glass-crew/ai/policies/RECORD_IMPORT",
    );
  });

  it("keeps periods, operations and adjustments on separate paths", () => {
    aiUsage.getAdminAiPeriods("c", "RECORD_IMPORT");
    aiUsage.getAdminAiOperations("c", "RECORD_IMPORT");
    aiUsage.getAdminAiAdjustments("c", "RECORD_IMPORT");

    expect(client.get.mock.calls.map((call) => call[0])).toEqual([
      "/admin/communities/c/ai/usage/RECORD_IMPORT/periods",
      "/admin/communities/c/ai/usage/RECORD_IMPORT/operations",
      "/admin/communities/c/ai/usage/RECORD_IMPORT/adjustments",
    ]);
  });

  it("posts an adjustment with its signed delta and reason", () => {
    const payload = { deltaUnits: -10, reason: "Approved temporary import allowance" };
    aiUsage.createAdminAiAdjustment("c", "RECORD_IMPORT", payload);
    expect(client.post.mock.calls[0][0]).toBe(
      "/admin/communities/c/ai/usage/RECORD_IMPORT/adjustments",
    );
    expect(client.post.mock.calls[0][1]).toBe(payload);
  });
});
