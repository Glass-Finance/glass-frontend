import { useId, useRef, useState } from "react";
import { useAuth } from "../../store/AuthContext";
import {
  canManageUserKyc,
  useAdminKycUser,
  useAdminUserKycMutation,
  userKycAction,
} from "../../hooks/useAdminKyc";
import { isKycApproved, kycStatusLabel } from "../../utils/kycStatus";
import { getErrorMessage } from "../../utils/errorHandler";
import GlassModal from "../common/GlassModal";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

export function AdminUserKycDialog({ userId, action, onClose }) {
  const { user: actor } = useAuth();
  const authorized = canManageUserKyc(actor?.role);
  const query = useAdminKycUser(userId, authorized);
  const mutation = useAdminUserKycMutation(userId, action);
  const formId = useId();
  const submitting = useRef(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [result, setResult] = useState(null);
  const approving = action === "APPROVE";
  const label = approving ? "Approve manually" : "Revoke KYC";
  const ready = authorized && query.isSuccess && !query.isFetching;
  const eligible = ready && userKycAction(query.data) === action;
  const busy = mutation.isPending;
  const target = query.data;

  async function submit(event) {
    event.preventDefault();
    if (!eligible || conflict || busy || submitting.current || !reason.trim()) return;
    submitting.current = true;
    setError("");
    try {
      setResult(await mutation.mutateAsync(reason.trim()));
    } catch (err) {
      if (err?.response?.status === 409) {
        setConflict(true);
        setError(
          "The user's KYC or account state changed. Review the refreshed state before trying again.",
        );
      } else {
        setError(getErrorMessage(err, "KYC action failed."));
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <GlassModal
      appearance="dashboard"
      title={label}
      onClose={onClose}
      closeDisabled={busy}
      className="rounded-g-1! sm:max-w-lg"
      footer={
        result ? (
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button size="sm" variant="outline-neutral" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {conflict ? (
              <Button
                size="sm"
                disabled={!ready || busy}
                onClick={() => {
                  setConflict(false);
                  setError("");
                }}
              >
                Review refreshed state
              </Button>
            ) : eligible ? (
              <Button
                type="submit"
                form={formId}
                size="sm"
                variant={approving ? "primary" : "critical"}
                loading={busy}
                disabled={!reason.trim() || !ready}
              >
                {label}
              </Button>
            ) : null}
          </div>
        )
      }
    >
      <div className="space-y-4 text-sm text-ink-muted">
        {result ? (
          <div role="status" className="space-y-2 break-words">
            <p className="font-semibold text-ink">{approving ? "KYC approved" : "KYC revoked"}</p>
            <p>{kycStatusLabel(result.status)}</p>
            <p>{result.attemptId ?? "No verification attempt"}</p>
            {result.decisionReason && <p>{result.decisionReason}</p>}
            {result.revokedReason && <p>{result.revokedReason}</p>}
          </div>
        ) : !authorized ? (
          <p role="alert">You don't have permission to manage KYC.</p>
        ) : (
          <>
            {query.isFetching && <p role="status">Refreshing user…</p>}
            {query.isError && (
              <div role="alert">
                <p>{getErrorMessage(query.error, "Could not load the user.")}</p>
                <Button size="sm" variant="outline-neutral" onClick={() => query.refetch()}>
                  Reload user
                </Button>
              </div>
            )}
            {target && (
              <div className="space-y-1 break-words">
                <p className="font-semibold text-ink">
                  {[target.userData?.firstName, target.userData?.lastName]
                    .filter(Boolean)
                    .join(" ") || "User"}
                </p>
                <p>{target.email}</p>
                <p>{target.id}</p>
                <p>
                  Current KYC: {target.kycStatus ? kycStatusLabel(target.kycStatus) : "Unavailable"}
                </p>
              </div>
            )}
            {ready && !eligible && (
              <p role="alert">
                {approving && isKycApproved(target?.kycStatus)
                  ? "KYC is already approved. No approval was submitted."
                  : "This user is not eligible for this KYC action."}
              </p>
            )}
            {eligible && (
              <form id={formId} onSubmit={submit} className="space-y-4">
                <p>
                  {approving
                    ? "This approves the user's current KYC regardless of verification stage or available evidence. A verification attempt is not required."
                    : "This revokes the user's current KYC approval, including an approval with no verification attempt."}
                </p>
                <TextInput
                  label="Reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy || conflict}
                  required
                  autoComplete="off"
                />
              </form>
            )}
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </GlassModal>
  );
}

// User rows supply a snapshot to avoid a request per row. The dialog always
// reloads it. Attempt details fetch the profile instead of trusting history.
export default function AdminUserKycActions({ userId, user, onAction }) {
  const { user: actor } = useAuth();
  const authorized = canManageUserKyc(actor?.role);
  const query = useAdminKycUser(userId, authorized && !user);
  const [action, setAction] = useState(null);
  const currentUser = user ?? (query.isSuccess && !query.isFetching ? query.data : null);
  const available = authorized ? userKycAction(currentUser) : null;
  return (
    <>
      {available && (
        <Button
          size="sm"
          variant={available === "APPROVE" ? "outline" : "outline-caution"}
          fullWidth={false}
          onClick={() => (onAction ? onAction(available) : setAction(available))}
        >
          {available === "APPROVE" ? "Approve manually" : "Revoke KYC"}
        </Button>
      )}
      {!user && authorized && query.isError && (
        <span role="alert" className="text-xs text-danger">
          {getErrorMessage(query.error, "Could not load current KYC.")}
        </span>
      )}
      {action && (
        <AdminUserKycDialog userId={userId} action={action} onClose={() => setAction(null)} />
      )}
    </>
  );
}
