import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePaymentPlans } from "../../hooks/usePaymentPlans";
import client from "../../api/client";

vi.mock("../../api/client", () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.get.mockResolvedValue({ data: { data: [] } });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => usePaymentPlans("comm-1"), { wrapper }) };
}

describe("payment plan deletion", () => {
  it("sends DELETE without a body and refreshes the removed plan list", async () => {
    client.delete.mockResolvedValue({ data: { data: "Payment link deleted" } });
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queryClient.setQueryData(["community", "comm-1", "members"], []);
    const before = client.get.mock.calls.length;
    await act(async () => {
      await result.current.delete.mutateAsync("draft-1");
    });
    expect(client.delete).toHaveBeenCalledWith("/communities/comm-1/payment-links/draft-1");
    expect(client.get.mock.calls.length).toBeGreaterThan(before);
    expect(queryClient.getQueryState(["community", "comm-1", "members"]).isInvalidated).toBe(true);
  });

  it("refreshes stale plan data after a conflict and leaves the mutation rejected", async () => {
    const error = { response: { status: 409, data: { description: "Concurrent change" } } };
    client.delete.mockRejectedValue(error);
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = client.get.mock.calls.length;
    await act(async () => {
      await expect(result.current.delete.mutateAsync("draft-1")).rejects.toBe(error);
    });
    expect(client.get.mock.calls.length).toBeGreaterThan(before);
    await waitFor(() => expect(result.current.delete.error).toBe(error));
  });
});
