import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePaymentPlans } from "../../hooks/usePaymentPlans";
import { useMembersWithPayments } from "../../hooks/useMembersWithPayments";
import { getCommunityPaymentLinks } from "../../api/payments";
import { fetchAllCommunityMembers } from "../../api/communities";
import {
  fetchAllCommunityObligations,
  fetchAllCommunityTransactions,
} from "../../api/transactions";

vi.mock("../../api/payments", () => ({
  getCommunityPaymentLinks: vi.fn(),
  createPaymentLink: vi.fn(),
  updatePaymentLink: vi.fn(),
  activatePaymentLink: vi.fn(),
  pausePaymentLink: vi.fn(),
  resumePaymentLink: vi.fn(),
  expirePaymentLink: vi.fn(),
  deletePaymentLink: vi.fn(),
  duplicatePaymentLink: vi.fn(),
}));

vi.mock("../../api/communities", () => ({
  fetchAllCommunityMembers: vi.fn(),
}));

vi.mock("../../api/transactions", () => ({
  fetchAllCommunityObligations: vi.fn(),
  fetchAllCommunityTransactions: vi.fn(),
}));

const CID = "community-1";
const RAW_KEY = ["community", CID, "payment-links"];
const PLANS_KEY = ["community", CID, "payment-links", "plans"];

// The same GET .../payment-links response both hooks read. usePaymentPlans
// maps it through shapePlan; useMembersWithPayments keeps it raw and only
// reads id/status. The two shapes are mutually unreadable, which is the point.
const RAW_LINKS = [
  {
    id: "link-active",
    title: "Dues",
    status: "ACTIVE",
    amount: 5000,
    paymentType: "ONE_TIME",
    metrics: {
      amountCollected: 2500,
      expectedAmount: 5000,
      currency: "NGN",
      audienceSize: 4,
      membersFullyPaid: 1,
      membersPartiallyPaid: 1,
      membersUnpaid: 2,
    },
  },
  {
    id: "link-deleted",
    title: "Last term's plan",
    status: "DELETED",
    amount: 1000,
    paymentType: "ONE_TIME",
    metrics: {
      amountCollected: 0,
      expectedAmount: 0,
      currency: "NGN",
      audienceSize: 0,
      membersFullyPaid: 0,
      membersPartiallyPaid: 0,
      membersUnpaid: 0,
    },
  },
];

const ENVELOPE = (content) => ({ data: { data: { content, pageNumber: 0 } } });

// Mounts both observers against one QueryClient in a chosen order — the
// first one to register decides the shape of a shared key, which is exactly
// the race the old single-key arrangement lost.
function mountInOrder(order) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let plans;
  let members;
  if (order === "plans-first") {
    plans = renderHook(() => usePaymentPlans(CID), { wrapper });
    members = renderHook(() => useMembersWithPayments(CID), { wrapper });
  } else {
    members = renderHook(() => useMembersWithPayments(CID), { wrapper });
    plans = renderHook(() => usePaymentPlans(CID), { wrapper });
  }

  return { queryClient, plans, members };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // getCommunityPaymentLinks returns the raw axios response (the hooks unwrap
  // it); the three fetchAll* helpers below already unwrap to bare arrays.
  getCommunityPaymentLinks.mockImplementation(async () => ENVELOPE(RAW_LINKS));
  fetchAllCommunityMembers.mockResolvedValue([
    { id: "member-1", name: "Ada", user: { id: "user-1" } },
  ]);
  fetchAllCommunityObligations.mockResolvedValue([]);
  fetchAllCommunityTransactions.mockResolvedValue([]);
});

describe('F2 — ["community", id, "payment-links"] cache shape', () => {
  it.each(["plans-first", "members-first"])(
    "keeps the plan list and the raw member-payment list in separate entries (%s)",
    async (order) => {
      const { queryClient, plans, members } = mountInOrder(order);

      await waitFor(() => expect(plans.result.current.plans).toHaveLength(2));
      await waitFor(() => expect(members.result.current.members).toHaveLength(1));

      const raw = queryClient.getQueryData(RAW_KEY);
      const shaped = queryClient.getQueryData(PLANS_KEY);

      // Two distinct entries — neither hook can poison the other's.
      expect(raw).toBeDefined();
      expect(shaped).toBeDefined();
      expect(raw).toHaveLength(2);
      expect(shaped).toHaveLength(2);

      // Raw entry: PaymentLink records (title/status/metrics), no plan fields.
      expect(raw[0]).toMatchObject({ id: "link-active", title: "Dues", status: "ACTIVE" });
      expect(raw[0].name).toBeUndefined();
      expect(raw[0].paidCount).toBeUndefined();

      // Plan entry: shaped plan summaries, no raw PaymentLink fields.
      expect(shaped[0]).toMatchObject({
        id: "link-active",
        name: "Dues",
        paidCount: 1,
        partialCount: 1,
        unpaidCount: 2,
        totalCount: 4,
        amountCollected: 2500,
        expectedAmount: 5000,
        status: "ACTIVE",
      });
      expect(shaped[0].title).toBeUndefined();
      expect(shaped[0].metrics).toBeUndefined();

      // Plan consumers actually receive the shaped objects...
      expect(plans.result.current.plans[0].name).toBe("Dues");
      expect(plans.result.current.plans[1].name).toBe("Last term's plan");

      // ...and the member-payment consumer still derives plan coverage from
      // the RAW list: only the ACTIVE link counts (deleted one excluded).
      expect(members.result.current.members[0].planCount).toBe(1);
      expect(members.result.current.members[0].totalCount).toBe(1);
      expect(members.result.current.members[0].paidCount).toBe(0);
    },
  );

  it('still reaches both entries through the ["community", id, "payment-links"] prefix', async () => {
    const { queryClient, plans, members } = mountInOrder("plans-first");
    await waitFor(() => expect(plans.result.current.plans).toHaveLength(2));
    await waitFor(() => expect(members.result.current.members).toHaveLength(1));

    const before = getCommunityPaymentLinks.mock.calls.length;
    expect(before).toBe(2);

    // What usePaymentPlans.invalidate() issues after create/update/deleteDraft.
    await queryClient.invalidateQueries({ queryKey: RAW_KEY });

    await waitFor(() => expect(getCommunityPaymentLinks.mock.calls.length).toBe(before + 2));
    expect(queryClient.getQueryState(PLANS_KEY)).toBeDefined();
    expect(queryClient.getQueryState(RAW_KEY)).toBeDefined();
  });

  it("keeps both entries empty when the endpoint returns an empty envelope", async () => {
    getCommunityPaymentLinks.mockResolvedValue(ENVELOPE([]));
    const { queryClient, plans, members } = mountInOrder("plans-first");

    // Wait on the cache (not `isLoading`, which is true-ish on first render)
    // so the assertions only run once both queries have resolved.
    await waitFor(() => expect(queryClient.getQueryData(PLANS_KEY)).toEqual([]));
    await waitFor(() => expect(queryClient.getQueryData(RAW_KEY)).toEqual([]));
    await waitFor(() => expect(members.result.current.members).toHaveLength(1));

    expect(plans.result.current.plans).toEqual([]);
    expect(members.result.current.members[0].planCount).toBe(0);
    expect(members.result.current.members[0].totalCount).toBe(0);
  });

  it("tolerates an empty data object instead of a content array", async () => {
    getCommunityPaymentLinks.mockResolvedValue({ data: { data: {} } });
    const { queryClient, plans, members } = mountInOrder("members-first");

    await waitFor(() => expect(queryClient.getQueryData(PLANS_KEY)).toEqual([]));
    await waitFor(() => expect(queryClient.getQueryData(RAW_KEY)).toEqual([]));

    expect(plans.result.current.plans).toEqual([]);
    expect(members.result.current.isLoading).toBe(false);
    expect(members.result.current.error).toBeNull();
  });
});
