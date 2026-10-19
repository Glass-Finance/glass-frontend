import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
vi.mock("../../../../hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("../../../../hooks/useRecordBookAccess", () => ({
  useRecordBookAccess: () => ({ id: "c", identifier: "my community", import: true }),
}));
vi.mock("../../../../hooks/useRecordImports", () => ({
  useRecordImports: () => ({
    data: { content: [{ id: "j1", fileFormat: "CSV", status: "READY_FOR_REVIEW" }], totalPages: 1 },
  }),
}));
vi.mock("../../../../pages/dashboard/records/AiUsageNotice", () => ({ default: () => null }));
vi.mock("../../../../pages/dashboard/records/ImportUploadModal", () => ({
  default: ({ initialFiles = [], onClose }) => (
    <div role="dialog" aria-label="Import spreadsheets">
      <p>{initialFiles.map((file) => file.name).join(", ")}</p>
      <button onClick={onClose}>Close upload</button>
    </div>
  ),
}));
import RecordImports from "../../../../pages/dashboard/RecordImports";
function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}
it("makes the entire import entry a link to its review with community context", () => {
  render(
    <MemoryRouter initialEntries={["/imports"]}>
      <Routes>
        <Route path="/imports" element={<RecordImports />} />
        <Route path="/dashboard/records/imports/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  const title = screen.getByRole("heading", { name: /CSV import/ });
  const entry = title.closest("a");
  expect(entry).not.toBeNull();
  expect(entry.contains(screen.getByText("Review records"))).toBe(true);
  fireEvent.click(title);
  expect(screen.getByText("/dashboard/records/imports/j1?community=my%20community")).toBeTruthy();
});

it("opens upload with the files dropped onto the Imports page and clears them on close", () => {
  render(
    <MemoryRouter>
      <RecordImports />
    </MemoryRouter>,
  );
  const zone = screen.getByRole("group", { name: "Imports page drop zone" });
  const files = [new File(["one"], "one.csv"), new File(["two"], "two.xlsx")];
  fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } });
  expect(screen.getByText("Drop spreadsheets to import")).toBeTruthy();
  fireEvent.drop(zone, { dataTransfer: { types: ["Files"], files } });
  expect(screen.queryByText("Drop spreadsheets to import")).toBeNull();
  expect(screen.getByRole("dialog").textContent).toContain("one.csv, two.xlsx");
  // A page-level drop must not replace an upload already being reviewed.
  fireEvent.drop(zone, {
    dataTransfer: { types: ["Files"], files: [new File(["new"], "replacement.csv")] },
  });
  expect(screen.getByRole("dialog").textContent).not.toContain("replacement.csv");
  fireEvent.click(screen.getByRole("button", { name: "Close upload" }));
  fireEvent.click(screen.getByRole("button", { name: "Import spreadsheet" }));
  expect(screen.getByRole("dialog").textContent).not.toContain("one.csv");
});

it("ignores non-file drags on the Imports page", () => {
  render(
    <MemoryRouter>
      <RecordImports />
    </MemoryRouter>,
  );
  const zone = screen.getByRole("group", { name: "Imports page drop zone" });
  fireEvent.dragEnter(zone, { dataTransfer: { types: ["text/plain"] } });
  fireEvent.drop(zone, { dataTransfer: { types: ["text/plain"], files: [] } });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Drop spreadsheets to import")).toBeNull();
});

it("detects file drags across the screen and removes the target when the drag leaves", () => {
  render(
    <MemoryRouter>
      <RecordImports />
    </MemoryRouter>,
  );
  const files = [new File(["one"], "one.csv")];
  fireEvent.dragEnter(document.body, { dataTransfer: { types: ["Files"] } });
  expect(screen.getByRole("group", { name: "Spreadsheet page drop target" })).toBeTruthy();
  fireEvent.dragLeave(document.body, { dataTransfer: { types: ["Files"] } });
  expect(screen.queryByRole("group", { name: "Spreadsheet page drop target" })).toBeNull();
  fireEvent.dragEnter(document.body, { dataTransfer: { types: ["Files"] } });
  fireEvent.drop(document.body, { dataTransfer: { types: ["Files"], files } });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.dragEnter(document.body, { dataTransfer: { types: ["Files"] } });
  fireEvent.drop(screen.getByRole("group", { name: "Spreadsheet page drop target" }), {
    dataTransfer: { types: ["Files"], files },
  });
  expect(screen.queryByRole("group", { name: "Spreadsheet page drop target" })).toBeNull();
  expect(screen.getByRole("dialog").textContent).toContain("one.csv");
});
