import { describe, it, expect } from "vitest";
import {
  validateImportFile,
  validateImportFiles,
  fileExtension,
  formatBytes,
  IMPORT_MAX_BYTES,
  IMPORT_EXTENSIONS,
} from "../../../../../pages/dashboard/records/imports/fileRules";

// These rules mirror FileCategory.RECORD_IMPORT_SOURCE in glass-backend
// (allowed extensions / max size). They are a UX pre-flight, NOT a security
// control — the backend re-checks extension, MIME and content signature on the
// real bytes. Their job is to say "unsupported" before the upload rather than
// after, and to not spend a rate-limit token on a request that cannot succeed.

const file = (name, size = 1024) => ({ name, size });

describe("fileExtension", () => {
  it("lowercases, so FILE.CSV is accepted", () => {
    expect(fileExtension("BOOKS.CSV")).toBe("csv");
  });

  it("takes the LAST dot, so archive.tar.gz is gz", () => {
    expect(fileExtension("data.tar.gz")).toBe("gz");
  });

  it("returns empty for a name with no extension", () => {
    expect(fileExtension("README")).toBe("");
  });
});

describe("validateImportFile", () => {
  it("accepts every extension the backend allows", () => {
    for (const ext of IMPORT_EXTENSIONS) {
      expect(validateImportFile(file(`book.${ext}`))).toBe("");
    }
  });

  it("rejects an unsupported extension and names the allowed set", () => {
    const message = validateImportFile(file("notes.pdf"));
    expect(message).toContain("notes.pdf");
    expect(message).toContain("CSV, TSV, XLSX or XLS");
  });

  it("rejects a file with no extension at all", () => {
    expect(validateImportFile(file("spreadsheet"))).toMatch(/isn't supported/);
  });

  it("allows a file exactly at the 25 MB ceiling", () => {
    // Off-by-one here rejects legitimate files; one byte over must not pass.
    expect(validateImportFile(file("big.csv", IMPORT_MAX_BYTES))).toBe("");
  });

  it("rejects one byte over the ceiling and says how big it is", () => {
    const message = validateImportFile(file("big.csv", IMPORT_MAX_BYTES + 1));
    expect(message).toContain("25 MB");
  });
});

describe("validateImportFiles", () => {
  it("passes a clean batch", () => {
    expect(validateImportFiles([file("a.csv"), file("b.xlsx")])).toBeNull();
  });

  it("reports every problem in the batch, not just the first", () => {
    // Failing one file silently would drop it into a per-entry failure message
    // the user may never read, so the whole batch is pre-flighted up front.
    const message = validateImportFiles([file("a.csv"), file("b.pdf"), file("c.txt")]);
    expect(message).toContain("b.pdf");
    expect(message).toContain("c.txt");
    expect(message).not.toContain("a.csv");
  });

  it("treats an empty selection as a no-op, not an error", () => {
    // Cancelling the file picker yields []. That must not raise "no files
    // selected" — the Start button only renders when files.length > 0, and
    // useFileUploadMultiple raises its own error for an empty batch. Flagging
    // it here would greet a user who cancelled a dialog with a validation
    // complaint.
    expect(validateImportFiles([])).toBeNull();
  });

  it("does not throw on a missing selection", () => {
    expect(() => validateImportFiles(undefined)).not.toThrow();
  });
});

describe("formatBytes", () => {
  it("scales to a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25.0 MB");
  });

  it("does not print NaN for a missing size", () => {
    expect(formatBytes(undefined)).toBe("—");
  });
});
