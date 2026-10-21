import { useState } from "react";
import { notifyError } from "../../utils/errorHandler";
import { useCountdown, formatCountdown } from "../../hooks/useCountdown";
import OtpBoxes from "./OtpBoxes";
import { Button } from "../ui/Button";
import SuccessBadge from "./SuccessBadge";
import ModalShell from "../dashboard/ModalShell";

// Codes are valid for 15 minutes (see the same figure quoted in SignIn.jsx).
const OTP_VALIDITY_SECONDS = 15 * 60;

// Masks an email's local part for display in the OTP prompt, e.g.
// "aminaargawal@gmail.com" -> "**********al@gmail.com" — keep the last 2
// characters before the @ visible, mask the rest.
function maskEmail(email) {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  return "*".repeat(local.length - 2) + local.slice(-2) + "@" + domain;
}

// Two-step modal: enter the OTP sent to the new email, then a brief success
// confirmation. The caller requests and resends an EMAIL_UPDATE challenge;
// onSubmitOtp confirms it through PATCH /user/email.
// onSubmitOtp(otpString) — called with the 6-digit code to confirm the change
export default function EmailChangeModal({
  newEmail,
  onResend,
  onSubmitOtp,
  onVerified,
  onWrongEmail,
  onClose,
}) {
  const [step, setStep] = useState("otp"); // "otp" | "success"
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const secondsLeft = useCountdown(OTP_VALIDITY_SECONDS, `${newEmail}-${resendCount}`);
  const codeExpired = secondsLeft <= 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmitOtp(otp.join(""));
      setStep("success");
      setTimeout(() => onVerified(), 1800);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Verify email",
          fallback: "Invalid or expired code. Please try again.",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMessage("");
    try {
      await onResend();
      setResendMessage("A new code has been sent.");
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
      setError("");
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
      <ModalShell onClose={onVerified}>
        <SuccessBadge message="Your Email Has Been Updated!" />
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <h1 className="text-headline text-gray-900 mb-3">Enter the Code we Sent</h1>
      <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code that was sent to</p>
      <p className="text-sm font-semibold text-gray-900 mb-2">{maskEmail(newEmail)}</p>
      <button
        onClick={onWrongEmail}
        className="text-sm font-medium hover:underline text-brand-link"
      >
        Wrong email?
      </button>
      <p
        className={`text-xs mt-2 mb-6 ${codeExpired ? "text-danger font-medium" : "text-gray-400"}`}
      >
        {codeExpired
          ? "Your code has expired — request a new one below."
          : `Code expires in ${formatCountdown(secondsLeft)}`}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <OtpBoxes
          key={resendCount}
          value={otp}
          onChange={setOtp}
          length={6}
          autoFocus
          renderBoxes={(digits, activeIndex) => (
            <div className="flex items-center gap-4 justify-center pointer-events-none">
              {digits.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  className={`w-16 h-16 flex-shrink-0 flex items-center justify-center text-lg font-semibold text-gray-900 rounded-lg transition-all border-[1.5px] ${i === activeIndex ? "otp-box-active " : ""}${d || i === activeIndex ? "border-brand-deep" : "border-hairline-disabled"}`}
                >
                  {d}
                </div>
              ))}
              <span className="text-gray-400 text-lg font-medium px-1 flex-shrink-0">—</span>
              {digits.slice(3, 6).map((d, i) => {
                const idx = i + 3;
                return (
                  <div
                    key={idx}
                    className={`w-16 h-16 flex-shrink-0 flex items-center justify-center text-lg font-semibold text-gray-900 rounded-lg transition-all border-[1.5px] ${idx === activeIndex ? "otp-box-active " : ""}${d || idx === activeIndex ? "border-brand-deep" : "border-hairline-disabled"}`}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          )}
        />

        {error && <p className="text-sm text-danger text-center -mt-2">{error}</p>}

        <Button type="submit" disabled={codeExpired || otp.some((d) => !d)} loading={loading}>
          {loading ? "Verifying..." : "Continue"}
        </Button>
      </form>

      <p className="text-center text-sm mt-5 text-gray-500">
        Didn't get OTP?{" "}
        <button
          onClick={handleResend}
          disabled={resending}
          className="font-medium hover:underline disabled:opacity-60 text-brand-link"
        >
          {resending ? "Resending..." : "Resend"}
        </button>
      </p>
      {resendMessage && <p className="text-center text-xs text-gray-400 mt-1">{resendMessage}</p>}
    </ModalShell>
  );
}
