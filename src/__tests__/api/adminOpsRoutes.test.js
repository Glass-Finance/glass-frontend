import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../../api/client";
import {
  getAdminMetrics,
  getAdminTransactions,
  getAdminTransaction,
  exportAdminTransactions,
  getAdminObligations,
  getAdminObligation,
  exportAdminObligations,
  getAdminAuditLogs,
  getAdminAuditLog,
  exportAdminAuditLogs,
} from "../../api/admin";

// Request contract for the three platform-wide admin surfaces, read from the
// backend controllers (AdminTransactionController, AdminObligationController,
// AdminAuditController) rather than assumed:
//
//   GET  /admin/transactions   -> PageResponse<TransactionResponse>
//   GET  /admin/transactions/{transactionId} -> TransactionResponse
//   POST /admin/transactions/export -> ExportJobResponse  (async job)
//   GET  /admin/obligations    -> PageResponse<ObligationResponse>
//   GET  /admin/obligations/{obligationId} -> ObligationResponse
//   POST /admin/obligations/export -> ExportJobResponse  (async job)
//   GET  /admin/audit-logs     -> PageResponse<AdminAuditLogResponse>
//   GET  /admin/audit-logs/{auditLogId} -> AdminAuditLogDetailResponse
//   POST /admin/audit-logs/export -> ExportJobResponse  (async job)
//
// Two things this file pins deliberately:
//
//  1. The detail path parameters are NOT all named "id" — they are
//     transactionId / obligationId / auditLogId. The audit script only
//     pattern-matches the trailing segment, so a wrong name still resolves
//     there; it would only 404 against the real backend.
//
//  2. The three export routes return a queued job, not a file. Sending them
//     as `client.post(path, { params })` (body instead of query args) would
//     create a job with no filters and no format.

vi.mock("../../api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

beforeEach(() => {
  client.post.mockReset();
  client.get.mockReset();
  client.post.mockResolvedValue({ data: { data: { id: "job-1" } } });
  client.get.mockResolvedValue({ data: { data: { content: [] } } });
});

describe("admin transaction routes", () => {
  it("lists across all communities at /admin/transactions", () => {
    getAdminTransactions({ pageNumber: 1, pageSize: 20 });

    expect(client.get).toHaveBeenCalledWith("/admin/transactions", {
      params: { pageNumber: 1, pageSize: 20 },
    });
  });

  it("fetches one transaction by its own path parameter", () => {
    getAdminTransaction("txn-1");

    expect(client.get).toHaveBeenCalledWith("/admin/transactions/txn-1");
  });

  it("forwards the query filters the DTO declares", () => {
    const params = {
      pageNumber: 1,
      pageSize: 20,
      status: "SUCCESSFUL",
      communityIdentifier: "acme",
      search: "ref",
    };
    getAdminTransactions(params);

    expect(client.get.mock.calls[0][1].params).toEqual(params);
  });

  it("queues the export as a job with format in the query string, not a body", () => {
    exportAdminTransactions({ status: "FAILED" });

    const [path, body, config] = client.post.mock.calls[0];
    expect(path).toBe("/admin/transactions/export");
    // null body: the backend takes the same TransactionQueryDto plus a
    // `format` query param, and there is no request body to send.
    expect(body).toBeNull();
    expect(config.params).toEqual({ status: "FAILED", format: "CSV" });
  });

  it("allows a non-default export format", () => {
    exportAdminTransactions({}, "PDF");

    expect(client.post.mock.calls[0][2].params.format).toBe("PDF");
  });
});

describe("admin obligation routes", () => {
  it("lists at /admin/obligations and fetches by obligationId", () => {
    getAdminObligations({ pageNumber: 1, pageSize: 20 });
    getAdminObligation("obl-1");

    expect(client.get.mock.calls[0][0]).toBe("/admin/obligations");
    expect(client.get.mock.calls[1][0]).toBe("/admin/obligations/obl-1");
  });

  it("queues the export as a job with format in the query string", () => {
    exportAdminObligations({ status: "OVERDUE" });

    const [path, body, config] = client.post.mock.calls[0];
    expect(path).toBe("/admin/obligations/export");
    expect(body).toBeNull();
    expect(config.params).toEqual({ status: "OVERDUE", format: "CSV" });
  });
});

describe("admin audit-log routes", () => {
  it("lists at /admin/audit-logs and fetches by auditLogId", () => {
    getAdminAuditLogs({ pageNumber: 1, pageSize: 20 });
    getAdminAuditLog("log-1");

    expect(client.get.mock.calls[0][0]).toBe("/admin/audit-logs");
    expect(client.get.mock.calls[1][0]).toBe("/admin/audit-logs/log-1");
  });

  it("forwards the result filter", () => {
    getAdminAuditLogs({ result: "FAILED" });

    expect(client.get.mock.calls[0][1].params).toEqual({ result: "FAILED" });
  });

  it("queues the export as a job with format in the query string", () => {
    exportAdminAuditLogs({});

    const [path, body, config] = client.post.mock.calls[0];
    expect(path).toBe("/admin/audit-logs/export");
    expect(body).toBeNull();
    expect(config.params).toEqual({ format: "CSV" });
  });
});

describe("the three export routes are distinct from their list routes", () => {
  // POST /admin/{group}/export and GET /admin/{group} differ by one path
  // segment and a different verb. A copy-paste slip between the export call
  // and the list call would silently queue an unfiltered export or, worse,
  // post to a GET-only path.
  it("keeps each export path separate from its list path", () => {
    getAdminTransactions({});
    exportAdminTransactions({});
    getAdminObligations({});
    exportAdminObligations({});
    getAdminAuditLogs({});
    exportAdminAuditLogs({});

    const gets = client.get.mock.calls.map((c) => c[0]);
    const posts = client.post.mock.calls.map((c) => c[0]);

    expect(gets).toEqual(["/admin/transactions", "/admin/obligations", "/admin/audit-logs"]);
    expect(posts).toEqual([
      "/admin/transactions/export",
      "/admin/obligations/export",
      "/admin/audit-logs/export",
    ]);
    // No export path may be reused as a list path.
    for (const p of posts) expect(gets).not.toContain(p);
  });
});

describe("pagination params are 1-based at the API boundary", () => {
  // The list wrappers are thin and pass params straight through; the +1 that
  // makes them 1-based lives in pageParams() in platform-admin/shared.js.
  // This documents the split so a future caller doesn't assume these add it.
  it("does not silently renumber — the caller owns the conversion", () => {
    getAdminTransactions({ pageNumber: 1, pageSize: 20 });

    expect(client.get.mock.calls[0][1].params.pageNumber).toBe(1);
  });
});

// The shared client supplies /api/v1 and the bearer token.
describe("admin metrics route", () => {
  it("gets the aggregate metrics with optional creation bounds as query parameters", () => {
    const params = { createdFrom: "2026-10-01T00:00:00Z", createdTo: "2026-10-26T00:00:00Z" };
    getAdminMetrics(params);
    expect(client.get).toHaveBeenCalledWith("/admin/metrics", { params });
  });
});
