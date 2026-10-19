import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "../../../../../api/recordImports";
import { uploadFiles } from "../../../../../api/files";
import ImportWizard from "../../../../../pages/dashboard/records/imports/ImportWizard";

// The two rules the wizard can silently break:
//
//  1. ONE FILE IS ONE JOB. There is no combined multi-file import request, so
//     picking three spreadsheets must produce three jobs. Batching them into
//     one submit would either lose two uploads or 422.
//  2. COMMIT IS NOT DONE WHEN IT RESPONDS. A 202 means the commit was queued.
//     Treating a resolve as "committed" shows a success for records that were
//     never written.

vi.mock("../../../../../api/recordImports", () => ({
  getImportJobs: vi.fn(),
  getImportJob: vi.fn(),
  createImportJob: vi.fn(),
  commitImportJob: vi.fn(),
  discardImportJob: vi.fn(),
  retryImportJob: vi.fn(),
  getImportJobRows: vi.fn(),
  updateImportJobRow: vi.fn(),
  bulkUpdateImportJobRows: vi.fn(),
  createImportJobRow: vi.fn(),
  deleteImportJobRow: vi.fn(),
}));

vi.mock("../../../../../api/files", () => ({ uploadFiles: vi.fn() }));
vi.mock("../../../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: () => "glass-crew",
}));
vi.mock("../../../../../hooks/usePageTitle", () => ({ usePageTitle: () => {} }));

function wrapper({ children }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const envelope = (data) => ({ data: { success: true, data } });

const job = (over = {}) => ({
  id: "job-1",
  fileName: "book.xlsx",
  status: "QUEUED",
  reviewTotals: {},
  createdAt: "2026-09-15T10:00:00Z",
  retryable: false,
  ...over,
});

const sheet = (name, size = 2048) =>
  new File([new Uint8Array(size)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  for (const m of Object.keys(api)) api[m].mockReset?.();
  uploadFiles.mockReset();
  api.getImportJobs.mockResolvedValue(envelope({ content: [], totalElements: 0, totalPages: 1 }));
  api.getImportJob.mockResolvedValue(envelope(job()));
  // The AXIOS response, not the hook's output: useFileUploadMultiple calls the
  // API function and splits `res.data.data` itself, so handing it
  // `{uploaded, failed}` makes it throw "did not contain a file list" and no
  // job is ever created.
  uploadFiles.mockResolvedValue({
    data: { success: true, data: [{ id: "file-1", success: true }] },
  });
  api.createImportJob.mockResolvedValue(envelope(job()));
});

async function pickAndSubmit(user, names) {
  const input = screen.getByLabelText("Choose spreadsheet files");
  await user.upload(
    input,
    names.map((n) => sheet(n)),
  );
  await user.click(await screen.findByRole("button", { name: /^start \d+ imports?$/i }));
}

describe("ImportWizard — one file, one job", () => {
  it("submits a separate job for each picked file", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await pickAndSubmit(user, ["a.xlsx", "b.xlsx", "c.xlsx"]);

    await waitFor(() => expect(api.createImportJob).toHaveBeenCalledTimes(3));
    // Three separate uploads too — the endpoint has no multi-file variant.
    expect(uploadFiles).toHaveBeenCalledTimes(3);
    const categories = uploadFiles.mock.calls.map((c) => c[1]);
    expect(categories).toEqual([
      "RECORD_IMPORT_SOURCE",
      "RECORD_IMPORT_SOURCE",
      "RECORD_IMPORT_SOURCE",
    ]);
  });

  it("uses singular wording for a single file", async () => {
    const user = userEvent.setup();
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await user.upload(screen.getByLabelText("Choose spreadsheet files"), [sheet("only.xlsx")]);
    expect(await screen.findByRole("button", { name: /start 1 import$/i })).toBeTruthy();
  });

  it("surfaces a per-file upload rejection instead of starting that job", async () => {
    // The endpoint answers 201 even when a single file is rejected, so a naive
    // caller would create a job pointing at a file that was never stored.
    uploadFiles.mockResolvedValue({
      data: {
        success: true,
        data: [{ originalFileName: "bad.xlsx", success: false, message: "Unsupported file type" }],
      },
    });
    const user = userEvent.setup();
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await pickAndSubmit(user, ["bad.xlsx"]);

    expect(await screen.findByText(/unsupported file type/i)).toBeTruthy();
    expect(api.createImportJob).not.toHaveBeenCalled();
  });
});

describe("ImportWizard — picking", () => {
  // user-event's upload() silently drops files that don't match the input's
  // `accept` attribute, which would make these checks unreachable here even
  // though they are reachable in a real browser (the OS picker lets a user
  // choose "All Files", and a renamed .csv is still a PDF). fireEvent.change
  // sets the FileList directly and exercises the guard the way a real
  // mis-selection would.
  async function pickDirectly(files) {
    const input = screen.getByLabelText("Choose spreadsheet files");
    fireEvent.change(input, { target: { files } });
    return input;
  }

  it("refuses an unsupported extension before any upload is attempted", async () => {
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await pickDirectly([new File(["x"], "notes.pdf", { type: "application/pdf" })]);

    expect(await screen.findByText(/isn't supported/i)).toBeTruthy();
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it("refuses a file over the 25 MB ceiling before uploading", async () => {
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await pickDirectly([new File([new Uint8Array(26 * 1024 * 1024)], "huge.xlsx")]);

    // "25 MB" also appears in the page description, so match the whole message.
    expect(await screen.findByText(/is \d+ MB — the limit is 25 MB\./)).toBeTruthy();
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it("reports every bad file in the batch, not just the first", async () => {
    render(<ImportWizard />, { wrapper });
    await screen.findByText(/no imports yet/i);

    await pickDirectly([
      new File(["x"], "one.pdf", { type: "application/pdf" }),
      new File(["x"], "two.txt", { type: "text/plain" }),
    ]);

    expect(await screen.findByText(/one\.pdf/)).toBeTruthy();
    expect(screen.getByText(/two\.txt/)).toBeTruthy();
  });
});

describe("ImportWizard — commit", () => {
  async function openReviewableJob(user) {
    api.getImportJobs.mockResolvedValue(
      envelope({
        content: [job({ status: "READY_FOR_REVIEW", reviewTotals: { VALID: 12, INVALID: 2 } })],
        totalElements: 1,
        totalPages: 1,
      }),
    );
    api.getImportJob.mockResolvedValue(
      envelope(job({ status: "READY_FOR_REVIEW", reviewTotals: { VALID: 12, INVALID: 2 } })),
    );
    api.getImportJobRows.mockResolvedValue(
      envelope({ content: [], totalElements: 0, totalPages: 1 }),
    );
    render(<ImportWizard />, { wrapper });
    await screen.findByRole("button", { name: /review rows/i });
    await user.click(screen.getByRole("button", { name: /review rows/i }));
    await screen.findByRole("button", { name: /commit 12 rows/i });
  }

  it("offers Commit only at READY_FOR_REVIEW", async () => {
    const user = userEvent.setup();
    await openReviewableJob(user);
    expect(screen.getByRole("button", { name: /commit 12 rows/i })).toBeTruthy();
  });

  it("sends commit with no body and does not report it as done", async () => {
    const user = userEvent.setup();
    await openReviewableJob(user);
    let detailStatus = "READY_FOR_REVIEW";

    // Flip the detail query's status as the commit resolves, so the invalidation
    // in useCommitImportJob's onSuccess drives a refetch that lands on
    // COMMIT_QUEUED. A 202 must never render the job as COMMITTED.
    api.commitImportJob.mockImplementation(async () => {
      detailStatus = "COMMIT_QUEUED";
      return envelope(job({ status: "COMMIT_QUEUED" }));
    });
    api.getImportJob.mockImplementation(() =>
      Promise.resolve(envelope(job({ status: detailStatus }))),
    );

    await user.click(screen.getByRole("button", { name: /commit 12 rows/i }));

    await waitFor(() => expect(api.commitImportJob).toHaveBeenCalledWith("glass-crew", "job-1"));
    // No body — the backend rejects one on this endpoint.
    expect(api.commitImportJob.mock.calls[0]).toHaveLength(2);

    // And the screen says "Committing", never "Committed".
    await waitFor(() => expect(screen.getByText(/^committing$/i)).toBeTruthy());
    expect(screen.queryByText(/^committed$/i)).toBeNull();
  });

  it("does not offer Commit while the job is still processing", async () => {
    const user = userEvent.setup();
    api.getImportJobs.mockResolvedValue(
      envelope({ content: [job({ status: "APPLYING_MAPPING" })], totalElements: 1, totalPages: 1 }),
    );
    api.getImportJob.mockResolvedValue(envelope(job({ status: "APPLYING_MAPPING" })));
    api.getImportJobRows.mockResolvedValue(
      envelope({ content: [], totalElements: 0, totalPages: 1 }),
    );
    render(<ImportWizard />, { wrapper });
    await screen.findByRole("button", { name: /^open$/i });
    await user.click(screen.getByRole("button", { name: /^open$/i }));

    await waitFor(() => expect(screen.getByText(/processing your file/i)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /commit/i })).toBeNull();
  });

  it("explains a commit that came back blocked, rather than calling it a failure", async () => {
    // IMPORT_COMMIT_BLOCKED reopens READY_FOR_REVIEW. The user's next move is to
    // fix rows and commit again — it is not a dead end, so it must not read as
    // "Failed".
    const user = userEvent.setup();
    api.getImportJobs.mockResolvedValue(
      envelope({
        content: [
          job({
            status: "READY_FOR_REVIEW",
            failureCode: "IMPORT_COMMIT_BLOCKED",
            failureMessage: "2 rows still have blocking issues",
          }),
        ],
        totalElements: 1,
        totalPages: 1,
      }),
    );
    api.getImportJob.mockResolvedValue(
      envelope(
        job({
          status: "READY_FOR_REVIEW",
          failureCode: "IMPORT_COMMIT_BLOCKED",
          failureMessage: "2 rows still have blocking issues",
        }),
      ),
    );
    api.getImportJobRows.mockResolvedValue(
      envelope({ content: [], totalElements: 0, totalPages: 1 }),
    );
    render(<ImportWizard />, { wrapper });
    await screen.findByRole("button", { name: /review rows/i });
    await user.click(screen.getByRole("button", { name: /review rows/i }));

    const code = await screen.findByText(/IMPORT_COMMIT_BLOCKED/);
    expect(code).toBeTruthy();
    expect(screen.getByText(/commit again/i)).toBeTruthy();
    // And Commit must still be reachable — that is the whole point.
    expect(screen.getByRole("button", { name: /commit/i })).toBeTruthy();
  });
});
