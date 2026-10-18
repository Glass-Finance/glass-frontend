import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { uploadFiles } from "../../api/files";
import { useFileUploadMultiple } from "../../hooks/useFileUpload";

vi.mock("../../api/files", () => ({ uploadFiles: vi.fn() }));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const csv = (name) => new File(["a,b"], name, { type: "text/csv" });

// ApiResponse<T> serialises as { success, message, data, status }, so axios
// hands the hook response.data as the envelope and the batch sits in .data.
const envelope = (results) => ({
  status: 201,
  data: { success: true, message: "success", data: results, status: "CREATED" },
});

const ok = (name, id) => ({ id, fileName: name, originalFileName: name, success: true });
const rejected = (name, message) => ({
  id: null,
  originalFileName: name,
  success: false,
  message,
});

beforeEach(() => {
  uploadFiles.mockReset();
});

describe("useFileUploadMultiple", () => {
  it("passes the batch and category straight through to the API module", async () => {
    const files = [csv("a.csv"), csv("b.csv")];
    uploadFiles.mockResolvedValue(envelope([ok("a.csv", "1"), ok("b.csv", "2")]));

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });
    await result.current.mutateAsync({ files, fileCategory: "RECORD_IMPORT_SOURCE" });

    expect(uploadFiles).toHaveBeenCalledWith(files, "RECORD_IMPORT_SOURCE");
  });

  it("splits the batch into uploaded and failed by each entry's own success flag", async () => {
    uploadFiles.mockResolvedValue(
      envelope([ok("a.csv", "1"), rejected("b.xlsx", "Unsupported file type"), ok("c.csv", "3")]),
    );

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });
    const { uploaded, failed } = await result.current.mutateAsync({
      files: [csv("a.csv"), csv("b.xlsx"), csv("c.csv")],
      fileCategory: "RECORD_IMPORT_SOURCE",
    });

    expect(uploaded.map((r) => r.id)).toEqual(["1", "3"]);
    expect(failed).toHaveLength(1);
    expect(failed[0].originalFileName).toBe("b.xlsx");
    expect(failed[0].message).toBe("Unsupported file type");
  });

  it("reports a fully rejected batch as failures rather than success", async () => {
    // The backend answers 201 even when every file was rejected, so this is the
    // case a caller that only checked the HTTP status would read as a success.
    uploadFiles.mockResolvedValue(
      envelope([
        rejected("a.exe", "Unsupported file type"),
        rejected("b.exe", "Unsupported file type"),
      ]),
    );

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });
    const { uploaded, failed } = await result.current.mutateAsync({
      files: [csv("a.exe"), csv("b.exe")],
      fileCategory: "RECORD_IMPORT_SOURCE",
    });

    expect(uploaded).toEqual([]);
    expect(failed).toHaveLength(2);
  });

  it("rejects an empty selection without calling the API", async () => {
    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });

    await expect(
      result.current.mutateAsync({ files: [], fileCategory: "RECORD_IMPORT_SOURCE" }),
    ).rejects.toThrow("Select at least one file to upload.");
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it("rejects a missing files argument without calling the API", async () => {
    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });

    await expect(
      result.current.mutateAsync({ fileCategory: "RECORD_IMPORT_SOURCE" }),
    ).rejects.toThrow("Select at least one file to upload.");
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it("rejects — rather than resolving empty — when the request itself fails", async () => {
    // 401/429/offline: nothing was uploaded, so this must stay a rejection and
    // not collapse into an empty `failed` list the caller would report as
    // per-file rejections.
    uploadFiles.mockRejectedValue(new Error("Request failed with status code 401"));

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });

    await expect(
      result.current.mutateAsync({ files: [csv("a.csv")], fileCategory: "RECORD_IMPORT_SOURCE" }),
    ).rejects.toThrow("Request failed with status code 401");
  });

  it("rejects a 201 whose body carries no file list", async () => {
    // A malformed envelope must not resolve as a successful no-op batch, which
    // would tell the user nothing uploaded and nothing was rejected.
    uploadFiles.mockResolvedValue({ status: 201, data: {} });

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });

    await expect(
      result.current.mutateAsync({ files: [csv("a.csv")], fileCategory: "RECORD_IMPORT_SOURCE" }),
    ).rejects.toThrow("Upload response did not contain a file list.");
  });

  it("resolves both lists empty for a genuinely empty batch from the server", async () => {
    uploadFiles.mockResolvedValue(envelope([]));

    const { result } = renderHook(() => useFileUploadMultiple(), { wrapper });
    const { uploaded, failed } = await result.current.mutateAsync({
      files: [csv("a.csv")],
      fileCategory: "RECORD_IMPORT_SOURCE",
    });

    expect(uploaded).toEqual([]);
    expect(failed).toEqual([]);
  });
});
