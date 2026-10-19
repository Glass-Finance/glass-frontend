// Client-side rules for a record-book import source file.
//
// Transcribed from FileCategory.RECORD_IMPORT_SOURCE in glass-backend
// (getAllowedExtensions / getAllowedMimeTypes / getMaxFileSize). The backend
// enforces all three regardless — this exists so the user is told before the
// upload rather than after, and so a doomed request doesn't spend a rate-limit
// token (the file endpoints sit behind RATE_LIMIT_FILE).
//
// It is NOT a security control and must not be treated as one: the backend
// re-checks extension, MIME AND content signature on the actual bytes.

export const IMPORT_ACCEPT = ".csv,.tsv,.xlsx,.xls";

// 25 MiB, from FileCategory.getMaxFileSize() for RECORD_IMPORT_SOURCE.
export const IMPORT_MAX_BYTES = 25 * 1024 * 1024;

export const IMPORT_EXTENSIONS = ["csv", "tsv", "xlsx", "xls"];

export function fileExtension(name = "") {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function validateImportFile(file) {
  if (!file) return "No file selected.";
  const ext = fileExtension(file.name);
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    return `${file.name}: ${ext ? `".${ext}"` : "that file type"} isn't supported. Use CSV, TSV, XLSX or XLS.`;
  }
  if (file.size > IMPORT_MAX_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return `${file.name} is ${mb} MB — the limit is 25 MB.`;
  }
  return "";
}

// Returns one message describing everything wrong with the selection, or null
// when the whole batch is uploadable. Pre-flighting the batch rather than
// failing per-file keeps one bad filename from silently disappearing into a
// per-entry failure message the user may not read.
export function validateImportFiles(files) {
  const errors = (files ?? []).map(validateImportFile).filter(Boolean);
  return errors.length ? errors.join(" ") : null;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
