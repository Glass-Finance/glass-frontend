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

beforeEach(() => {
  stats = {
    totalPaymentAmount: 12500.5,
    activePaymentLinkCount: 4,
    pendingObligationPaymentLinkCount: 2,
    failedPaymentTransactionCount: 7,
  };
  detailError = null;
  client.get.mockImplementation(async (path) => {
    if (path.endsWith("/members/member-1")) {
      if (detailError) throw detailError;
      return { data: { data: { ...member, stats } } };
    }
    if (path.endsWith("/members")) return { data: { data: [member] } };
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
