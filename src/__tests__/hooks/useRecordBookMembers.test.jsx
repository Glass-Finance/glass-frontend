import { expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("../../api/communities", () => ({
  fetchAllCommunityMembers: vi.fn(),
  updateCommunityMember: vi.fn(),
  removeCommunityMember: vi.fn(),
}));
import { fetchAllCommunityMembers } from "../../api/communities";
import { useCommunityMembers } from "../../hooks/useCommunityMembers";
it("fetches historical memberships in a distinct cache from the active roster", async () => {
  fetchAllCommunityMembers.mockImplementation(async (_id, params) =>
    params ? [{ id: "exited", status: "EXITED" }] : [{ id: "active", status: "ACTIVE" }],
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      historical: useCommunityMembers("c", { includeHistorical: true }),
      active: useCommunityMembers("c"),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.historical.members[0]?.id).toBe("exited"));
  expect(result.current.active.members[0].id).toBe("active");
  expect(fetchAllCommunityMembers).toHaveBeenCalledWith("c", { status: undefined });
});
