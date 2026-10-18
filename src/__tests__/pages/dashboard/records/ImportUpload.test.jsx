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
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ImportUploadModal communityId="c" identifier="crew" onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
