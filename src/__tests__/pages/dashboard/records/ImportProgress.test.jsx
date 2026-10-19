import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ImportProgress from "../../../../pages/dashboard/records/ImportProgress";
const entry = (sequence, status, message) => ({
  sequence,
  status,
  message,
  occurredAt: "2026-10-18T12:00:00Z",
});
it("expands the current activity with descriptive text as new events arrive", () => {
  const first = entry(1, "READING_FILE", "Reading the spreadsheet's worksheets.");
  const { rerender } = render(
    <ImportProgress job={{ status: "READING_FILE", timeline: [first] }} />,
  );
  expect(screen.getByText(first.message).closest("details").open).toBe(true);
  const next = entry(2, "INFERRING_MAPPING", "Matching date and amount columns.");
  rerender(
    <ImportProgress
      job={{
        status: next.status,
        timeline: [next, first],
        sourceRowsScanned: 120,
        generatedRows: 40,
      }}
    />,
  );
  expect(screen.getByText(next.message).closest("details").open).toBe(true);
  const previous = screen.getByText(first.message).closest("details");
  expect(previous.open).toBe(false);
  fireEvent.click(previous.querySelector("summary"));
  expect(previous.open).toBe(true);
  expect(screen.getByText("120")).toBeTruthy();
  expect(screen.getByText("40")).toBeTruthy();
});
it("keeps repeated retry stages in sequence and distinguishes failure", () => {
  const { container } = render(
    <ImportProgress
      job={{
        status: "FAILED",
        timeline: [
          entry(3, "READING_FILE", "Second attempt"),
          entry(1, "READING_FILE", "First attempt"),
          entry(4, "FAILED", "File cannot be read"),
        ],
      }}
    />,
  );
  const steps = container.querySelectorAll("li");
  expect(steps[0].textContent).toContain("First attempt");
  expect(steps[1].textContent).toContain("Second attempt");
  expect(steps[2].textContent).toContain("Failed");
  expect(screen.queryByText("Updating automatically")).toBeNull();
});
