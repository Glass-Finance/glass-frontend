import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PaystackAccount from "../../../../../pages/dashboard/settings/finance/PaystackAccount";
import { useActiveCommunityId } from "../../../../../hooks/useActiveCommunityId";
import { useCommunityAccount } from "../../../../../hooks/useCommunityAccount";
import { useCommunity } from "../../../../../hooks/useCommunity";
import { getBanks, resolveAccount } from "../../../../../api/members";

// Payout account CREATION is the last item from the original Tier 1 test
// coverage scoping plan (removal was covered separately). It's the
// opposite risk shape from removal: the danger here isn't "fires too
// easily," it's "silently saves a wrong/unverified account" -- so what
// matters most is that create.mutateAsync is never called while the
// account name is still empty or still being auto-verified, and that it's
// called with exactly what the form actually resolved, not something
// half-typed.

vi.mock("../../../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: vi.fn(),
}));
vi.mock("../../../../../hooks/useCommunityAccount", () => ({
  useCommunityAccount: vi.fn(),
}));
vi.mock("../../../../../hooks/useCommunity", () => ({
  useCommunity: vi.fn(),
}));
vi.mock("../../../../../api/members", async () => {
  const actual = await vi.importActual("../../../../../api/members");
  return { ...actual, getBanks: vi.fn(), resolveAccount: vi.fn() };
});

const ZENITH = { code: "057", name: "Zenith Bank", slug: "zenith-bank" };

let createMutateAsync;

beforeEach(() => {
  useActiveCommunityId.mockReturnValue("comm-1");
  useCommunity.mockReturnValue({ data: { name: "Kings College Alumni" } });

  getBanks.mockReset();
  resolveAccount.mockReset();

  createMutateAsync = vi.fn().mockResolvedValue({});
  useCommunityAccount.mockReturnValue({
    account: null,
    isLoading: false,
    create: { mutateAsync: createMutateAsync, isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  });

  getBanks.mockResolvedValue({ data: { data: [ZENITH] } });
  resolveAccount.mockResolvedValue({ data: { data: { accountName: "Kings College Alumni" } } });
});

function renderPage() {
  // The account form reads the bank list through useBanks and resolves the
  // account name through useResolveAccount — both React Query hooks, so the
  // page needs a QueryClient. Retries are off: this test asserts on the
  // resolved state, and a retried request would only slow it down.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PaystackAccount />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openFormAndFillBankAndNumber() {
  (await screen.findByText("Add Payout Account")).click();
  (await screen.findByText("Select bank")).click();
  (await screen.findByText("Zenith Bank")).click();
  const numberInput = screen.getByPlaceholderText("0457359705");
  fireEvent.change(numberInput, { target: { value: "0123456789" } });
}

describe("PaystackAccount creation flow", () => {
  it("never calls create.mutateAsync just from opening the form", async () => {
    renderPage();
    (await screen.findByText("Add Payout Account")).click();

    await screen.findByText("Save Changes");
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it("the Save button stays disabled while the account name is still auto-resolving", async () => {
    // Resolve slowly on purpose so we can observe the disabled state
    // during the in-flight window, not just before/after.
    let resolveLookup;
    resolveAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    renderPage();
    await openFormAndFillBankAndNumber();

    // "disabled" is trivially true before any of this too (empty account
    // name) -- what actually matters is that it's STILL true once the
    // debounced lookup has genuinely started, not just at the beginning.
    await waitFor(() => expect(resolveAccount).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(screen.getByText("Save Changes").disabled).toBe(true);
    expect(createMutateAsync).not.toHaveBeenCalled();

    resolveLookup({ data: { data: { accountName: "Kings College Alumni" } } });
  });

  it("calls create.mutateAsync with the resolved bank/account details only after clicking Save", async () => {
    renderPage();
    await openFormAndFillBankAndNumber();

    await waitFor(() => expect(screen.getByText("Save Changes").disabled).toBe(false), {
      timeout: 2000,
    });
    screen.getByText("Save Changes").click();

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      settlementBank: "Zenith Bank",
      settlementBankCode: "057",
      settlementBankSlug: "zenith-bank",
      accountNumber: "0123456789",
      accountName: "Kings College Alumni",
    });
  });

  it("never calls create.mutateAsync when auto-resolve fails and no manual name is entered", async () => {
    resolveAccount.mockRejectedValueOnce({});
    renderPage();
    await openFormAndFillBankAndNumber();

    // Auto-resolve fails -> falls into manual-entry mode with an empty
    // name. Save must not be clickable with nothing typed.
    await screen.findByPlaceholderText("Type account name");
    const saveButton = screen.getByText("Save Changes");
    expect(saveButton.disabled).toBe(true);
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it("on a failed create call, shows the server's error and does not silently succeed", async () => {
    createMutateAsync.mockRejectedValueOnce({
      response: {
        data: { description: "This bank account is already linked to another community." },
      },
    });
    renderPage();
    await openFormAndFillBankAndNumber();

    await waitFor(() => expect(screen.getByText("Save Changes").disabled).toBe(false), {
      timeout: 2000,
    });
    screen.getByText("Save Changes").click();

    await screen.findByText("This bank account is already linked to another community.");
  });
});
