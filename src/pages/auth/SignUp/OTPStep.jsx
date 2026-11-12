import { useState } from "react";
import { verifyEmail, resendVerification } from "../../../services/authService";
import { notifyError } from "../../../utils/errorHandler";
import { useCountdown, formatCountdown } from "../../../hooks/useCountdown";
import { useOtpSend } from "../../../hooks/useOtpSend";
import OtpBoxes from "../../../components/common/OtpBoxes";
import { renderWideDashedOtpBoxes } from "../../../components/common/renderDashedOtpBoxes";
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
    // Desktop (md+) follows Figma "Verification Code Sent" (node 252:16554):
    // a 711px column centred in the form sheet (nudged 11px right, as on the
    // email step), Title/Large heading, the code line in one 16px sentence,
    // full-width boxes, 64px Continue. Every desktop value is md:, so the
    // phone layout is untouched.
    <div className="w-full max-w-xl flex flex-col mb-auto gap-12 md:max-w-[711px] md:mb-0 md:ml-[22px] md:w-[calc(100%-22px)] md:gap-0">
      <div className="md:mb-8">
        {/* Two headings rather than spans in one, so each keeps an exact
            accessible name; only one is ever displayed. */}
        <h1 className="text-headline text-gray-900 mb-3 font-sans md:hidden">Check Your Email</h1>
        <h1 className="hidden md:block mb-10 text-[22px] leading-[28px] font-medium text-ink">
          Verification Code Sent
        </h1>
        <p className="text-sm text-gray-500 mb-0.5 md:inline md:text-base md:leading-6 md:text-black/60">
          Enter the 6-digit code that was sent to
        </p>{" "}
        <p className="text-sm font-semibold text-gray-900 md:inline md:text-base md:leading-6 md:font-normal md:text-ink">
          {email}
        </p>
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={onBack}
          className="mt-1 md:flex md:w-fit md:mt-3 md:h-auto md:px-0 md:py-0 md:text-[16px] md:leading-6 md:tracking-[0.016px] md:text-brand md:hover:bg-transparent"
        >
          Wrong email?
        </Button>
        <p
          className={`text-xs mt-2 md:text-sm md:mt-3 ${codeExpired ? "text-danger font-medium" : "text-ink-faint"}`}
        >
          {codeExpired
            ? "Your code has expired — request a new one below."
            : `Code expires in ${formatCountdown(secondsLeft)}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 md:gap-10">
        <OtpBoxes
          value={otp}
          onChange={(next) => {
            setOtp(next);
            setError("");
          }}
          length={6}
          autoFocus
          renderBoxes={renderWideDashedOtpBoxes}
        />

        {error && <p className="text-sm text-danger text-center -mt-2">{error}</p>}

        <Button
          type="submit"
          disabled={codeExpired || otp.some((d) => !d)}
          loading={loading}
          className="md:h-16 md:py-5 md:px-10"
        >
          {loading ? "Verifying..." : "Continue"}
        </Button>
      </form>

      <div className="md:mt-4">
        <p className="text-center text-sm text-gray-text md:text-base md:text-black/60 md:tracking-[0.5px]">
          Didn't get OTP?{" "}
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={resend}
            disabled={resending || cooldownSeconds > 0}
            className="md:h-auto md:px-0 md:py-0 md:text-[16px] md:leading-6 md:text-brand md:hover:bg-transparent"
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
