import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecordsTable from "../../../../pages/dashboard/records/RecordsTable";

const row = { id: "r1", payerName: "Ada", description: "Annual dues", amount: 25, currency: "NGN" };

describe("record row navigation", () => {
  it("opens desktop rows and mobile cards by click, Enter and Space", () => {
    const onOpen = vi.fn();
    render(<RecordsTable rows={[row]} onOpen={onOpen} />);
    const containers = screen.getAllByLabelText("Open record for Ada");
    expect(containers).toHaveLength(2);
    for (const container of containers) {
      fireEvent.click(container);
      fireEvent.keyDown(container, { key: "Enter" });
      fireEvent.keyDown(container, { key: " " });
    }
    expect(onOpen).toHaveBeenCalledTimes(6);
    expect(onOpen).toHaveBeenLastCalledWith(row);
  });

  it("keeps selection independent and opens only once from Details", () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(<RecordsTable rows={[row]} onOpen={onOpen} review onSelect={onSelect} />);
    for (const checkbox of screen.getAllByLabelText("Select record Ada")) {
      fireEvent.click(checkbox);
      fireEvent.keyDown(checkbox, { key: " " });
    }
    fireEvent.click(screen.getByText("Select record"));
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onOpen).not.toHaveBeenCalled();
    for (const button of screen.getAllByRole("button", { name: "Details" })) {
      fireEvent.keyDown(button, { key: "Enter" });
      fireEvent.click(button);
    }
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

it("highlights selected desktop rows and mobile cards and clears on deselection", () => {
  const props = {
    rows: [row],
    onOpen: vi.fn(),
    review: true,
    onSelectPage: vi.fn(),
    onSelect: vi.fn(),
  };
  const { rerender } = render(<RecordsTable {...props} selected={[row.id]} />);
  for (const container of screen.getAllByLabelText("Open record for Ada")) {
    expect(container.className).toContain("bg-brand/5");
  }
  rerender(<RecordsTable {...props} selected={[]} />);
  for (const container of screen.getAllByLabelText("Open record for Ada")) {
    expect(container.className).not.toContain("bg-brand/5");
  }
});
