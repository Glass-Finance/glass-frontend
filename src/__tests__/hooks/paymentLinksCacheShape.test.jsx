import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePaymentPlans } from "../../hooks/usePaymentPlans";
import { useMemberPaymentLinks } from "../../hooks/useMembersWithPayments";
import { getCommunityPaymentLinks } from "../../api/payments";

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

const CID = "community-1";
const PREFIX_KEY = ["community", CID, "payment-links"];
const RAW_KEY = [...PREFIX_KEY, "member", "member-1"];
const PLANS_KEY = ["community", CID, "payment-links", "plans"];

// The same GET .../payment-links response both hooks read. usePaymentPlans
// maps it through shapePlan; useMemberPaymentLinks keeps it raw and
// exposes raw links. The two shapes are mutually unreadable, which is the point.
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
    id: "link-archived",
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
    members = renderHook(() => useMemberPaymentLinks(CID, "member-1"), { wrapper });
  } else {
    members = renderHook(() => useMemberPaymentLinks(CID, "member-1"), { wrapper });
    plans = renderHook(() => usePaymentPlans(CID), { wrapper });
  }

  return { queryClient, plans, members };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getCommunityPaymentLinks.mockImplementation(async () => ENVELOPE(RAW_LINKS));
});

describe('F2 — ["community", id, "payment-links"] cache shape', () => {
  it.each(["plans-first", "members-first"])(
    "keeps the plan list and the raw member-payment list in separate entries (%s)",
    async (order) => {
      const { queryClient, plans, members } = mountInOrder(order);

      await waitFor(() => expect(plans.result.current.plans).toHaveLength(2));
      await waitFor(() => expect(members.result.current.paymentLinks).toHaveLength(2));

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

      expect(members.result.current.paymentLinks[0].title).toBe("Dues");
      expect(members.result.current.paymentLinks[1].title).toBe("Last term's plan");
    },
  );

  it('still reaches both entries through the ["community", id, "payment-links"] prefix', async () => {
    const { queryClient, plans, members } = mountInOrder("plans-first");
    await waitFor(() => expect(plans.result.current.plans).toHaveLength(2));
    await waitFor(() => expect(members.result.current.paymentLinks).toHaveLength(2));

    const before = getCommunityPaymentLinks.mock.calls.length;
    expect(before).toBe(2);

    // What usePaymentPlans.invalidate() issues after create/update/archive.
    await queryClient.invalidateQueries({ queryKey: PREFIX_KEY });

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
    expect(plans.result.current.plans).toEqual([]);
    expect(members.result.current.paymentLinks).toEqual([]);
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

it("refreshes member list and detail stats after a payment-plan mutation", async () => {
  const { queryClient, plans } = mountInOrder("plans-first");
  await waitFor(() => expect(plans.result.current.plans).toHaveLength(2));
  const listKey = ["community", CID, "members"];
  const detailKey = [...listKey, "detail", "member-1"];
  const otherKey = ["community", "other-community", "members"];
  queryClient.setQueryData(listKey, [{ id: "member-1", stats: { activePaymentLinkCount: 1 } }]);
  queryClient.setQueryData(detailKey, { id: "member-1", stats: { activePaymentLinkCount: 1 } });
  queryClient.setQueryData(otherKey, []);
  await act(async () => {
    await plans.result.current.activate.mutateAsync("link-active");
  });
  expect(queryClient.getQueryState(listKey).isInvalidated).toBe(true);
  expect(queryClient.getQueryState(detailKey).isInvalidated).toBe(true);
  expect(queryClient.getQueryState(otherKey).isInvalidated).toBe(false);
});
