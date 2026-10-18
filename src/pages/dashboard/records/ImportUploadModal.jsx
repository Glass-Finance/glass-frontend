import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { useImportUpload } from "../../../hooks/useRecordImports";
import { errorDescription } from "../../../utils/recordBook";
import { ErrorNotice } from "./RecordBookUI";

export default function ImportUploadModal({ communityId, identifier, onClose }) {
  const navigate = useNavigate();
  const { upload, submit, reconcile } = useImportUpload(communityId);
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
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
          state: "Not submitted",
          message: "No matching job was found. You can explicitly try submission again.",
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
            size="md"
            fullWidth={false}
            disabled={busy}
            onClick={onClose}
          >
            Close
          </Button>
          {!items.length ? (
            <Button
              size="md"
              fullWidth={false}
              disabled={!files.length}
              loading={busy}
              onClick={start}
            >
              Upload and start imports
            </Button>
          ) : (
            <Button
              size="md"
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
          Choose CSV, TSV, XLSX, or XLS files, up to 25 MiB each. Each file becomes its own import,
          with records reviewed before saving. ZIP archives are not supported.
        </p>
        <ErrorNotice message={error} />
        {!items.length && (
          <label className="flex flex-col gap-3 text-sm">
            Spreadsheets
            <input
              type="file"
              multiple
              accept=".csv,.tsv,.xlsx,.xls"
              disabled={busy}
              className="w-full min-w-0 rounded-g-1 border border-outline-input/40 p-3 text-sm focus:border-brand"
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []);
                const invalid = chosen.find(
                  (f) => !/\.(csv|tsv|xlsx|xls)$/i.test(f.name) || f.size > 25 * 1024 * 1024,
                );
                setError(
                  invalid
                    ? `${invalid.name}: choose a supported spreadsheet no larger than 25 MiB.`
                    : "",
                );
                setFiles(invalid ? [] : chosen);
              }}
            />
          </label>
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
                size="md"
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
                size="md"
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
                size="md"
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
