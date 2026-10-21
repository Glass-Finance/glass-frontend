import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import AuthLayout from "../../layouts/AuthLayout";
import { Label, TextInput, PrimaryButton, ErrorMessage } from "../../components/auth/FormFields";
import OtpBoxes from "../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../components/common/renderDashedOtpBoxes";

export function MfaChallengeScreen({
  mfaInputRef,
  mfaCode,
  setMfaCode,
  mfaMethod = "totp",
  recoveryCode = "",
  setRecoveryCode,
  canVerify,
  error,
  loading,
  onVerify,
  onSwitchMethod,
  onBack,
}) {
  // The recovery-code field is the escape hatch for someone who has lost or
  // replaced their authenticator app, so it has to be reachable without
  // making the TOTP path look broken — the toggle sits under the form, and
  // the heading/subtitle change to say which factor is being asked for.
  const isRecovery = mfaMethod === "recovery";

  return (
    <AuthLayout heroTitle="Manage Your Community" heroSubtitle="Finance Effortlessly">
      <div className="w-full max-w-md flex flex-col md:mt-14 mb-auto gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <ShieldCheck size={22} className="text-brand" />
          </div>
          <div>
            <h1 className="text-headline text-gray-900 mb-1">
              {isRecovery ? "Use a Recovery Code" : "Enter MFA Code"}
            </h1>
            <p className="text-sm text-gray-500">
              {isRecovery
                ? "Enter one of the backup codes you saved when you set up MFA. Each one works only once."
                : "Open your authenticator app and enter the 6-digit code."}
            </p>
          </div>
        </div>

        {isRecovery ? (
          <div>
            <Label htmlFor="mfa-recovery-code">Recovery Code</Label>
            <TextInput
              id="mfa-recovery-code"
              ref={mfaInputRef}
              type="text"
              // Not numeric: recovery codes are 16 alphanumeric characters.
              // autocapitalize=characters mirrors the backend's uppercase
              // normalisation so what's typed matches what was saved.
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={19} // 16 characters + up to three dashes
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onVerify()}
              // Deliberately not one-time-code: that would have the OS offer
              // an SMS/autofill code, which is the wrong factor here.
              autoComplete="off"
              disabled={loading}
              error={error}
            />
            <ErrorMessage message={error} />
          </div>
        ) : (
          <div>
            <Label htmlFor="mfa-code">Authentication Code</Label>
            <TextInput
              id="mfa-code"
              ref={mfaInputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && onVerify()}
              autoComplete="one-time-code"
              disabled={loading}
              error={error}
            />
            <ErrorMessage message={error} />
          </div>
        )}

        <PrimaryButton onClick={onVerify} loading={loading} disabled={!canVerify}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>Verifying…</span>
            </span>
          ) : (
            "Verify Code"
          )}
        </PrimaryButton>

        {onSwitchMethod && (
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => onSwitchMethod(isRecovery ? "totp" : "recovery")}
            disabled={loading}
          >
            {isRecovery
              ? "Use my authenticator app instead"
              : "Lost access to your authenticator? Use a recovery code"}
          </Button>
        )}

        <Button variant="tertiary" size="sm" fullWidth={false} onClick={onBack}>
          ← Back to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}

export function OtpVerifyScreen({
  otpIdentifier,
  otp,
  setOtp,
  otpError,
  otpCodeExpired,
  otpSecondsLeft,
  otpVerifying,
  otpSending,
  resendSecondsLeft,
  onBackToIdentifier,
  onVerify,
  onResend,
  formatCountdown,
}) {
  return (
    <AuthLayout heroTitle="Manage Your Community" heroSubtitle="Finance Effortlessly">
      <div className="w-full max-w-xl flex flex-col md:mt-14 mb-auto gap-12">
        <div>
          <h1 className="text-headline text-gray-900 mb-3 font-sans">Enter Your Code</h1>
          <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code sent to</p>
          <p className="text-sm font-semibold text-gray-900">{otpIdentifier}</p>
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={onBackToIdentifier}
            className="mt-1"
          >
            Use a different email
          </Button>
          <p
            className={`text-xs mt-2 ${otpCodeExpired ? "text-danger font-medium" : "text-gray-400"}`}
          >
            {otpCodeExpired
              ? "Your code has expired — request a new one below."
              : `Code expires in ${formatCountdown(otpSecondsLeft)}`}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <OtpBoxes
            value={otp}
            onChange={(next) => setOtp(next)}
            length={6}
            autoFocus
            disabled={otpVerifying}
            renderBoxes={renderDashedOtpBoxes}
          />

          {otpError && <p className="text-sm text-danger text-center -mt-2">{otpError}</p>}
          <PrimaryButton
            onClick={onVerify}
            loading={otpVerifying}
            disabled={otpCodeExpired || otp.some((digit) => !digit)}
          >
            {otpVerifying ? "Verifying…" : "Verify & Sign In"}
          </PrimaryButton>
        </div>

        <p className="text-center text-sm text-gray-text">
          Didn't get a code?{" "}
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={onResend}
            disabled={otpSending || resendSecondsLeft > 0}
          >
            {otpSending
              ? "Resending…"
              : resendSecondsLeft > 0
                ? `Resend in ${formatCountdown(resendSecondsLeft)}`
                : "Resend"}
          </Button>
        </p>
      </div>
    </AuthLayout>
  );
}
