import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import {} from "lucide-react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import OtpBoxes from "../../../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../../../components/common/renderDashedOtpBoxes";
import { useMe, useUpdateEmail } from "../../../../hooks/useMyAccount";
import { useAuth } from "../../../../store/AuthContext";
import { useCountdown, formatCountdown } from "../../../../hooks/useCountdown";
import { notifyError } from "../../../../utils/errorHandler";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { getEmailError } from "../../../../utils/validators";
import { Button } from "../../../../components/ui/Button";
import { TextInput } from "../../../../components/ui/TextInput";
import SuccessBadge from "../../../../components/common/SuccessBadge";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

// Masks an email's local part for display in the OTP prompt, e.g.
// "aminaargawal@gmail.com" -> "**********al@gmail.com" — keep the last 2
// characters before the @ visible, mask the rest.
function maskEmail(email) {
  const [local, domain] = (email ?? "").split("@");
  if (!domain || local.length <= 2) return email;
  return "*".repeat(local.length - 2) + local.slice(-2) + "@" + domain;
}

// ── Header shared by every step ─────────────────────────────────────────────
function StepHeader({ title, onBack }) {
  return (
    <div className="flex items-center justify-center relative pt-6 px-5 pb-6">
      {onBack && (
        <MobileBackButton aria-label="Back" onClick={onBack} className="absolute left-5" />
      )}
      <h1 className="text-lg font-medium text-ink m-0">{title}</h1>
    </div>
  );
}

// Full-page replacement for the old EmailChangeModal — same underlying
// updateEmail two-step mutation (call with { email } to trigger the OTP,
// again with { email, emailVerificationOtp } to confirm), just as its own
// screen per Figma instead of a modal popup.
export default function UpdateEmail() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { refreshUser } = useAuth();
  const updateEmail = useUpdateEmail();

  const [step, setStep] = useState("form"); // "form" | "otp" | "success"
  const [email, setEmail] = useState(user?.email ?? "");
  const [fieldError, setFieldError] = useState("");
  const [sending, setSending] = useState(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const secondsLeft = useCountdown(15 * 60, `${email}-${resendCount}`);
  const codeExpired = secondsLeft <= 0;

  async function handleUpdateEmail() {
    const trimmed = email.trim().toLowerCase();
    const formatError = getEmailError(trimmed);
    if (formatError) {
      setFieldError(formatError);
      return;
    }
    if (trimmed === user?.email?.toLowerCase()) {
      setFieldError("That's already your current email.");
      return;
    }
    setFieldError("");
    setSending(true);
    try {
      // No OTP yet — just the new address — triggers the backend to send a
      // code before anything actually changes.
      await updateEmail.mutateAsync({ email: trimmed });
      setStep("otp");
    } catch (err) {
      setFieldError(getErrorMessage(err, "Couldn't start the email update. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError("");
    setVerifying(true);
    try {
      await updateEmail.mutateAsync({
        email: email.trim().toLowerCase(),
        emailVerificationOtp: otp.join(""),
      });
      await refreshUser();
      setStep("success");
      setTimeout(() => goBackInApp(navigate, "/member/profile"), 1800);
    } catch (err) {
      setOtpError(
        notifyError(err, {
          context: "Verify email",
          fallback: "Invalid or expired code. Please try again.",
        }),
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMessage("");
    try {
      await updateEmail.mutateAsync({ email: email.trim().toLowerCase() });
      setResendMessage("A new code has been sent.");
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
    } catch (err) {
      setResendMessage(
        notifyError(err, {
          context: "Resend code",
          fallback: "Could not resend. Please try again.",
          silent: true,
        }),
      );
    } finally {
      setResending(false);
    }
  }

  if (step === "success") {
    return (
      <div className="relative overflow-hidden min-h-screen flex flex-col items-center justify-center px-6">
        <SuccessBadge message="Your Email Has Been Updated!" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />

      {step === "form" && (
        <>
          <StepHeader
            title="Update Your Email"
            onBack={() => goBackInApp(navigate, "/member/profile")}
          />
          <div className="px-4">
            <div className="border border-surface-container-border bg-white rounded-2xl p-4">
              <label className="text-xs text-ink-ghost block mb-1.5">Email Address</label>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError("");
                }}
                autoFocus
                error={fieldError}
              />
              {fieldError && <p className="text-xs text-danger mt-1.5 mx-1 mb-0">{fieldError}</p>}
            </div>
            <Button onClick={handleUpdateEmail} loading={sending} className="mt-5">
              {sending ? "Sending Code…" : "Update Email"}
            </Button>
          </div>
        </>
      )}

      {step === "otp" && (
        <>
          <StepHeader title="Enter OTP" onBack={() => setStep("form")} />
          <div className="px-5">
            <p className="text-lg font-bold text-ink mb-4">Enter the Code we Sent</p>
            <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code that was sent to</p>
            <p className="text-sm font-semibold text-gray-900 mb-3">{maskEmail(email)}</p>
            <Button variant="tertiary" size="sm" fullWidth={false} onClick={() => setStep("form")}>
              Wrong Email?
            </Button>

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
              <OtpBoxes
                key={resendCount}
                value={otp}
                onChange={setOtp}
                length={6}
                autoFocus
                renderBoxes={renderDashedOtpBoxes}
              />
              {otpError && <p className="text-sm text-danger text-center -mt-2">{otpError}</p>}
              <Button
                type="submit"
                disabled={codeExpired || otp.some((d) => !d)}
                loading={verifying}
              >
                {verifying ? "Verifying…" : "Continue"}
              </Button>
            </form>

            <p
              className={`text-xs mt-3 text-center ${codeExpired ? "text-danger font-medium" : "text-gray-400"}`}
            >
              {codeExpired
                ? "Your code has expired — request a new one below."
                : `Code expires in ${formatCountdown(secondsLeft)}`}
            </p>
            <p className="text-center text-sm mt-5 text-gray-500">
              Didn't get OTP?{" "}
              <Button
                variant="tertiary"
                size="sm"
                fullWidth={false}
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? "Resending…" : "Resend"}
              </Button>
            </p>
            {resendMessage && (
              <p className="text-center text-xs text-gray-400 mt-1">{resendMessage}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
