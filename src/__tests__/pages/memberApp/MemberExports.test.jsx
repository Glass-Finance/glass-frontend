import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Transactions from "../../../pages/memberApp/Transactions";
import UpcomingPayments from "../../../pages/memberApp/UpcomingPayments";
import { useExportJob } from "../../../hooks/useExportJob";
import { exportMyTransactions, exportMyObligations } from "../../../api/exports";
import { useTransactions } from "../../../hooks/useTransactions";
import { usePayments } from "../../../hooks/usePayments";

// Members had no way to get their own payment data out of the app, even
// though the backend has had ExportScope.USER jobs for them the whole time
// (POST /finance/transactions/me/export, /finance/obligations/me/export, both
// pollable through the caller-scoped GET /exports/{id}).
vi.mock("../../../hooks/useExportJob");
vi.mock("../../../api/exports", () => ({
  exportMyTransactions: vi.fn(),
  exportMyObligations: vi.fn(),
}));
vi.mock("../../../hooks/useTransactions");
vi.mock("../../../hooks/usePayments");
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

let run;
beforeEach(() => {
  run = vi.fn();
  useExportJob.mockReturnValue({ run, isExporting: false });
  exportMyTransactions.mockReturnValue(Promise.resolve({ data: { data: { id: "job-1" } } }));
  exportMyObligations.mockReturnValue(Promise.resolve({ data: { data: { id: "job-2" } } }));
  useTransactions.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
  usePayments.mockReturnValue({ data: { upcoming: [] }, isLoading: false, refresh: vi.fn() });
});

function clickExport(name) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("member exports", () => {
  it("renders the desktop payment history empty state", () => {
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "No Payment History" })).toBeTruthy();
    expect(
      screen.getAllByText("Once you make payment, your transaction history will appear here."),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: /All Status/ })).toBeTruthy();
  });

  it("exports the member's payment history through the shared job runner", () => {
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>,
    );
    clickExport(/export payment history as csv/i);
    const trigger = run.mock.calls[0][0];
    trigger();
    expect(exportMyTransactions).toHaveBeenCalledWith({});
  });

  it("exports the member's upcoming payments", () => {
    render(
      <MemoryRouter>
        <UpcomingPayments />
      </MemoryRouter>,
    );
    clickExport(/export upcoming payments as csv/i);
    const trigger = run.mock.calls[0][0];
    trigger();
    expect(exportMyObligations).toHaveBeenCalledWith({});
  });

  it("disables the button and relabels it while a job is being prepared", () => {
    useExportJob.mockReturnValue({ run, isExporting: true });
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: /preparing export/i });
    expect(btn.disabled).toBe(true);
  });

  it("forwards the selected status to the backend, which supports it server-side", () => {
    render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>,
    );
    // The visible filter is a label ("Success"); the export has to send the
    // backend's enum, or the export silently ignores the filter the member
    // is looking at.
    fireEvent.click(screen.getByRole("button", { name: /All Status/ }));
    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    clickExport(/export payment history as csv/i);

    const trigger = run.mock.calls[0][0];
    trigger();
    expect(exportMyTransactions).toHaveBeenCalledWith({ status: "SUCCESS" });
  });
});
