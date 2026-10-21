import { useState, useEffect, useRef, useId } from "react";
import QRCode from "qrcode";
import { Eye, EyeOff, ShieldCheck, Shield, Copy, Check, X, KeyRound } from "lucide-react";
import { useUpdatePassword, useMe } from "../../../../hooks/useMyAccount";
import {
  setupMfaTotp,
  enableMfaTotp,
  disableMfaTotp,
  regenerateMfaRecoveryCodes,
} from "../../../../services/authService";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "../../../../utils/password";
import PasswordChecklist from "../../../../components/auth/PasswordChecklist";
import LoadingState from "../../../../components/common/LoadingState";
import SuccessBadge from "../../../../components/common/SuccessBadge";
import { Button } from "../../../../components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard";
import { useEscapeToClose } from "../../../../hooks/useKeyboardShortcuts";
import { toastSuccess } from "../../../../utils/toast";

// ─── MFA Modal ────────────────────────────────────────────────────────────────

function MfaModal({ mode, onClose, onSuccess }) {
  const [stage, setStage] = useState(mode === "setup" ? "idle" : "confirm");
  // Regenerating invalidates the existing codes the moment it succeeds, so
  // like the post-enable screen it ends on a stage that can only be left via
  // an explicit "Done" — requestDismiss below refuses to close it otherwise.
  const showingRecoveryCodes = stage === "recovery" || stage === "regenerated";
  const [setupData, setSetupData] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, copy] = useCopyToClipboard();
  const [copiedAll, copyAll] = useCopyToClipboard();
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const titleId = useId();
  const codeInputId = useId();
  const dialogRef = useRef(null);

  // Recovery codes are shown exactly once. Letting the backdrop, Escape, or
  // the header's X dismiss the modal here the same as every other stage
  // meant a single misclick lost them permanently, with no way to see them
  // again. Every dismissal path funnels through here so that stage is the
  // one place this is enforced -- "Done" (gated on savedConfirmed below) is
  // the only way out once codes are on screen.
  function requestDismiss() {
    if (stage === "recovery" || stage === "success" || stage === "regenerated") return;
    onClose();
  }

  useEscapeToClose(requestDismiss);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );

    // Initial focus -- without this, focus stays on whatever triggered the
    // modal (the page behind it), so a keyboard user's next Tab jumps back
    // into the page instead of into the dialog that just covered it.
    getFocusable()[0]?.focus();

    function handler(e) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Basic focus trap: Tab/Shift+Tab wraps within the dialog instead of
      // escaping into the page behind it while the modal is open.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // Re-run when the visible stage changes -- the focusable set (and what
    // should get initial focus) is different on every screen.
  }, [stage]);

  async function startSetup() {
    setStage("loading");
    setError("");
    try {
      const data = await setupMfaTotp();
      setSetupData(data);
      setStage("qr");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't start setup. Please try again."));
      setStage("idle");
    }
  }

  async function confirmEnable() {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const result = await enableMfaTotp({ code });
      setRecoveryCodes(result?.recoveryCodes ?? []);
      setStage("success");
      setTimeout(() => setStage("recovery"), 1600);
    } catch (err) {
      setError(getErrorMessage(err, "Invalid code. Please try again."));
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await disableMfaTotp({ code });
      toastSuccess("Two-factor authentication disabled");
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Invalid code. Please try again."));
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function confirmRegenerate() {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const result = await regenerateMfaRecoveryCodes({ code });
      setRecoveryCodes(result?.recoveryCodes ?? []);
      setStage("regenerated");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't regenerate codes. Please try again."));
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    copy(secret);
  }

  const otpauthUri =
    setupData?.otpauthUri ??
    setupData?.qrCodeUri ??
    setupData?.otpAuthUri ??
    setupData?.otpauth_url ??
    setupData?.uri ??
    null;
  const secret =
    setupData?.secret ??
    setupData?.totpSecret ??
    setupData?.secretKey ??
    setupData?.key ??
    (otpauthUri ? new URLSearchParams(otpauthUri.split("?")[1]).get("secret") : null);
  const [qrSrc, setQrSrc] = useState(null);

  useEffect(() => {
    if (!otpauthUri) return;
    QRCode.toDataURL(otpauthUri, { width: 200, margin: 1 })
      .then(setQrSrc)
      .catch(() => setQrSrc(null));
  }, [otpauthUri]);

  const inputCls =
    "w-full h-12 min-h-8 px-6 py-1 rounded-lg border border-gray-300 text-gray-900 text-sm outline-none text-center tracking-widest font-mono text-lg transition-all focus:border-brand";

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-surface-bg rounded-2xl w-full max-w-md shadow-2xl border border-surface-container-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 id={titleId} className="text-sm font-bold text-gray-900">
            {mode === "setup"
              ? "Set Up Authenticator App"
              : mode === "regenerate"
                ? "Regenerate Recovery Codes"
                : "Disable MFA"}
          </h2>
          {/* Hidden, not just a no-op, during the recovery stage -- same
              reasoning as the Cancel button below: once codes are on
              screen, "Done" is the only way out. */}
          {!showingRecoveryCodes && stage !== "success" && (
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Close"
              onClick={requestDismiss}
              className=""
            >
              <X size={15} />
            </Button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Setup: idle */}
          {mode === "setup" && stage === "idle" && (
            <>
              <div className="bg-brand-glow rounded-xl p-4 text-center">
                <Shield size={24} className="text-brand mx-auto mb-2" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Use Google Authenticator, Authy, or any TOTP-compatible app to generate time-based
                  codes at login.
                </p>
              </div>
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button onClick={startSetup} size="sm">
                Begin Setup
              </Button>
            </>
          )}

          {/* Setup: loading */}
          {stage === "loading" && <LoadingState className="py-8" />}

          {/* Setup: QR code + code entry */}
          {(stage === "qr" || (mode === "setup" && stage === "confirm")) && (
            <>
              <p className="text-xs font-semibold text-gray-700">
                1. Scan with your authenticator app
              </p>
              {qrSrc ? (
                <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-200">
                  <img src={qrSrc} alt="MFA QR code" className="w-44 h-44" loading="lazy" />
                </div>
              ) : otpauthUri ? (
                <div className="bg-stacked-container rounded-xl p-3 border border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Copy this URI into your authenticator app
                  </p>
                  <p className="text-xs text-gray-600 break-all leading-relaxed">{otpauthUri}</p>
                </div>
              ) : null}

              {secret && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Or enter this key manually:</p>
                  <div className="flex items-center gap-2 bg-stacked-container rounded-lg px-3 py-2 border border-gray-200">
                    <code className="flex-1 text-xs font-bold tracking-widest text-gray-800 break-all">
                      {secret}
                    </code>
                    <Button
                      variant="tertiary"
                      size="sm"
                      fullWidth={false}
                      onClick={copySecret}
                      aria-label="Copy secret key"
                      className="flex-shrink-0"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
              )}

              <label htmlFor={codeInputId} className="text-xs font-semibold text-gray-700">
                2. Enter the 6-digit code
              </label>
              <input
                id={codeInputId}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={inputCls}
              />
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button
                onClick={confirmEnable}
                disabled={code.length !== 6}
                loading={loading}
                size="sm"
              >
                {loading ? "Activating…" : "Activate MFA"}
              </Button>
            </>
          )}

          {/* Disable flow */}
          {mode === "disable" && stage === "confirm" && (
            <>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  Your account will be less secure
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  You can re-enable MFA at any time from Security settings.
                </p>
              </div>
              <label htmlFor={codeInputId} className="text-xs text-gray-600">
                Enter the 6-digit code from your authenticator app to confirm:
              </label>
              <input
                id={codeInputId}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={inputCls}
              />
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button
                onClick={confirmDisable}
                disabled={code.length !== 6}
                loading={loading}
                variant="danger"
                size="sm"
              >
                {loading ? "Disabling…" : "Disable MFA"}
              </Button>
            </>
          )}

          {/* Regenerate: warning first, code entry second. The backend deletes
              every existing code the moment this succeeds, so the consequence
              has to be read before the confirming input, not after. */}
          {mode === "regenerate" && stage === "confirm" && (
            <>
              <div className="bg-warning-wash rounded-xl p-4 border border-warning/30">
                <p className="text-xs font-semibold text-warning mb-1">
                  Replace your recovery codes?
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Your current recovery codes will stop working immediately and can't be recovered.
                  Generate a new set if you've used them up, lost them, or think they may have been
                  exposed.
                </p>
              </div>
              <label htmlFor={codeInputId} className="text-xs text-gray-600">
                Enter the 6-digit code from your authenticator app to confirm:
              </label>
              <input
                id={codeInputId}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={inputCls}
              />
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <Button
                onClick={confirmRegenerate}
                disabled={code.length !== 6}
                loading={loading}
                size="sm"
              >
                {loading ? "Generating…" : "Generate New Codes"}
              </Button>
            </>
          )}

          {/* Regenerated codes -- same single-exit handling as the post-enable
              screen below, since these are shown once and only retrievable
              from this response. */}
          {stage === "regenerated" && (
            <div className="flex flex-col gap-3">
              <div className="bg-warning-wash rounded-xl p-4 border border-warning/30">
                <p className="text-xs font-semibold text-warning mb-1">
                  Save your new recovery codes
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Your previous codes no longer work. These are shown once — store them somewhere
                  safe before you continue.
                </p>
              </div>
              {recoveryCodes.length > 0 && (
                <>
                  <div className="bg-stacked-container rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-2">
                    {recoveryCodes.map((rc, i) => (
                      <code
                        key={i}
                        className="text-xs font-mono font-bold text-gray-800 bg-white rounded px-2 py-1 border border-gray-200 text-center"
                      >
                        {rc}
                      </code>
                    ))}
                  </div>
                  <Button
                    variant="tertiary"
                    size="xs"
                    fullWidth={false}
                    onClick={() => copyAll(recoveryCodes.join("\n"))}
                  >
                    {copiedAll ? <Check size={13} /> : <Copy size={13} />}
                    {copiedAll ? "Copied" : "Copy all codes"}
                  </Button>
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={(e) => setSavedConfirmed(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                I've saved these codes somewhere safe
              </label>
              <Button onClick={onSuccess} disabled={!savedConfirmed} size="sm">
                Done
              </Button>
            </div>
          )}

          {/* Brief animated confirmation before the recovery codes -- gives
              the same success moment every other action in the app gets,
              without holding up the codes screen (auto-advances). */}
          {stage === "success" && (
            <div className="flex flex-col items-center justify-center py-6">
              <SuccessBadge message="MFA Enabled Successfully!" />
            </div>
          )}

          {/* Recovery codes — shown after MFA is successfully enabled.
              Shown exactly once (the backend won't return them again), so
              this is the one screen in the modal that can't be dismissed
              casually -- see requestDismiss above for the backdrop/Escape/X
              side of that; "Done" itself is also gated on savedConfirmed so
              clicking through isn't just as easy as the dismiss paths it
              replaces. */}
          {stage === "recovery" && (
            <div className="flex flex-col gap-3">
              <div className="bg-stacked-container rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Save your recovery codes</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Each code can only be used once if you lose access to your authenticator app.
                </p>
              </div>
              {recoveryCodes.length > 0 && (
                <>
                  <div className="bg-stacked-container rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-2">
                    {recoveryCodes.map((rc, i) => (
                      <code
                        key={i}
                        className="text-xs font-mono font-bold text-gray-800 bg-white rounded px-2 py-1 border border-gray-200 text-center"
                      >
                        {rc}
                      </code>
                    ))}
                  </div>
                  <Button
                    variant="tertiary"
                    size="xs"
                    fullWidth={false}
                    onClick={() => copyAll(recoveryCodes.join("\n"))}
                  >
                    {copiedAll ? <Check size={13} /> : <Copy size={13} />}
                    {copiedAll ? "Copied" : "Copy all codes"}
                  </Button>
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={(e) => setSavedConfirmed(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                I've saved these codes somewhere safe
              </label>
              <Button onClick={onSuccess} disabled={!savedConfirmed} size="sm">
                Done
              </Button>
            </div>
          )}

          {!showingRecoveryCodes && stage !== "success" && (
            <Button onClick={requestDismiss} variant="secondary" size="sm">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Security() {
  const queryClient = useQueryClient();
  const updatePassword = useUpdatePassword();
  const { data: profile } = useMe();
  const mfaEnabled = profile?.mfaEnabled ?? false;

  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState({ current: "", new: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mfaModal, setMfaModal] = useState(null); // "setup" | "disable" | null

  const inputCls =
    "w-full h-12 min-h-8 px-4 py-1 rounded-lg border border-gray-300 text-black placeholder-black/60 text-placeholder outline-none transition-all pr-11 focus:border-brand";

  function validatePasswordField(field, value, otherValue) {
    if (field === "current" && !value) return "Current password is required.";
    if (field === "new" && !isPasswordValid(value))
      return `Must include: ${PASSWORD_REQUIREMENTS_TEXT.toLowerCase()}`;
    if (field === "confirm") {
      if (!value) return "Please confirm your new password.";
      if (value !== otherValue) return "Passwords don't match.";
    }
    return "";
  }

  function setPasswordField(field) {
    return (e) => {
      const value = e.target.value;
      setPasswords((p) => ({ ...p, [field]: value }));
      setFieldErrors((fe) => {
        const next = { ...fe };
        if (fe[field])
          next[field] = validatePasswordField(
            field,
            value,
            field === "new" ? passwords.confirm : passwords.new,
          );
        if (field === "new" && fe.confirm)
          next.confirm = validatePasswordField("confirm", passwords.confirm, value);
        return next;
      });
    };
  }

  function handlePasswordBlur(field) {
    return (e) =>
      setFieldErrors((fe) => ({
        ...fe,
        [field]: validatePasswordField(
          field,
          e.target.value,
          field === "new" ? passwords.confirm : passwords.new,
        ),
      }));
  }

  async function handleUpdatePassword() {
    setError("");
    setSuccess(false);
    const nextFieldErrors = {
      current: validatePasswordField("current", passwords.current),
      new: validatePasswordField("new", passwords.new),
      confirm: validatePasswordField("confirm", passwords.confirm, passwords.new),
    };
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    try {
      await updatePassword.mutateAsync({
        oldPassword: passwords.current,
        newPassword: passwords.new,
        confirmPassword: passwords.confirm,
      });
      setSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      setFieldErrors({ current: "", new: "", confirm: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update password."));
    }
  }

  function handleMfaSuccess() {
    queryClient.invalidateQueries({ queryKey: ["me"] });
    setMfaModal(null);
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Password */}
      <div className="bg-surface-container rounded-2xl p-6 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Password</p>
        <p className="text-xs text-gray-500 mb-4">
          Keep your account secure with a strong password.
        </p>
        <div className="-mx-6 border-b border-gray-100 mb-5" />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="current-password" className="text-xs font-medium text-gray-600">
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={show.current ? "text" : "password"}
                value={passwords.current}
                onChange={setPasswordField("current")}
                onBlur={handlePasswordBlur("current")}
                placeholder="Enter Current Password"
                className={inputCls}
                style={fieldErrors.current ? { borderColor: "var(--color-danger)" } : undefined}
              />
              <Button
                type="button"
                variant="tertiary"
                size="icon-sm"
                onClick={() => setShow({ ...show, current: !show.current })}
                aria-label={show.current ? "Hide current password" : "Show current password"}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {show.current ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </div>
            {fieldErrors.current && <p className="text-xs text-danger">{fieldErrors.current}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-xs font-medium text-gray-600">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show.new ? "text" : "password"}
                  value={passwords.new}
                  onChange={setPasswordField("new")}
                  onBlur={handlePasswordBlur("new")}
                  placeholder="Enter New Password"
                  className={inputCls}
                  style={fieldErrors.new ? { borderColor: "var(--color-danger)" } : undefined}
                />
                <Button
                  type="button"
                  variant="tertiary"
                  size="icon-sm"
                  onClick={() => setShow({ ...show, new: !show.new })}
                  aria-label={show.new ? "Hide new password" : "Show new password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {show.new ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
              <PasswordChecklist password={passwords.new} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-gray-600">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={show.confirm ? "text" : "password"}
                  value={passwords.confirm}
                  onChange={setPasswordField("confirm")}
                  onBlur={handlePasswordBlur("confirm")}
                  placeholder="Confirm New Password"
                  className={inputCls}
                  style={fieldErrors.confirm ? { borderColor: "var(--color-danger)" } : undefined}
                />
                <Button
                  type="button"
                  variant="tertiary"
                  size="icon-sm"
                  onClick={() => setShow({ ...show, confirm: !show.confirm })}
                  aria-label={show.confirm ? "Hide confirm password" : "Show confirm password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {show.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
              {fieldErrors.confirm && <p className="text-xs text-danger">{fieldErrors.confirm}</p>}
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Password updated.</p>}

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={handleUpdatePassword}
              disabled={updatePassword.isPending}
            >
              {updatePassword.isPending ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </div>
      </div>

      {/* MFA */}
      <div className="bg-surface-container rounded-2xl p-6 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">
          Multi-Factor Authentication (MFA)
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Add an extra layer of protection to your account.
        </p>
        <div className="-mx-6 border-b border-gray-100 mb-1" />

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${mfaEnabled ? "bg-green-50" : "bg-gray-100"}`}
            >
              <ShieldCheck size={16} className={mfaEnabled ? "text-success" : "text-gray-400"} />
            </div>
            <div>
              <p className="text-sm text-gray-900">Authenticator App (TOTP)</p>
              <p className="text-xs text-gray-500">
                Time-based codes from Google Authenticator or Authy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mfaEnabled ? "bg-success-wash text-success-strong" : "bg-stacked-container text-ink-faint"}`}
            >
              {mfaEnabled ? "ON" : "OFF"}
            </span>
            <Button
              variant={mfaEnabled ? "outline-caution" : "outline"}
              size="xs"
              fullWidth={false}
              onClick={() => setMfaModal(mfaEnabled ? "disable" : "setup")}
            >
              {mfaEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>

        {/* Recovery codes are only meaningful once TOTP is on — with MFA
            disabled there are no codes to regenerate, so the row is hidden
            rather than shown disabled. */}
        {mfaEnabled && (
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
                <KeyRound size={16} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-900">Recovery Codes</p>
                <p className="text-xs text-gray-500">
                  Single-use codes to sign in if you lose your authenticator
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={() => setMfaModal("regenerate")}
            >
              Regenerate
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
              <Shield size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-900">SMS Verification</p>
              <p className="text-xs text-gray-500">One-time code via SMS at login</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stacked-container text-ink-faint">
            Coming soon
          </span>
        </div>
      </div>

      {mfaModal && (
        <MfaModal mode={mfaModal} onClose={() => setMfaModal(null)} onSuccess={handleMfaSuccess} />
      )}
    </div>
  );
}
