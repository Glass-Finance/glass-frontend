import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMembersWithPayments } from "../../hooks/useMembersWithPayments";
import client from "../../api/client";

vi.mock("../../api/client", () => ({ default: { get: vi.fn() } }));

let queryClient;
let member;

beforeEach(() => {
  member = {
    id: "member-1",
    billingExempt: false,
    stats: {
      totalPaymentAmount: 12500.5,
      activePaymentLinkCount: 6,
      pendingObligationPaymentLinkCount: 2,
      paidObligationPaymentLinkCount: 3,
      totalObligationPaymentLinkCount: 5,
      failedPaymentTransactionCount: 7,
    },
  };
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.get.mockImplementation(async (path) => {
    if (path.endsWith("/members")) {
      return { data: { data: { content: [member], last: true } } };
    }
    // Deliberately inconsistent with server stats: list slices must not
    // determine aggregate counts, even with multiple cycles of one plan.
    if (path.endsWith("/finance/obligations")) {
      return {
        data: {
          data: [1, 2].map((id) => ({
            id,
            member: { id: member.id },
            paymentLink: { id: "old-link" },
            status: "PAID",
          })),
        },
      };
    }
    if (path.endsWith("/finance/transactions")) {
      return {
        data: {
          data: [
            {
              id: "tx-1",
              member: { id: member.id },
              status: "SUCCESSFUL",
              paidAt: "2026-11-17T12:00:00Z",
            },
          ],
        },
      };
    }
    return { data: { data: [{ id: "active-link", status: "ACTIVE" }] } };
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.clearAllMocks();
});

async function mount() {
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useMembersWithPayments("community-1"), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("member list payment statistics", () => {
  it("uses server counts instead of active links or paginated financial lists", async () => {
    const hook = await mount();
    expect(hook.result.current.members[0]).toMatchObject({
      planCount: 5,
      totalCount: 5,
      paidCount: 3,
      failedCount: 7,
      lastPaymentDate: "2026-11-17T12:00:00Z",
    });
    expect(hook.result.current.members[0].obligations).toHaveLength(2);
    expect(client.get.mock.calls.some(([path]) => path.endsWith("/payment-links"))).toBe(false);
  });

  it("retains paid and waived history counts for billing-exempt members", async () => {
    member.billingExempt = true;
    member.stats.activePaymentLinkCount = 0;
    const hook = await mount();
    expect(hook.result.current.members[0]).toMatchObject({
      planCount: 5,
      totalCount: 5,
      paidCount: 3,
    });
  });

  it("preserves explicit zero statistics despite existing financial records", async () => {
    member.stats = Object.fromEntries(Object.keys(member.stats).map((key) => [key, 0]));
    const hook = await mount();
    expect(hook.result.current.members[0]).toMatchObject({
      planCount: 0,
      totalCount: 0,
      paidCount: 0,
      failedCount: 0,
    });
  });

  it("keeps missing statistics unavailable instead of deriving or inventing zero activity", async () => {
    delete member.stats;
    const hook = await mount();
    expect(hook.result.current.members[0]).toMatchObject({
      planCount: null,
      totalCount: null,
      paidCount: null,
      failedCount: null,
    });
  });
});
