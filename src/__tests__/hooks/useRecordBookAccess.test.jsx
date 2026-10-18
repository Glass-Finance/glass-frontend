import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const state = vi.hoisted(() => ({ community: { id: "c", slug: "crew", owned: true } }));
vi.mock("../../hooks/useCommunities", () => ({
  useCommunities: () => ({ data: { communities: [state.community] } }),
}));
vi.mock("../../hooks/useActiveCommunityId", () => ({ useActiveCommunityId: () => "crew" }));
vi.mock("../../api/roles", () => ({ getCommunityRole: vi.fn() }));
import { getCommunityRole } from "../../api/roles";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
describe("record book permission visibility", () => {
  it("resolves owners without a fabricated member and separates import from usage permission", async () => {
    state.community = { id: "c", slug: "crew", owned: true };
    getCommunityRole.mockResolvedValue({
      data: {
        data: {
          permissions: [
            { code: "community.recordbook.read" },
            { code: "community.recordbook.import" },
          ],
        },
      },
    });
    const { result } = renderHook(useRecordBookAccess, setup());
    await waitFor(() => expect(result.current.import).toBe(true));
    expect(getCommunityRole).toHaveBeenCalledWith("COMMUNITY_OWNER");
    expect(result.current.id).toBe("c");
    expect(result.current.usage).toBe(false);
    expect(result.current.create).toBe(false);
  });
  it("fails closed for an unknown role even if a cached role could contain permissions", () => {
    state.community = { id: "c", slug: "crew", owned: false, memberRole: "MANAGER" };
    const { result } = renderHook(useRecordBookAccess, setup());
    expect(result.current.read).toBe(false);
    expect(result.current.import).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
