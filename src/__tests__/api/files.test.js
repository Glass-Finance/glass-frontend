import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../../api/client";
import { uploadFile, uploadFiles } from "../../api/files";

// Path kept literal (not built in a helper) so `npm run audit:endpoints`
// can regex it out and prove the route exists on the deployed API — same
// reasoning as api/invites.js.
vi.mock("../../api/client", () => ({
  default: { post: vi.fn() },
}));

const multipartConfig = { headers: { "Content-Type": "multipart/form-data" } };

// FormData is iterable in jsdom; collecting the entries is what lets a test
// assert on part names and values without depending on internal slots.
function entriesOf(fd) {
  return [...fd.entries()];
}

describe("uploadFile", () => {
  beforeEach(() => {
    client.post.mockReset();
  });

  it("POSTs to the single-file route", () => {
    const file = new File(["x"], "logo.png", { type: "image/png" });
    uploadFile(file, "COMMUNITY_LOGO");
    expect(client.post).toHaveBeenCalledWith("/file/upload", expect.any(FormData), multipartConfig);
  });

  it("sends the file under the singular part name the backend binds", () => {
    const file = new File(["x"], "logo.png", { type: "image/png" });
    uploadFile(file, "COMMUNITY_LOGO");
    const entries = entriesOf(client.post.mock.calls[0][1]);
    expect(entries).toContainEqual(["file", file]);
    expect(entries).toContainEqual(["fileCategory", "COMMUNITY_LOGO"]);
  });
});

describe("uploadFiles", () => {
  beforeEach(() => {
    client.post.mockReset();
  });

  it("POSTs to the multiple-file route", () => {
    uploadFiles([new File(["x"], "a.csv", { type: "text/csv" })], "RECORD_IMPORT_SOURCE");
    expect(client.post).toHaveBeenCalledWith(
      "/file/upload/multiple",
      expect.any(FormData),
      multipartConfig,
    );
  });

  it("sends every file under the same plural part name the backend binds", () => {
    const a = new File(["x"], "a.csv", { type: "text/csv" });
    const b = new File(["y"], "b.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    uploadFiles([a, b], "RECORD_IMPORT_SOURCE");

    const entries = entriesOf(client.post.mock.calls[0][1]);
    // The backend binds List<MultipartFile> to a part literally named "files" —
    // appending them as "file" would upload nothing and answer 201 with a
    // single failure entry, so the repetition is the assertion.
    const fileParts = entries.filter(([name]) => name === "files");
    expect(fileParts.map(([, value]) => value)).toEqual([a, b]);
    expect(entries).toContainEqual(["fileCategory", "RECORD_IMPORT_SOURCE"]);
  });

  it("appends one part per file rather than a single array-valued part", () => {
    const files = [
      new File(["x"], "a.csv", { type: "text/csv" }),
      new File(["y"], "b.csv", { type: "text/csv" }),
      new File(["z"], "c.csv", { type: "text/csv" }),
    ];
    uploadFiles(files, "RECORD_IMPORT_SOURCE");
    const entries = entriesOf(client.post.mock.calls[0][1]);
    expect(entries.filter(([name]) => name === "files")).toHaveLength(3);
    expect(entries.some(([, value]) => Array.isArray(value))).toBe(false);
  });
});
