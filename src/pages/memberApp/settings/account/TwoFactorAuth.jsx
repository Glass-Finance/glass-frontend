import { useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import PageLoadingState from "../../../../components/common/PageLoadingState";
import LoadingState from "../../../../components/common/LoadingState";
import SuccessBadge from "../../../../components/common/SuccessBadge";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import { ShieldCheck, Shield, Copy, Check } from "lucide-react";
import { useMe } from "../../../../hooks/useMyAccount";
import { useQueryClient } from "@tanstack/react-query";
import {
  setupMfaTotp,
  enableMfaTotp,
  disableMfaTotp,
  regenerateMfaRecoveryCodes,
} from "../../../../services/authService";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { resolveMfaQrImageSrc } from "../../../../utils/mfaQrImageUrl";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard";
import { Button } from "../../../../components/ui/Button";
import { toastSuccess } from "../../../../utils/toast";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

// ── OTP digit input ───────────────────────────────────────────────────────────
function CodeInput({ value, onChange, disabled }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      autoComplete="one-time-code"
      placeholder="000000"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="w-full py-3 px-4 text-[22px] font-bold tracking-[8px] text-center rounded-xl border-[1.5px] border-hairline-strong bg-surface-page outline-none text-ink focus:border-brand"
    />
  );
}

// ── Setup flow ────────────────────────────────────────────────────────────────
function SetupFlow({ onSuccess, onCancel }) {
  const [stage, setStage] = useState("idle"); // idle | loading | qr | verifying | success | done
  const [setupData, setSetupData] = useState(null); // { secret, qrCodeUri, qrCodeImage }
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, copy] = useCopyToClipboard();

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

  async function verifySetup() {
    if (code.length !== 6) return;
    setStage("verifying");
    setError("");
    try {
      const result = await enableMfaTotp({ code });
      setRecoveryCodes(result?.recoveryCodes ?? []);
      setStage("success");
      setTimeout(() => setStage("done"), 1600);
    } catch (err) {
      setError(getErrorMessage(err, "Invalid code. Please try again."));
      setStage("qr");
      setCode("");
    }
  }

  function copySecret() {
    copy(setupData?.secret);
  }

  // SECURITY: these are all server-supplied (POST /auth/mfa/totp/setup) and this
  // value goes straight to <img src>. resolveMfaQrImageSrc validates each
  // candidate and takes the first SAFE one, preserving the original preference
  // order — see its docblock for why validating after a `??` chain would be
  // wrong. Rejects rather than repairing: a rejected value renders nothing.
  const qrSrc = resolveMfaQrImageSrc(setupData);
  const qrUri = setupData?.qrCodeUri ?? null;

  if (stage === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-brand-glow rounded-2xl py-[18px] px-4 text-center">
          <Shield size={28} className="text-brand mb-2.5" />
          <p className="text-[15px] font-semibold text-ink mb-1.5">Protect your account with MFA</p>
          <p className="text-[13px] text-ink-muted m-0 leading-relaxed">
            Use an authenticator app like Google Authenticator or Authy to generate time-based codes
            at login.
          </p>
        </div>

        <Button onClick={startSetup}>Set Up MFA</Button>
        <Button variant="outline-neutral" onClick={onCancel} fullWidth={false} size="md">
          Cancel
        </Button>
      </div>
    );
  }

  if (stage === "loading") {
    return <LoadingState label="Preparing setup…" size={22} className="py-10" />;
  }

  if (stage === "qr" || stage === "verifying") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-ink m-0">
          1. Scan this QR code with your authenticator app
        </p>

        {/* QR code display */}
        {qrSrc ? (
          <div className="flex justify-center p-4 bg-white rounded-xl border border-outline-on-surface">
            <img src={qrSrc} alt="MFA QR code" className="w-[180px] h-[180px]" loading="lazy" />
          </div>
        ) : qrUri ? (
          <div className="bg-white rounded-xl border border-outline-on-surface py-3 px-4">
            <p className="text-[11px] font-semibold text-ink-ghost uppercase tracking-[0.4px] mb-1.5">
              QR URI (scan or paste into your app)
            </p>
            <p className="text-[11px] text-ink-strong break-all m-0 leading-snug">{qrUri}</p>
          </div>
        ) : null}

        {/* Manual secret */}
        {setupData?.secret && (
          <div>
            <p className="text-[13px] text-ink-muted mb-2">Or enter this key manually:</p>
            <div className="flex items-center gap-2.5 bg-[#F5F5F5] rounded-[10px] py-2.5 px-3.5">
              <code className="flex-1 text-sm font-semibold tracking-[2px] text-ink break-all">
                {setupData.secret}
              </code>
              <Button
                variant="tertiary"
                size="icon-sm"
                onClick={copySecret}
                aria-label={copied ? "Copied" : "Copy setup key"}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        )}

        <p className="text-sm font-semibold text-ink mt-1 mb-0">
          2. Enter the 6-digit code from the app
        </p>
        <CodeInput value={code} onChange={setCode} disabled={stage === "verifying"} />
        {error && <p className="text-[13px] text-danger m-0">{error}</p>}

        <Button onClick={verifySetup} disabled={code.length !== 6} loading={stage === "verifying"}>
          {stage === "verifying" ? "Activating…" : "Activate MFA"}
        </Button>
        <Button variant="outline-neutral" onClick={onCancel} fullWidth={false} size="md">
          Cancel
        </Button>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <SuccessBadge message="Two-Factor Authentication Enabled!" />
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200">
          <p className="text-[13px] font-semibold text-ink mb-1">Save your recovery codes</p>
          <p className="text-xs text-ink-muted leading-relaxed m-0">
            Each code can only be used once if you lose access to your authenticator app.
          </p>
        </div>
        {recoveryCodes.length > 0 && (
          <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-2">
            {recoveryCodes.map((rc, i) => (
              <code
                key={i}
                className="text-xs font-mono font-bold text-ink bg-white rounded px-2 py-1 border border-gray-200 text-center"
              >
                {rc}
              </code>
            ))}
          </div>
        )}
        <Button onClick={onSuccess}>Done</Button>
      </div>
    );
  }

  return null;
}

// ── Disable flow ──────────────────────────────────────────────────────────────
function DisableFlow({ onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDisable() {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#FFF8F0] rounded-xl py-3.5 px-4 border border-[#FDDCB5]">
        <p className="text-sm font-semibold text-warning mb-1">Disable MFA?</p>
        <p className="text-[13px] text-[#7C4D0F] m-0 leading-relaxed">
          Your account will be less secure. You can re-enable it at any time.
        </p>
      </div>
      <p className="text-sm text-ink m-0">
        Enter the 6-digit code from your authenticator app to confirm:
      </p>
      <CodeInput value={code} onChange={setCode} disabled={loading} />
      {error && <p className="text-[13px] text-danger m-0">{error}</p>}
      <Button
        onClick={handleDisable}
        disabled={code.length !== 6}
        loading={loading}
        fullWidth={false}
        variant="critical"
        size="md"
        className="w-full"
      >
        {loading ? "Disabling…" : "Disable MFA"}
      </Button>
      <Button
        onClick={onCancel}
        fullWidth={false}
        variant="outline-neutral"
        size="md"
        className="w-full"
      >
        Cancel
      </Button>
    </div>
  );
}

// ── Regenerate recovery codes flow ─────────────────────────────────────────────
// Deliberately a two-step flow: the warning is shown before the code input,
// because the backend deletes every existing code the moment this succeeds.
// Someone who regenerates without reading that has silently invalidated the
// codes they were relying on.
function RegenerateFlow({ onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [copied, copy] = useCopyToClipboard();

  async function handleRegenerate() {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const result = await regenerateMfaRecoveryCodes({ code });
      setRecoveryCodes(result?.recoveryCodes ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't regenerate codes. Please try again."));
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  // Codes are only ever returned once, by this response — they aren't
  // retrievable afterwards, so this is the user's only chance to save them.
  if (recoveryCodes.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-[#FFF8F0] rounded-xl py-3.5 px-4 border border-[#FDDCB5]">
          <p className="text-sm font-semibold text-warning mb-1">Save your new recovery codes</p>
          <p className="text-[13px] text-[#7C4D0F] m-0 leading-relaxed">
            Your previous codes no longer work. These are shown once — store them somewhere safe
            before you continue.
          </p>
        </div>
        <div className="bg-[#F5F5F5] rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-2">
          {recoveryCodes.map((rc, i) => (
            <code
              key={i}
              className="text-xs font-mono font-bold text-ink bg-white rounded px-2 py-1 border border-gray-200 text-center"
            >
              {rc}
            </code>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          fullWidth={false}
          onClick={() => copy(recoveryCodes.join("\n"))}
          className="flex items-center justify-center gap-2"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy all codes"}
        </Button>
        <Button onClick={onSuccess}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#FFF8F0] rounded-xl py-3.5 px-4 border border-[#FDDCB5]">
        <p className="text-sm font-semibold text-warning mb-1">Replace your recovery codes?</p>
        <p className="text-[13px] text-[#7C4D0F] m-0 leading-relaxed">
          Your current recovery codes will stop working immediately and can't be recovered. Generate
          a new set if you've used them up, lost them, or think they may have been exposed.
        </p>
      </div>
      <p className="text-sm text-ink m-0">
        Enter the 6-digit code from your authenticator app to confirm:
      </p>
      <CodeInput value={code} onChange={setCode} disabled={loading} />
      {error && <p className="text-[13px] text-danger m-0">{error}</p>}
      <Button onClick={handleRegenerate} disabled={code.length !== 6 || loading}>
        {loading ? "Generating…" : "Generate New Codes"}
      </Button>
      <Button
        variant="outline-neutral"
        onClick={onCancel}
        disabled={loading}
        fullWidth={false}
        size="md"
      >
        Cancel
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TwoFactorAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useMe();
  const [flow, setFlow] = useState(null); // null | "setup" | "disable" | "regenerate"

  const mfaEnabled = profile?.mfaEnabled ?? false;

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["me"] });
    setFlow(null);
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      {/* Header */}
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => (flow ? setFlow(null) : goBackInApp(navigate, "/member/security"))}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">
          {flow === "setup"
            ? "Set Up MFA"
            : flow === "disable"
              ? "Disable MFA"
              : flow === "regenerate"
                ? "Recovery Codes"
                : "Multi-Factor Authentication"}
        </h1>
      </div>

      <div className="px-4">
        {isLoading ? (
          <PageLoadingState size={56} padding="36px 24px" />
        ) : flow === "setup" ? (
          <SetupFlow onSuccess={handleSuccess} onCancel={() => setFlow(null)} />
        ) : flow === "disable" ? (
          <DisableFlow onSuccess={handleSuccess} onCancel={() => setFlow(null)} />
        ) : flow === "regenerate" ? (
          <RegenerateFlow onSuccess={handleSuccess} onCancel={() => setFlow(null)} />
        ) : (
          <>
            {/* Status card */}
            <div className="bg-white rounded-2xl py-5 px-4 border border-surface-container-border mb-5 flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${mfaEnabled ? "bg-success-tint" : "bg-stacked-container"}`}
              >
                <ShieldCheck size={22} className={mfaEnabled ? "text-success" : "text-ink-faint"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-ink m-0">Authenticator App (TOTP)</p>
                <p
                  className={`text-[13px] mt-0.5 mb-0 ${mfaEnabled ? "text-success font-medium" : "text-ink-ghost font-normal"}`}
                >
                  {mfaEnabled ? "Active — your account is protected" : "Not set up"}
                </p>
              </div>
              <span
                className={`text-[11px] font-bold py-1 px-2.5 rounded-full ${mfaEnabled ? "bg-success-tint text-success-deep" : "bg-stacked-container text-ink-faint"}`}
              >
                {mfaEnabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* Action */}
            {mfaEnabled ? (
              <div className="flex flex-col gap-2.5">
                <Button variant="outline" onClick={() => setFlow("regenerate")}>
                  Regenerate Recovery Codes
                </Button>
                <Button
                  variant="outline-caution"
                  onClick={() => setFlow("disable")}
                  className="w-full"
                >
                  Disable MFA
                </Button>
              </div>
            ) : (
              <Button onClick={() => setFlow("setup")}>Set Up MFA</Button>
            )}

            {/* Info note */}
            <div className="flex items-start gap-2 py-3 px-3.5 rounded-[10px] bg-brand-mist mt-5">
              <div className="w-4 h-4 rounded-full border-[1.5px] border-brand flex items-center justify-center flex-shrink-0 mt-px">
                <span className="text-[9px] font-bold text-brand">i</span>
              </div>
              <p className="text-xs text-ink m-0 leading-relaxed">
                With MFA enabled, you'll need to enter a code from your authenticator app every time
                you sign in. Use Google Authenticator, Authy, or any TOTP-compatible app. If you
                ever lose access to it, you can sign in with one of the recovery codes you saved.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
