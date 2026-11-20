import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePaymentPlans } from "../../hooks/usePaymentPlans";
import { useCommunityMembers } from "../../hooks/useCommunityMembers";
import client from "../../api/client";

vi.mock("../../api/client", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const keys = [
  ["community", "crew", "members", "detail", "m1"],
  ["community", "crew", "obligations"],
  ["community", "crew", "payment-links", "member", "m1"],
  ["member-record", "crew"],
  ["obligations"],
  ["admin-obligations"],
];

it.each(["expiry", "exemption"])("refreshes billing data after successful %s", async (kind) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of keys) queryClient.setQueryData(key, []);
  queryClient.setQueryData(["community", "other", "members"], []);
  client.get.mockResolvedValue({ data: { data: [] } });
  client.patch.mockResolvedValue({ data: { data: {} } });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const useResource = kind === "expiry" ? usePaymentPlans : useCommunityMembers;
  const { result } = renderHook(() => useResource("crew"), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => {
    if (kind === "expiry") await result.current.expire.mutateAsync("plan-1");
    else
      await result.current.updateMember.mutateAsync({
        memberId: "m1",
        payload: { billingExempt: true },
      });
  });
  for (const key of keys) expect(queryClient.getQueryState(key).isInvalidated).toBe(true);
  expect(queryClient.getQueryState(["community", "other", "members"]).isInvalidated).toBe(false);
  queryClient.clear();
});

it.each(["expiry", "exemption"])("does not refresh billing after a rejected %s", async (kind) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["obligations"], []);
  client.get.mockResolvedValue({ data: { data: [] } });
  const error = new Error("Rejected");
  client.patch.mockRejectedValue(error);
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const useResource = kind === "expiry" ? usePaymentPlans : useCommunityMembers;
  const { result } = renderHook(() => useResource("crew"), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => {
    const promise =
      kind === "expiry"
        ? result.current.expire.mutateAsync("plan-1")
        : result.current.updateMember.mutateAsync({
            memberId: "m1",
            payload: { billingExempt: true },
          });
    await expect(promise).rejects.toBe(error);
  });
  expect(queryClient.getQueryState(["obligations"]).isInvalidated).toBe(false);
  queryClient.clear();
});
