import { useState } from "react";
import { requestPhoneOtp, verifyPhoneOtp } from "../../../services/authService";
import { notifyError } from "../../../utils/errorHandler";
import { useCountdown, formatCountdown } from "../../../hooks/useCountdown";
import { useOtpSend } from "../../../hooks/useOtpSend";
import OtpBoxes from "../../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../../components/common/renderDashedOtpBoxes";
import { Button } from "../../../components/ui/Button";

// Codes are valid for 15 minutes (see the same figure quoted in OTPStep.jsx).
const OTP_VALIDITY_SECONDS = 15 * 60;

// Registration-time phone verification -- distinct from PhoneChangeModal
// (which confirms an already-signed-in user's number change). The OTP send
// itself happens one level up, before this step is ever reached (either
// EmailPhoneStep's initial submit or PhoneOnlyStep's "wrong number"
// correction) -- both of those need to see a duplicate/rejected number
// error inline on their own form, so the send can't happen here on mount
// after the user's already been navigated to this screen. This step only
// verifies via POST /auth/phone/verify-otp, which returns the confirmToken
// register() needs.
//
// A RESEND is this screen's to make (POST /auth/phone/request-otp), so its
// result is reported honestly: a failed resend is toasted and shown here, and
// a rate-limited one waits exactly as long as the server asked.
export default function PhoneOTPStep({ phone, onVerified, onBack }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const {
    sending: resending,
    sent: resendSent,
    failed: resendFailed,
    error: sendError,
    cooldownSeconds,
    send: resend,
  } = useOtpSend({
    sendRequest: () => requestPhoneOtp({ phoneNumber: phone }),
    onSent: () => {
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
    },
    context: "Resend phone OTP",
    fallback: "We couldn't send a new code. Please try again.",
  });

  const secondsLeft = useCountdown(OTP_VALIDITY_SECONDS, `${phone}-${resendCount}`);
  const codeExpired = secondsLeft <= 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await verifyPhoneOtp({ phoneNumber: phone, otp: otp.join("") });
      onVerified(result.confirmToken);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Verify phone OTP",
          fallback: "Invalid or expired code. Please try again.",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col md:mt-14 mb-auto gap-12">
      <div>
        <h1 className="text-headline text-gray-900 mb-3 font-sans">Check Your Phone</h1>
        <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code that was sent to</p>
        <p className="text-sm font-semibold text-gray-900">{phone}</p>
        <Button variant="tertiary" size="sm" fullWidth={false} onClick={onBack} className="mt-1">
          Wrong number?
        </Button>
        <p className={`text-xs mt-2 ${codeExpired ? "text-danger font-medium" : "text-ink-faint"}`}>
          {codeExpired
            ? "Your code has expired — request a new one below."
            : `Code expires in ${formatCountdown(secondsLeft)}`}
        </p>
      </div>

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
          renderBoxes={renderDashedOtpBoxes}
        />

        {error && <p className="text-sm text-danger text-center -mt-2">{error}</p>}

        <Button type="submit" disabled={codeExpired || otp.some((d) => !d)} loading={loading}>
          {loading ? "Verifying..." : "Continue"}
        </Button>
      </form>

      <div>
        <p className="text-center text-sm text-gray-text">
          Didn't get OTP?{" "}
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={resend}
            disabled={resending || cooldownSeconds > 0}
          >
            {resending
              ? "Resending..."
              : cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : "Resend"}
          </Button>
        </p>
        {resendSent && (
          <p className="text-center text-xs text-gray-400 mt-1" role="status">
            A new code has been sent.
          </p>
        )}
        {resendFailed && (
          <div className="bg-warning-wash text-warning rounded-xl px-4 py-3 mt-2">
            <p className="text-xs leading-relaxed">
              <span className="font-semibold">We couldn't send a new code.</span> {sendError}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
