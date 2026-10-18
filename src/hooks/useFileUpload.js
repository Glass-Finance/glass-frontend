import { useMutation } from "@tanstack/react-query";
import { uploadFile, uploadFiles } from "../api/files";

// Returns the uploaded file's { id, url } on success.
export function useFileUpload() {
  return useMutation({
    mutationFn: ({ file, fileCategory }) => uploadFile(file, fileCategory),
    // callers catch errors themselves and show inline text — suppress the
    // global mutationCache toast to avoid showing two errors at once.
    meta: { silentError: true },
  });
}

// Resolves with { uploaded, failed } — the batch split by outcome.
//
// The backend answers 201 whatever the individual outcomes are: it uploads
// each file in turn and reports a per-file result (success + message) in the
// body instead of rejecting the request. Handing that raw list to callers
// would make a batch where every single file failed look like a success, so
// the split happens here, once. The distinction the two failure modes need:
//
//   reject          → the request itself failed (auth, rate limit, offline).
//                     Nothing was uploaded.
//   failed.length>0 → the request succeeded; those files alone were rejected
//                     (wrong extension or MIME type, over the per-category
//                     size cap, storage error). The rest are in `uploaded`
//                     and should be kept, not retried wholesale.
//
// Each entry carries its own `success` flag, distinct from the envelope's
// `success` flag (ApiResponse.success is always true here) — filter on the
// entries, not on res.data.success.
//
// Deliberately does not preserve the original batch order across the two
// arrays. Entries keep `originalFileName`, and no consumer has needed index
// alignment yet; add it when one does rather than shipping it speculatively.
export function useFileUploadMultiple() {
  return useMutation({
    mutationFn: async ({ files, fileCategory }) => {
      // The backend rejects an empty batch with InvalidFileException, but only
      // after the request reaches it and burns a rate-limit token. An empty
      // selection is a no-op, not a server error to report.
      if (!Array.isArray(files) || files.length === 0) {
        throw new Error("Select at least one file to upload.");
      }
      const res = await uploadFiles(files, fileCategory);
      const results = res.data?.data;
      // The backend appends exactly one entry per submitted file and rejects an
      // empty batch outright, so a missing or non-array payload here is a broken
      // contract, not a zero-file result. Resolve as empty and the caller would
      // report a silent no-op; reject and it says something went wrong.
      if (!Array.isArray(results)) {
        throw new Error("Upload response did not contain a file list.");
      }
      return {
        uploaded: results.filter((result) => result?.success),
        failed: results.filter((result) => !result?.success),
      };
    },
    // same reasoning as useFileUpload — callers surface partial-failure text
    // from `failed` themselves.
    meta: { silentError: true },
  });
}
