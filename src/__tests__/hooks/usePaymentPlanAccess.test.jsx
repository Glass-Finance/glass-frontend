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
import { usePaymentPlanAccess } from "../../hooks/usePaymentPlanAccess";
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
describe("payment plan delete permissions", () => {
  it.each([
    ["community.payment_links.delete", true],
    ["community.payment_links.update", false],
    ["community.recordbook.delete", false],
  ])("checks the exact permission %s", async (code, expected) => {
    state.community = { id: "c", slug: "crew", owned: true };
    getCommunityRole.mockResolvedValue({ data: { data: { permissions: [{ code }] } } });
    const { result } = renderHook(usePaymentPlanAccess, setup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canDelete).toBe(expected);
    expect(getCommunityRole).toHaveBeenLastCalledWith("COMMUNITY_OWNER");
  });
  it("fails closed for unknown roles", () => {
    state.community = { id: "c", slug: "crew", memberRole: "MANAGER" };
    const { result } = renderHook(usePaymentPlanAccess, setup());
    expect(result.current.canDelete).toBe(false);
  });
});
