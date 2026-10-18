import { useEffect, useState } from "react";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { makeRecordPatch, validateRecord } from "../../../utils/recordBook";
import RecordFields from "./RecordFields";
import { ErrorNotice } from "./RecordBookUI";

export default function RecordFormModal({
  communityId,
  defaultCurrency = "NGN",
  record,
  draft = false,
  readOnly = false,
  readOnlyMessage,
  onSave,
  onClose,
}) {
  const [original] = useState(record);
  const [values, setValues] = useState(() =>
    record
      ? { ...record, amount: record.amount == null ? "" : String(record.amount) }
      : {
          recordType: "MEMBER_PAYMENT",
          direction: "INFLOW",
          occurredOn: new Date().toISOString().slice(0, 10),
          amount: "",
          currency: defaultCurrency,
        },
  );
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const changedOnServer = !!original?.updatedAt && record?.updatedAt !== original.updatedAt;
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function close() {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }
  async function save(e) {
    e.preventDefault();
    const validation = validateRecord(values, draft);
    setErrors(validation);
    if (Object.keys(validation).length || readOnly || changedOnServer || busy) return;
    setBusy(true);
    setError(null);
    const patch = makeRecordPatch(original, values);
    if (duplicate) patch.duplicateAccepted = true;
    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const label = original ? "Save changes" : "Add record";
  return (
    <ModalShell
      title={original ? "Edit record" : "Add record"}
      onClose={close}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="outline-neutral"
            size="md"
            fullWidth={false}
            onClick={close}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-book-form"
            size="md"
            fullWidth={false}
            loading={busy}
            disabled={readOnly || changedOnServer}
          >
            {label}
          </Button>
        </div>
      }
    >
      <form
        id="record-book-form"
        onSubmit={save}
        className="p-5 max-h-[65vh] overflow-y-auto space-y-4"
      >
        <p className="text-sm text-ink-muted">
          This records historical activity. It does not move money.
        </p>
        <ErrorNotice error={error} />
        {(readOnly || changedOnServer) && (
          <ErrorNotice
            message={
              changedOnServer
                ? "This record changed while you were editing. Your values are preserved. Close and reopen the record to compare the latest version before saving."
                : readOnlyMessage ||
                  "This import is no longer editable. Your unsaved values remain here for reference."
            }
          />
        )}
        <RecordFields
          communityId={communityId}
          values={values}
          errors={errors}
          disabled={busy || readOnly || changedOnServer}
          onChange={(patch) => {
            setValues((prev) => ({ ...prev, ...patch }));
            setDirty(true);
            setDuplicate(false);
          }}
        />
        <label className="flex gap-3 items-start text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={duplicate}
            onChange={(e) => {
              setDuplicate(e.target.checked);
              setDirty(true);
            }}
            disabled={busy || readOnly}
            className="mt-1 accent-brand"
          />
          <span>
            I have checked for duplicates and want to include this record even if it matches
            another.
          </span>
        </label>
        {confirmClose && (
          <div className="rounded-g-1 border border-black/10 p-3 space-y-3">
            <p className="text-sm">Discard your unsaved changes?</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                fullWidth={false}
                variant="outline-neutral"
                onClick={() => setConfirmClose(false)}
              >
                Keep editing
              </Button>
              <Button size="sm" fullWidth={false} variant="outline-caution" onClick={onClose}>
                Discard changes
              </Button>
            </div>
          </div>
        )}
      </form>
    </ModalShell>
  );
}
