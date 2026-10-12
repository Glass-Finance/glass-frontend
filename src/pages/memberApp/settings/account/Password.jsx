import { useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useUpdatePassword } from "../../../../hooks/useMyAccount";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "../../../../utils/password";
import PasswordChecklist from "../../../../components/auth/PasswordChecklist";
import { Button } from "../../../../components/ui/Button";
import { TextInput } from "../../../../components/ui/TextInput";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

function PasswordField({ label, value, onChange, show, onToggleShow }) {
  return (
    <div>
      <label className="text-xs text-ink-ghost block mb-1.5">{label}</label>
      <TextInput
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        rightElement={
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            onClick={onToggleShow}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
        }
      />
    </div>
  );
}

export default function Password() {
  const navigate = useNavigate();
  const updatePassword = useUpdatePassword();

  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!form.currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (!isPasswordValid(form.newPassword)) {
      setError(`Password must include: ${PASSWORD_REQUIREMENTS_TEXT.toLowerCase()}`);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    try {
      // PATCH /api/v1/user/password requires { oldPassword, newPassword,
      // confirmPassword } — all three, verified server-side. The
      // new/confirm match above is UI-only; the backend enforces it too.
      await updatePassword.mutateAsync({
        oldPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update password."));
    }
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Password</h1>
      </div>

      <div className="px-4">
        <div className="border border-surface-container-border bg-white rounded-2xl p-4 flex flex-col gap-3.5">
          <PasswordField
            label="Current Password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            show={show.current}
            onToggleShow={() => setShow((s) => ({ ...s, current: !s.current }))}
          />
          <div>
            <PasswordField
              label="New Password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              show={show.next}
              onToggleShow={() => setShow((s) => ({ ...s, next: !s.next }))}
            />
            <PasswordChecklist password={form.newPassword} />
          </div>
          <PasswordField
            label="Confirm New Password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            show={show.confirm}
            onToggleShow={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
          />
        </div>

        {error && <p className="text-[13px] text-danger mt-3 mx-1 mb-0">{error}</p>}
        {success && (
          <p className="text-[13px] text-success-strong mt-3 mx-1 mb-0">Password updated.</p>
        )}

        <Button onClick={handleSubmit} loading={updatePassword.isPending} className="mt-4">
          {updatePassword.isPending ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </div>
  );
}
