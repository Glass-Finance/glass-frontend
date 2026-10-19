import { useMutation } from "@tanstack/react-query";
import { uploadFile } from "../api/files";

// Returns the uploaded file's { id, url } on success.
export function useFileUpload() {
  return useMutation({
    mutationFn: ({ file, fileCategory }) => uploadFile(file, fileCategory),
    // callers catch errors themselves and show inline text — suppress the
    // global mutationCache toast to avoid showing two errors at once.
    meta: { silentError: true },
  });
}
