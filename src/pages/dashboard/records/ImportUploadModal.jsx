import { Upload, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { useFileDrop } from "../../../hooks/useFileDrop";
import { validateRecordImportFiles } from "../../../utils/recordImportFiles";
import { useImportUpload } from "../../../hooks/useRecordImports";
import { errorDescription } from "../../../utils/recordBook";
import { ErrorNotice } from "./RecordBookUI";

export default function ImportUploadModal({ communityId, identifier, onClose, initialFiles = [] }) {
  const navigate = useNavigate();
  const { upload, submit, reconcile } = useImportUpload(communityId);
  const [files, setFiles] = useState(() =>
    validateRecordImportFiles(initialFiles) ? [] : initialFiles,
  );
  const [items, setItems] = useState([]);
  const [error, setError] = useState(() => validateRecordImportFiles(initialFiles));
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const inputRef = useRef(null);
  const { dragging, dropHandlers, resetDrag } = useFileDrop(chooseFiles, busy || items.length > 0);
  function chooseFiles(chosen) {
    if (locked.current || busy || items.length || !chosen.length) return;
    const validation = validateRecordImportFiles(chosen);
    setError(validation);
    setFiles(validation ? [] : chosen);
  }
  const destination = (jobId) =>
    `/dashboard/records/imports${jobId ? `/${jobId}` : ""}?community=${encodeURIComponent(identifier)}`;
  const update = (index, patch) =>
    setItems((old) => old.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  async function submitOne(item, index, acknowledgeDuplicate = false) {
    update(index, { state: "Submitting", message: "" });
    try {
      const job = await submit.mutateAsync({ fileId: item.fileId, acknowledgeDuplicate });
      update(index, { state: "Started", jobId: job.id });
      return job;
    } catch (err) {
      const duplicate =
        err?.response?.status === 409 &&
        /acknowledgeDuplicate/.test(
          String(err.response.data?.description ?? err.response.data?.message ?? ""),
        );
      const uncertain = !err?.response || err.response.status >= 500;
      update(index, {
        state: duplicate ? "Duplicate file" : uncertain ? "Check history" : "Not submitted",
        message: errorDescription(err),
      });
      return null;
    }
  }
  async function start() {
    if (locked.current || !files.length || items.length) return;
    locked.current = true;
    resetDrag();
    setBusy(true);
    setError("");
    setItems(files.map((file) => ({ name: file.name, state: "Uploading" })));
    try {
      const results = await upload.mutateAsync(files);
      const uploaded = files.map((file, index) => {
        const result = results?.[index];
        return {
          name: file.name,
          fileId: result?.id,
          state: result?.success && result.id ? "Uploaded" : "Upload failed",
          message: result?.success
            ? ""
            : result?.message || "Upload failed. Choose this file again to retry.",
        };
      });
      setItems(uploaded);
      let onlyJob = null;
      let started = 0;
      for (let i = 0; i < uploaded.length; i++)
        if (uploaded[i].state === "Uploaded") {
          onlyJob = await submitOne(uploaded[i], i);
          if (onlyJob) started++;
        }
      if (files.length === 1 && onlyJob) {
        onClose();
        navigate(destination(onlyJob.id));
      } else if (started === files.length && files.length > 1) {
        onClose();
        navigate(destination());
      }
    } catch (err) {
      setError(errorDescription(err));
      setItems([]);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function recover(item, index, duplicate = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      if (item.state === "Check history") {
        const page = await reconcile.mutateAsync(item.fileId);
        if (page.content?.length) {
          update(index, {
            state: "Started",
            jobId: page.content[0].id,
            message: "Existing import found.",
          });
          return;
        }
        update(index, {
          state: "Check history",
          message:
            "The original request may still be processing. No matching job is visible yet. Check again later; do not upload or submit this file again while its outcome is unknown.",
        });
        return;
      }
      await submitOne(item, index, duplicate);
    } catch (err) {
      update(index, { message: errorDescription(err) });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const allStarted = items.length > 0 && items.every((item) => item.state === "Started");
  return (
    <ModalShell
      title="Import spreadsheets"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="flex flex-wrap gap-3 justify-end">
          <Button
            variant="outline-neutral"
            size="sm-tight"
            fullWidth={false}
            disabled={busy}
            onClick={onClose}
          >
            Close
          </Button>
          {!items.length ? (
            <Button
              size="sm-tight"
              fullWidth={false}
              disabled={!files.length}
              loading={busy}
              onClick={start}
            >
              Upload and start imports
            </Button>
          ) : (
            <Button
              size="sm-tight"
              fullWidth={false}
              disabled={busy}
              onClick={() => {
                onClose();
                navigate(destination());
              }}
            >
              {allStarted ? "View imports" : "View import history"}
            </Button>
          )}
        </div>
      }
    >
      <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
        <p className="text-sm text-ink-muted">
          Each spreadsheet creates a separate import. Review the records before saving them.
        </p>
        <ErrorNotice message={error} />
        {!items.length && (
          <div className="space-y-3">
            <div
              role="group"
              aria-label="Spreadsheet drop zone"
              {...dropHandlers}
              className={`rounded-g-2 border border-dashed bg-white px-4 py-6 text-center transition-colors ${dragging ? "border-brand" : "border-surface-container-border"}`}
            >
              <Upload aria-hidden="true" size={24} className="mx-auto text-brand mb-3" />
              <p className="text-sm font-medium" role="status">
                {dragging ? "Drop your spreadsheets here" : "Drag and drop spreadsheets here"}
              </p>
              <p className="text-xs text-ink-ghost mt-1 mb-4">
                CSV, TSV, XLSX, or XLS · Up to 25 MiB each
              </p>
              <Button
                size="sm-tight"
                fullWidth={false}
                variant={files.length ? "outline-neutral" : "primary"}
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                Choose files
              </Button>
              {files.length > 0 && (
                <p className="text-xs text-ink-muted mt-3">
                  New selections replace the files below.
                </p>
              )}
              <input
                ref={inputRef}
                aria-label="Spreadsheets"
                type="file"
                multiple
                accept=".csv,.tsv,.xlsx,.xls"
                disabled={busy}
                className="sr-only"
                onChange={(event) => {
                  chooseFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <p className="text-xs text-ink-muted" role="status">
                {files.length} {files.length === 1 ? "spreadsheet" : "spreadsheets"} selected.
                Upload when you're ready.
              </p>
            )}
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-g-1 border border-surface-container-border px-3 py-2"
              >
                <FileSpreadsheet size={16} className="shrink-0 text-ink-ghost" />
                <p className="text-xs min-w-0 flex-1 truncate">{file.name}</p>
                <span className="text-xs text-ink-ghost">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        )}
        {items.map((item, index) => (
          <div key={index} className="rounded-g-1 border border-black/10 p-3 space-y-2">
            <p className="text-sm font-medium break-words">{item.name}</p>
            <p role="status" className="text-sm text-ink-muted">
              {item.state}
            </p>
            {item.message && <p className="text-sm text-ink-muted break-words">{item.message}</p>}
            {item.state === "Duplicate file" && (
              <Button
                size="sm-tight"
                variant="outline"
                fullWidth={false}
                disabled={busy}
                onClick={() => recover(item, index, true)}
              >
                I understand this file was imported before. Import again
              </Button>
            )}
            {["Not submitted", "Check history"].includes(item.state) && (
              <Button
                size="sm-tight"
                variant="outline-neutral"
                fullWidth={false}
                disabled={busy}
                onClick={() => recover(item, index)}
              >
                {item.state === "Check history"
                  ? "Check for an existing import"
                  : "Try submitting this file again"}
              </Button>
            )}
            {item.state === "Upload failed" && (
              <p className="text-sm text-ink-muted">
                Close this dialog, then select this file again. Other jobs are preserved.
              </p>
            )}
            {item.jobId && (
              <Button
                size="sm-tight"
                variant="outline"
                fullWidth={false}
                disabled={busy}
                onClick={() => {
                  onClose();
                  navigate(destination(item.jobId));
                }}
              >
                Open import
              </Button>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
