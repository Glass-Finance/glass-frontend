import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
vi.mock("../../../../api/files", () => ({ uploadFile: vi.fn(), uploadFiles: vi.fn() }));
vi.mock("../../../../api/recordImports", () => ({
  submitRecordImport: vi.fn(),
  getRecordImports: vi.fn(),
}));
import { uploadFiles } from "../../../../api/files";
import { submitRecordImport, getRecordImports } from "../../../../api/recordImports";
import ImportUploadModal from "../../../../pages/dashboard/records/ImportUploadModal";
const env = (data) => ({ data: { data } });
const files = [
  new File(["one"], "one.csv", { type: "text/csv" }),
  new File(["two"], "two.csv", { type: "text/csv" }),
];
function renderUpload(props = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ImportUploadModal communityId="c" identifier="crew" onClose={() => {}} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function setup() {
  renderUpload();
  fireEvent.change(screen.getByLabelText("Spreadsheets"), { target: { files } });
  fireEvent.click(screen.getByRole("button", { name: "Upload and start imports" }));
}
beforeEach(() => vi.clearAllMocks());
describe("independent file upload jobs", () => {
  it("submits successful files while retaining per-file upload failures", async () => {
    uploadFiles.mockResolvedValue(
      env([
        { id: "f1", success: true },
        { success: false, message: "Unsupported file contents" },
      ]),
    );
    submitRecordImport.mockResolvedValue(env({ id: "j1", status: "QUEUED" }));
    setup();
    await screen.findByText("Unsupported file contents");
    await waitFor(() => expect(submitRecordImport).toHaveBeenCalledTimes(1));
    expect(submitRecordImport).toHaveBeenCalledWith("c", {
      fileId: "f1",
      acknowledgeDuplicate: false,
    });
    expect(screen.getByText("Started")).toBeTruthy();
  });
  it("reconciles a timed-out submission instead of repeating its POST", async () => {
    uploadFiles.mockResolvedValue(
      env([
        { id: "f1", success: true },
        { success: false, message: "Bad file" },
      ]),
    );
    submitRecordImport.mockRejectedValue(new Error("Network error"));
    getRecordImports.mockResolvedValue(env({ content: [{ id: "existing-job" }] }));
    setup();
    await screen.findByRole("button", { name: "Check for an existing import" });
    fireEvent.click(screen.getByRole("button", { name: "Check for an existing import" }));
    await screen.findByText("Existing import found.");
    expect(submitRecordImport).toHaveBeenCalledTimes(1);
  });
  it("only resubmits duplicate files after explicit consent", async () => {
    uploadFiles.mockResolvedValue(
      env([
        { id: "f1", success: true },
        { success: false, message: "Bad file" },
      ]),
    );
    submitRecordImport
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            description: "A committed import uses this source; acknowledgeDuplicate is required",
          },
        },
      })
      .mockResolvedValueOnce(env({ id: "j2" }));
    setup();
    const consent = await screen.findByRole("button", {
      name: /I understand this file was imported before/,
    });
    expect(submitRecordImport).toHaveBeenCalledTimes(1);
    fireEvent.click(consent);
    await waitFor(() => expect(submitRecordImport).toHaveBeenCalledTimes(2));
    expect(submitRecordImport.mock.calls[1][1]).toEqual({
      fileId: "f1",
      acknowledgeDuplicate: true,
    });
  });
});

it("keeps an empty reconciliation uncertain while the original POST might still commit", async () => {
  uploadFiles.mockResolvedValue(
    env([
      { id: "f1", success: true },
      { success: false, message: "Bad file" },
    ]),
  );
  submitRecordImport.mockRejectedValue(new Error("Request timed out"));
  getRecordImports.mockResolvedValue(env({ content: [] }));
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Check for an existing import" }));
  await screen.findByText(/The original request may still be processing/);
  expect(screen.queryByRole("button", { name: "Try submitting this file again" })).toBeNull();
  expect(submitRecordImport).toHaveBeenCalledTimes(1);
});

const transfer = (droppedFiles) => ({ files: droppedFiles, types: ["Files"], dropEffect: "none" });

it("accepts multiple dropped spreadsheets without starting an upload automatically", () => {
  renderUpload();
  const zone = screen.getByRole("group", { name: "Spreadsheet drop zone" });
  fireEvent.dragEnter(zone, { dataTransfer: transfer(files) });
  expect(screen.getByText("Drop your spreadsheets here")).toBeTruthy();
  fireEvent.drop(zone, { dataTransfer: transfer(files) });
  expect(screen.getByText("one.csv")).toBeTruthy();
  expect(screen.getByText("two.csv")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Upload and start imports" }).disabled).toBe(false);
  expect(uploadFiles).not.toHaveBeenCalled();
});

it("keeps the drag highlight while crossing child elements and clears it on leaving", () => {
  renderUpload();
  const zone = screen.getByRole("group", { name: "Spreadsheet drop zone" });
  const choose = screen.getByRole("button", { name: "Choose files" });
  fireEvent.dragEnter(zone, { dataTransfer: transfer(files) });
  fireEvent.dragEnter(choose, { dataTransfer: transfer(files) });
  fireEvent.dragLeave(choose, { dataTransfer: transfer(files) });
  expect(screen.getByText("Drop your spreadsheets here")).toBeTruthy();
  fireEvent.dragLeave(zone, { dataTransfer: transfer(files) });
  expect(screen.queryByText("Drop your spreadsheets here")).toBeNull();
});

it.each([
  ["unsupported.txt", 10],
  ["oversized.xlsx", 25 * 1024 * 1024 + 1],
])("rejects dropped %s using the picker validation", (name, size) => {
  renderUpload();
  const invalid = new File(["invalid"], name);
  Object.defineProperty(invalid, "size", { value: size });
  fireEvent.drop(screen.getByRole("group", { name: "Spreadsheet drop zone" }), {
    dataTransfer: transfer([files[0], invalid]),
  });
  expect(screen.getByRole("alert").textContent).toContain(name);
  expect(screen.getByRole("button", { name: "Upload and start imports" }).disabled).toBe(true);
});

it("prevents browser file navigation outside the drop zone without changing the selection", () => {
  renderUpload();
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer(files) });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.queryByText("one.csv")).toBeNull();
});

it("ignores dropped replacements while an upload is in flight", async () => {
  uploadFiles.mockImplementation(() => new Promise(() => {}));
  renderUpload();
  fireEvent.drop(screen.getByRole("group", { name: "Spreadsheet drop zone" }), {
    dataTransfer: transfer(files),
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload and start imports" }));
  await waitFor(() => expect(uploadFiles).toHaveBeenCalledTimes(1));
  fireEvent.drop(screen.getAllByText("Uploading")[0].parentElement, {
    dataTransfer: transfer([new File(["new"], "replacement.csv")]),
  });
  expect(screen.queryByText("replacement.csv")).toBeNull();
  expect(uploadFiles.mock.calls[0][0].map((file) => file.name)).toEqual(["one.csv", "two.csv"]);
});

it("validates and previews files handed off by the Imports page without uploading", () => {
  renderUpload({ initialFiles: files });
  expect(screen.getByText("one.csv")).toBeTruthy();
  expect(screen.getByText("two.csv")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Upload and start imports" }).disabled).toBe(false);
  expect(uploadFiles).not.toHaveBeenCalled();
});

it("shows validation errors for invalid files handed off by the Imports page", () => {
  renderUpload({ initialFiles: [new File(["bad"], "notes.txt")] });
  expect(screen.getByRole("alert").textContent).toContain("notes.txt");
  expect(screen.getByRole("button", { name: "Upload and start imports" }).disabled).toBe(true);
});
