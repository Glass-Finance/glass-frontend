import { useState } from "react";
import { notifyError } from "../../utils/errorHandler";
import { useCountdown, formatCountdown } from "../../hooks/useCountdown";
import OtpBoxes from "./OtpBoxes";
import { renderDashedOtpBoxes } from "./renderDashedOtpBoxes";
import { Button } from "../ui/Button";
import SuccessBadge from "./SuccessBadge";
import ModalShell from "../dashboard/ModalShell";

// Codes are valid for 15 minutes (see the same figure quoted in SignIn.jsx
// and EmailChangeModal.jsx).
const OTP_VALIDITY_SECONDS = 15 * 60;

// Masks a phone number for display, keeping the last 4 digits visible, e.g.
// "2348012345678" -> "*********5678".
function maskPhone(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

// Two-step modal: enter the OTP sent to the new phone number, then a brief
// success confirmation. The caller is expected to have already fired
// requestPhoneUpdate (POST /action-verification/request) before mounting
// this — onSubmitOtp only handles the confirming PATCH /user/phone call,
// same "send before you mount" contract EmailChangeModal uses.
// onSubmitOtp(otpString) — called with the 6-digit code to confirm the change
export default function PhoneChangeModal({
  newPhone,
  isUpdate,
  onSubmitOtp,
  onVerified,
  onWrongNumber,
  onResend,
  onClose,
}) {
  const [step, setStep] = useState("otp"); // "otp" | "success"
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const secondsLeft = useCountdown(OTP_VALIDITY_SECONDS, `${newPhone}-${resendCount}`);
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
          context: "Confirm phone",
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
        <SuccessBadge
          message={
            isUpdate ? "Your Phone Number Has Been Updated!" : "Your Phone Number Has Been Added!"
          }
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <h1 className="text-headline text-gray-900 mb-3">Enter the Code we Sent</h1>
      <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code that was sent to</p>
      <p className="text-sm font-semibold text-gray-900 mb-2">{maskPhone(newPhone)}</p>
      <button
        onClick={onWrongNumber}
        className="text-sm font-medium hover:underline text-brand-link"
      >
        Wrong number?
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
          onChange={(next) => {
            setOtp(next);
            setError("");
          }}
          length={6}
          autoFocus
          className="-mx-2"
          renderBoxes={renderDashedOtpBoxes}
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
