import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("../../api/communityRecords", () => ({
  getCommunityRecords: vi.fn(),
  getCommunityRecord: vi.fn(),
  createCommunityRecord: vi.fn(),
  updateCommunityRecord: vi.fn(),
  deleteCommunityRecord: vi.fn(),
}));
vi.mock("../../api/recordImports", () => ({
  getRecordImports: vi.fn(),
  getRecordImport: vi.fn(),
  submitRecordImport: vi.fn(),
  commitRecordImport: vi.fn(),
  discardRecordImport: vi.fn(),
  retryRecordImport: vi.fn(),
  rerunRecordImport: vi.fn(),
}));
import { getCommunityRecords } from "../../api/communityRecords";
import { getRecordImport } from "../../api/recordImports";
import { useCommunityRecords } from "../../hooks/useCommunityRecords";
import { useRecordImport } from "../../hooks/useRecordImports";
import { recordKeys, refreshRecordImportEvent } from "../../utils/recordBookQueryKeys";
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
describe("record book scoped state", () => {
  it("retains one-based page envelopes and all server filter parameters", async () => {
    getCommunityRecords.mockResolvedValue({
      data: { data: { content: [{ id: "r" }], pageNumber: 2, totalPages: 3, totalElements: 51 } },
    });
    const params = { pageNumber: 2, search: "%_!", type: "EXPENSE" };
    const { result } = renderHook(() => useCommunityRecords("c", params), setup());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.pageNumber).toBe(2);
    expect(getCommunityRecords).toHaveBeenCalledWith("c", params);
  });
  it("never reuses another community's job data", async () => {
    getRecordImport.mockImplementation(async (c) => ({
      data: { data: { id: "j", communityId: c, status: "READY_FOR_REVIEW" } },
    }));
    const { result, rerender } = renderHook(({ c }) => useRecordImport(c, "j"), {
      ...setup(),
      initialProps: { c: "a" },
    });
    await waitFor(() => expect(result.current.data?.communityId).toBe("a"));
    rerender({ c: "b" });
    expect(result.current.data?.communityId).not.toBe("a");
    await waitFor(() => expect(result.current.data?.communityId).toBe("b"));
  });
  it("only invalidates the event's community and ignores old sequences", () => {
    const { client } = setup();
    client.setQueryData(recordKeys.job("a", "j"), { status: "READY_FOR_REVIEW" });
    client.setQueryData(recordKeys.job("b", "j"), { status: "READY_FOR_REVIEW" });
    client.setQueryData(recordKeys.records("a"), { content: [] });
    const seen = new Map();
    refreshRecordImportEvent(
      client,
      { communityId: "a", jobId: "j", status: "COMMITTED", sequence: 4 },
      seen,
    );
    expect(client.getQueryState(recordKeys.job("a", "j")).isInvalidated).toBe(true);
    expect(client.getQueryState(recordKeys.job("b", "j")).isInvalidated).toBe(false);
    expect(client.getQueryState(recordKeys.records("a")).isInvalidated).toBe(true);
    client.setQueryData(recordKeys.job("a", "j"), { status: "COMMITTED" });
    refreshRecordImportEvent(
      client,
      { communityId: "a", jobId: "j", status: "QUEUED", sequence: 1 },
      seen,
    );
    expect(client.getQueryState(recordKeys.job("a", "j")).isInvalidated).toBe(false);
  });
});

it("refreshes records when polling discovers a committed job without an SSE event", async () => {
  const { client, wrapper } = setup();
  client.setQueryData(recordKeys.records("c"), { content: [] });
  getRecordImport.mockResolvedValue({
    data: { data: { id: "j", communityId: "c", status: "COMMITTED" } },
  });
  const { result } = renderHook(() => useRecordImport("c", "j"), { wrapper });
  await waitFor(() => expect(result.current.data?.status).toBe("COMMITTED"));
  await waitFor(() =>
    expect(client.getQueryState(recordKeys.records("c")).isInvalidated).toBe(true),
  );
});
