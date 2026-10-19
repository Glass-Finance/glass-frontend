import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import client from "../../api/client";
import * as records from "../../api/communityRecords";
import * as usage from "../../api/communityAiUsage";
import * as imports from "../../api/recordImports";
import { uploadFile, uploadFiles } from "../../api/files";

beforeEach(() => vi.clearAllMocks());
describe("record book contract", () => {
  it("preserves list filters, one-based pages, and PATCH null clearing", () => {
    records.getCommunityRecords("crew", { pageNumber: 2, type: "EXPENSE", search: "%_!" });
    expect(client.get).toHaveBeenCalledWith("/communities/crew/records", {
      params: { pageNumber: 2, type: "EXPENSE", search: "%_!" },
    });
    records.updateCommunityRecord("crew", "r", { description: null });
    expect(client.patch).toHaveBeenCalledWith("/communities/crew/records/r", { description: null });
  });
  it("uses independent job submissions and bodyless lifecycle actions", () => {
    imports.submitRecordImport("crew", { fileId: "f1" });
    imports.submitRecordImport("crew", { fileId: "f2" });
    expect(client.post.mock.calls.slice(0, 2)).toEqual([
      ["/communities/crew/records/imports", { fileId: "f1" }],
      ["/communities/crew/records/imports", { fileId: "f2" }],
    ]);
    imports.commitRecordImport("crew", "j");
    imports.retryRecordImport("crew", "j");
    imports.rerunRecordImport("crew", "j");
    imports.discardRecordImport("crew", "j");
    expect(client.post.mock.calls.slice(2)).toEqual(
      ["commit", "retry", "rerun", "discard"].map((action) => [
        `/communities/crew/records/imports/j/${action}`,
      ]),
    );
  });
  it("scopes row actions to their job and sends selected IDs without expansion", () => {
    imports.bulkUpdateImportRows("crew", "j", { rowIds: ["r1", "r2"], patch: { skip: true } });
    expect(client.patch).toHaveBeenCalledWith("/communities/crew/records/imports/j/rows/bulk", {
      rowIds: ["r1", "r2"],
      patch: { skip: true },
    });
    imports.deleteImportRow("crew", "j", "r1");
    expect(client.delete).toHaveBeenCalledWith("/communities/crew/records/imports/j/rows/r1");
  });
  it("uploads private single/multiple sources without a hardcoded multipart boundary", () => {
    const file = new File(["date,amount"], "dues.csv", { type: "text/csv" });
    uploadFile(file, "RECORD_IMPORT_SOURCE");
    uploadFiles([file, file], "RECORD_IMPORT_SOURCE");
    const [single, multiple] = client.post.mock.calls;
    expect(single[1].get("file")).toBe(file);
    expect(multiple[0]).toBe("/file/upload/multiple");
    expect(multiple[1].getAll("files")).toHaveLength(2);
    expect(multiple[1].get("fileCategory")).toBe("RECORD_IMPORT_SOURCE");
    expect(single[2]?.headers?.["Content-Type"]).toBe(false);
  });
});

describe("spreadsheet file-part MIME metadata", () => {
  it.each([
    ["dues.csv", "", "text/csv"],
    ["dues.csv", "application/octet-stream", "text/csv"],
    ["dues.xlsx", "", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    [
      "dues.xlsx",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["dues.xls", "application/octet-stream", "application/vnd.ms-excel"],
    ["dues.tsv", "", "text/tab-separated-values"],
  ])("sends the category's declared MIME for %s (%s)", (name, type, expected) => {
    const file = new File(["unchanged bytes"], name, { type, lastModified: 123 });
    uploadFile(file, "RECORD_IMPORT_SOURCE");
    const part = client.post.mock.calls[0][1].get("file");
    expect(part.type).toBe(expected);
    expect(part.name).toBe(name);
    expect(part.size).toBe(file.size);
    expect(part.lastModified).toBe(file.lastModified);
  });
  it("normalizes multiple sources but leaves other categories unchanged", () => {
    const csv = new File(["data"], "dues.csv", { type: "application/octet-stream" });
    uploadFiles([csv], "RECORD_IMPORT_SOURCE");
    expect(client.post.mock.calls[0][1].getAll("files")[0].type).toBe("text/csv");
    uploadFile(csv, "SUPPORT_ATTACHMENT");
    expect(client.post.mock.calls[1][1].get("file").type).toBe("application/octet-stream");
  });
});

it("lists all community AI features with the server pagination contract", () => {
  const params = { pageNumber: 2, pageSize: 10, sortBy: "feature", dir: "asc" };
  usage.getCommunityAiUsage("crew", params);
  expect(client.get).toHaveBeenCalledWith("/communities/crew/ai/usage", { params });
});
