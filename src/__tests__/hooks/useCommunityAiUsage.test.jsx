import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCommunityAiUsage } from "../../api/communityAiUsage";
import { useCommunityAiUsageList } from "../../hooks/useCommunityAiUsage";
import { recordKeys, refreshRecordImportEvent } from "../../utils/recordBookQueryKeys";

vi.mock("../../api/communityAiUsage", () => ({
  getCommunityAiUsage: vi.fn(),
  getRecordImportUsage: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
const response = (id, page = 1) => ({
  data: {
    data: {
      content: [{ id: `${id}-${page}`, communityId: id, feature: "RECORD_IMPORT" }],
      pageNumber: page,
      totalPages: 2,
      totalElements: 11,
    },
  },
});
describe("community AI usage list", () => {
  it("keeps page envelopes and isolates communities and pages", async () => {
    getCommunityAiUsage.mockImplementation(async (id, params) => response(id, params.pageNumber));
    const { result, rerender } = renderHook(
      ({ id, page }) => useCommunityAiUsageList(id, { pageNumber: page, pageSize: 10 }),
      {
        ...setup(),
        initialProps: { id: "a", page: 1 },
      },
    );
    await waitFor(() => expect(result.current.data?.content[0].id).toBe("a-1"));
    rerender({ id: "a", page: 2 });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.pageNumber).toBe(2));
    rerender({ id: "b", page: 1 });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.content[0].communityId).toBe("b"));
    expect(getCommunityAiUsage).toHaveBeenLastCalledWith("b", { pageNumber: 1, pageSize: 10 });
  });
  it("never fetches before permission and community resolution", async () => {
    const { result, rerender } = renderHook(
      ({ id, allowed }) => useCommunityAiUsageList(id, {}, allowed),
      {
        ...setup(),
        initialProps: { id: "a", allowed: false },
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    rerender({ id: undefined, allowed: true });
    expect(result.current.fetchStatus).toBe("idle");
    expect(getCommunityAiUsage).not.toHaveBeenCalled();
  });
  it("refreshes list and detail together for an import event, only in its community", async () => {
    getCommunityAiUsage.mockResolvedValue(response("a"));
    const { client, wrapper } = setup();
    client.setQueryData(recordKeys.usage("a"), { remainingUnits: 5 });
    client.setQueryData(recordKeys.usageList("b", {}), response("b").data.data);
    const { result } = renderHook(() => useCommunityAiUsageList("a", {}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    getCommunityAiUsage.mockResolvedValue(response("a", 2));
    act(() =>
      refreshRecordImportEvent(
        client,
        { communityId: "a", jobId: "j", status: "MAPPING", sequence: 1 },
        new Map(),
      ),
    );
    await waitFor(() => expect(result.current.data?.pageNumber).toBe(2));
    expect(client.getQueryState(recordKeys.usage("a")).isInvalidated).toBe(true);
    expect(client.getQueryState(recordKeys.usageList("b", {})).isInvalidated).toBe(false);
  });
});
