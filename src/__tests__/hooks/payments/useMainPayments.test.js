import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePayments } from "../../../hooks/payments/useMainPayments";
import { getMe, getMyObligations, getMyTransactions, getPaymentLinks } from "../../../api/members";
import { fetchCompleteMyCommunityList } from "../../../api/communityList";

vi.mock("../../../api/members", () => ({
  getMe: vi.fn(),
  getMyObligations: vi.fn(),
  getMyTransactions: vi.fn(),
  getPaymentLinks: vi.fn(),
}));
vi.mock("../../../api/communityList", () => ({ fetchCompleteMyCommunityList: vi.fn() }));

const response = (data) => ({ data: { data } });
const community = { id: "community-1", slug: "glass", name: "Glass", memberStatus: "ACTIVE" };

function mountPayments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => usePayments(), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
}

describe("member upcoming payments use only obligations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getMe.mockResolvedValue(response({ id: "user-1" }));
    fetchCompleteMyCommunityList.mockResolvedValue([community]);
    getMyTransactions.mockResolvedValue(response([]));
    getMyObligations.mockResolvedValue(response([]));
    getPaymentLinks.mockResolvedValue(
      response([{ id: "exempt-plan", title: "Community dues", amount: 10000, status: "ACTIVE" }]),
    );
  });

  it("shows no amount due for a member with no obligations despite active community plans", async () => {
    const { result } = mountPayments();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.upcoming).toEqual([]);
    expect(result.current.data.nextDue).toBeNull();
    expect(getPaymentLinks).not.toHaveBeenCalled();
  });

  it("keeps unpaid obligations and excludes paid ones without adding other community plans", async () => {
    getMyObligations.mockResolvedValue(
      response([
        {
          id: "due",
          amount: 10000,
          amountPaid: 2000,
          status: "DUE",
          community,
          dueAt: "2026-11-28",
        },
        { id: "paid", amount: 10000, status: "PAID", community },
      ]),
    );
    const { result } = mountPayments();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.upcoming.map((item) => item.id)).toEqual(["due"]);
    expect(result.current.data.nextDue).toMatchObject({
      id: "due",
      amount: 10000,
      amountPaid: 2000,
    });
  });
});
