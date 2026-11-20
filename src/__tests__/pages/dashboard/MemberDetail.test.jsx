import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MemberDetail from "../../../pages/dashboard/MemberDetail";
import client from "../../../api/client";

vi.mock("../../../api/client", () => ({ default: { get: vi.fn() } }));

const member = { id: "member-1", firstName: "Ada", lastName: "Obi", email: "ada@example.com" };
let stats;
let detailError;
let queryClient;
let paymentLinks;
let obligations;
let billingExempt;
let paymentLinksError;
let paymentLinksPending;

beforeEach(() => {
  stats = {
    totalPaymentAmount: 12500.5,
    activePaymentLinkCount: 4,
    pendingObligationPaymentLinkCount: 2,
    failedPaymentTransactionCount: 7,
  };
  detailError = null;
  paymentLinks = [];
  obligations = [];
  billingExempt = false;
  paymentLinksError = null;
  paymentLinksPending = false;
  client.get.mockImplementation(async (path, config) => {
    if (path.endsWith("/payment-links") && config?.params?.memberId) {
      if (paymentLinksPending) return new Promise(() => {});
      if (paymentLinksError) throw paymentLinksError;
      return { data: { data: paymentLinks } };
    }
    if (path.endsWith("/finance/obligations")) return { data: { data: obligations } };
    if (path.endsWith("/members/member-1")) {
      if (detailError) throw detailError;
      return { data: { data: { ...member, billingExempt, stats } } };
    }
    if (path.endsWith("/members")) return { data: { data: [{ ...member, billingExempt }] } };
    if (path.includes("/finance/") || path.endsWith("/payment-links")) {
      return { data: { data: [] } };
    }
    return { data: { data: { name: "Community" } } };
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/members/member-1?community=glass-community"]}>
        <Routes>
          <Route path="/members/:memberId" element={<MemberDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const valueFor = (label) => screen.getByText(label).parentElement.querySelector("span").textContent;

describe("MemberDetail statistics", () => {
  it("uses member detail aggregates even when transaction and plan lists are empty", async () => {
    renderPage();
    await waitFor(() => expect(valueFor("Total Amount Paid")).toBe("₦12,501"));
    expect(valueFor("Active Plans")).toBe("4");
    expect(valueFor("Plans Yet to pay")).toBe("2");
    expect(valueFor("Failed Payments")).toBe("7");
  });

  it("renders explicit zero aggregates as zero", async () => {
    stats = {
      totalPaymentAmount: 0,
      activePaymentLinkCount: 0,
      pendingObligationPaymentLinkCount: 0,
      failedPaymentTransactionCount: 0,
    };
    renderPage();
    await waitFor(() => expect(valueFor("Total Amount Paid")).toBe("₦0"));
    expect(valueFor("Active Plans")).toBe("0");
    expect(valueFor("Plans Yet to pay")).toBe("0");
    expect(valueFor("Failed Payments")).toBe("0");
  });

  it.each(["missing", "failed"])(
    "does not invent zero activity when detail stats are %s",
    async (state) => {
      stats = undefined;
      if (state === "failed") detailError = new Error("Unavailable");
      renderPage();
      await waitFor(() => expect(valueFor("Total Amount Paid")).toBe("—"));
      expect(valueFor("Active Plans")).toBe("—");
      expect(valueFor("Plans Yet to pay")).toBe("—");
      expect(valueFor("Failed Payments")).toBe("—");
    },
  );
});

describe("MemberDetail All Plans", () => {
  beforeEach(() => {
    obligations = [
      {
        id: "old-obligation",
        member: { id: "member-1" },
        paymentLink: { id: "old-link", title: "Old obligation plan" },
        amount: 500,
        status: "DUE",
      },
    ];
  });

  it.each([false, true])(
    "shows no plans for an empty response (billingExempt=%s)",
    async (exempt) => {
      billingExempt = exempt;
      renderPage();
      expect(await screen.findByText("No plans")).toBeTruthy();
      expect(screen.queryByText("Old obligation plan")).toBeNull();
      if (exempt) expect(screen.getByText(/billing exempt/i)).toBeTruthy();
      else expect(screen.queryByText(/billing exempt/i)).toBeNull();
    },
  );

  it("renders only returned links, including inactive plans, using link fields", async () => {
    paymentLinks = [
      {
        id: "link-1",
        title: "Returned plan",
        amount: 1200,
        status: "PAUSED",
        paymentType: "ONE_TIME",
        startAt: "2026-11-01",
        dueAt: "2026-11-30",
      },
    ];
    renderPage();
    expect(await screen.findByText("Returned plan")).toBeTruthy();
    expect(screen.getByText("₦1,200")).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.queryByText("Old obligation plan")).toBeNull();
    expect(screen.queryByText("Unpaid")).toBeNull();
  });

  it("does not show an empty state while the member links are loading", async () => {
    paymentLinksPending = true;
    renderPage();
    await screen.findByText("Ada Obi");
    expect(screen.getByRole("status", { name: "Loading plans" })).toBeTruthy();
    expect(screen.queryByText("No plans")).toBeNull();
    expect(screen.queryByText("Old obligation plan")).toBeNull();
  });

  it("shows an error instead of no plans when the request fails", async () => {
    paymentLinksError = new Error("Unavailable");
    renderPage();
    expect(await screen.findByText("Unable to load plans")).toBeTruthy();
    expect(screen.queryByText("No plans")).toBeNull();
    expect(screen.queryByText("Old obligation plan")).toBeNull();
  });
});
