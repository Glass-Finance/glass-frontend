import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpcomingPayments from "../../../pages/memberApp/UpcomingPayments";
import { usePayments } from "../../../hooks/usePayments";
import { useExportJob } from "../../../hooks/useExportJob";

vi.mock("../../../hooks/usePayments");
vi.mock("../../../hooks/useExportJob");
vi.mock("../../../api/exports", () => ({ exportMyObligations: vi.fn() }));

const navigateSpy = vi.fn();
const refreshSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateSpy };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <UpcomingPayments />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
  refreshSpy.mockClear();
  usePayments.mockReturnValue({
    data: { upcoming: [] },
    isLoading: false,
    error: null,
    refresh: refreshSpy,
  });
  useExportJob.mockReturnValue({ run: vi.fn(), isExporting: false });
});

describe("UpcomingPayments desktop empty state", () => {
  it("offers refresh, payment history, and notification actions", () => {
    renderPage();

    expect(screen.getByText("You're all caught up")).toBeTruthy();
    const mobileHeading = screen.getByText("Nothing due right now");
    expect(mobileHeading).toBeTruthy();
    expect(mobileHeading.className).toContain("text-sm");
    expect(mobileHeading.className).not.toContain("text-[22px]");
    const illustrations = document.querySelectorAll('img[alt=""][aria-hidden="true"]');
    expect(illustrations).toHaveLength(2);
    for (const illustration of illustrations) {
      expect(illustration.className).toContain("h-20");
      expect(illustration.className).toContain("w-20");
    }
    expect(screen.getByText("You're up to date on all payments.")).toBeTruthy();
    expect(
      screen.getByText(/When a community adds a payment, it will show up here with its due date/),
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Check again" })[0]);
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "View payment history" }));
    expect(navigateSpy).toHaveBeenCalledWith("/member/transactions");

    fireEvent.click(screen.getByRole("button", { name: "Turn on notifications" }));
    expect(navigateSpy).toHaveBeenCalledWith("/member/notification-settings");
  });
});
