import { useState } from "react";
import { verifyEmail, resendVerification } from "../../../services/authService";
import { notifyError } from "../../../utils/errorHandler";
import { useCountdown, formatCountdown } from "../../../hooks/useCountdown";
import { useOtpSend } from "../../../hooks/useOtpSend";
import OtpBoxes from "../../../components/common/OtpBoxes";
import { Button } from "../../../components/ui/Button";

// Codes are valid for 15 minutes (see the same figure quoted to users in
// SignIn.jsx and member/Join.jsx).
const OTP_VALIDITY_SECONDS = 15 * 60;

// ── Step 2: OTP Verification ───────────────────────────────────────────────────
//
// The FIRST code is not sent from here: POST /auth/register dispatches it
// server-side, and the account doesn't exist until it does — there is nothing
// to request a code for before that call returns. The frontend can't tell
// whether that first mail actually went out, which is why the heading says
// "Check Your Email" rather than asserting a code was sent.
//
// Resend IS the frontend's to make (POST /auth/verify/resend), so its result
// is reported honestly: a failed resend is toasted and shown here, and a
// rate-limited one waits exactly as long as the server asked.
export default function OTPStep({ email, onVerified, onBack }) {
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
    sendRequest: () => resendVerification({ email }),
    onSent: () => {
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
    },
    context: "Resend verification email",
    fallback: "We couldn't send a new code. Please try again.",
  });

  const secondsLeft = useCountdown(OTP_VALIDITY_SECONDS, `${email}-${resendCount}`);
  const codeExpired = secondsLeft <= 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await verifyEmail({ email, token: otp.join("") });
      onVerified(result);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Verify OTP",
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
        <h1 className="text-headline text-gray-900 mb-3 font-sans">Check Your Email</h1>
        <p className="text-sm text-gray-500 mb-0.5">Enter the 6-digit code that was sent to</p>
        <p className="text-sm font-semibold text-gray-900">{email}</p>
        <Button variant="tertiary" size="sm" fullWidth={false} onClick={onBack} className="mt-1">
          Wrong email?
        </Button>
        <p className={`text-xs mt-2 ${codeExpired ? "text-danger font-medium" : "text-ink-faint"}`}>
          {codeExpired
            ? "Your code has expired — request a new one below."
            : `Code expires in ${formatCountdown(secondsLeft)}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <OtpBoxes
          value={otp}
          onChange={(next) => {
            setOtp(next);
            setError("");
          }}
          length={6}
          autoFocus
          renderBoxes={(digits, activeIndex) => (
            <div className="flex items-center gap-4 justify-center pointer-events-none">
              {digits.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  className={`w-16 h-16 flex-shrink-0 flex items-center justify-center text-lg font-semibold text-gray-900 rounded-lg transition-all border-[1.5px] ${d || i === activeIndex ? "border-primary" : "border-hairline-disabled"}`}
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
                    className={`w-16 h-16 flex-shrink-0 flex items-center justify-center text-lg font-semibold text-gray-900 rounded-lg transition-all border-[1.5px] ${d || idx === activeIndex ? "border-primary" : "border-hairline-disabled"}`}
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
