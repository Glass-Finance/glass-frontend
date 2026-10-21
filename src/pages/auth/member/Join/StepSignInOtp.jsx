import { useState } from "react";
import { requestLoginOtp, verifyLoginOtp } from "../../../../services/authService";
import { notifyError } from "../../../../utils/errorHandler";
import OtpBoxes from "../../../../components/common/OtpBoxes";
import { useCountdown, formatCountdown } from "../../../../hooks/useCountdown";
import { useOtpSend } from "../../../../hooks/useOtpSend";
import { Button, Button as PrimaryButton } from "../../../../components/ui/Button";
import { ErrorMessage } from "./shared";
import { renderDashedOtpBoxes } from "./otpBoxes";
import { OTP_LENGTH } from "./constants";

// ---------------------------------------------------------------------------
// Step — Sign in via code. Not part of the linear CONTACT -> PHONE_OTP ->
// PROFILE -> OTP flow above -- entered directly (see Join()'s initial step
// selection) when arriving via CheckEmail.jsx's QR (?email=, no invite
// token). That person already has a full, verified account from SignUp.jsx's
// own register+OTP a moment earlier, just no client-side session yet.
// Routing them through registration again would only earn a 409 after
// they've already typed a name and password for nothing (see StepProfile's
// accountExists handling), passwordless login OTP, the same
// requestLoginOtp/verifyLoginOtp SignIn.jsx already uses, signs them in
// directly instead.
//
// This is the one OTP screen where the FRONTEND owns the send (it fires
// POST /auth/otp/request on mount), so it is also the one screen that can
// know a code was never dispatched. useOtpSend keeps that state honest: the
// heading says "sending" while the request is in flight, says so plainly when
// it failed, and never claims a code is on its way when none was sent.
// ---------------------------------------------------------------------------
export default function StepSignInOtp({ email, onVerified, onUseDifferentEmail }) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [otpAttempt, setOtpAttempt] = useState(0);

  const {
    sending,
    failed,
    everSent,
    error: sendError,
    cooldownSeconds,
    send,
  } = useOtpSend({
    sendRequest: () => requestLoginOtp({ email }),
    onSent: (result) => {
      const seconds = Math.max(0, Math.round((new Date(result.expiresAt) - Date.now()) / 1000));
      setExpirySeconds(seconds);
      setResendCount((c) => c + 1);
      setDigits(Array(OTP_LENGTH).fill(""));
      setOtpAttempt((a) => a + 1);
    },
    context: "Send login code",
    fallback: "We couldn't send a code to that address. Please try again.",
    autoSend: true,
    // The resend action starts locked: a code cannot plausibly have failed
    // to arrive in the first few seconds, and the API's limiter is per-IP.
    initialCooldown: 30,
  });

  const secondsLeft = useCountdown(expirySeconds, `${email}-${resendCount}`);
  // Guarded on resendCount so this doesn't read as "expired" before the
  // very first send (expirySeconds/secondsLeft both start at 0).
  const codeExpired = resendCount > 0 && secondsLeft <= 0;

  function handleDigitChange(next) {
    setDigits(next);
    setError("");
  }

  async function handleVerify() {
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyLoginOtp({ email, token: code });
      if (result?.mfaRequired) {
        // This step's only audience is a brand-new account (see the
        // component comment above), which can't have MFA configured yet in
        // practice -- a defensive message instead of a built-out challenge
        // screen, pointing at the one place that already handles it.
        setError(
          "This account has extra security enabled. Please use the full sign-in page to continue.",
        );
        return;
      }
      onVerified(result);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Verify login code",
          fallback: "That code didn't work. Please try again.",
          silent: true,
        }),
      );
      setDigits(Array(OTP_LENGTH).fill(""));
      setOtpAttempt((a) => a + 1);
    } finally {
      setLoading(false);
    }
  }

  const allFilled = digits.every(Boolean);
  // A failed RESEND after a code already went out means "the new one didn't
  // arrive" -- not "no code was ever sent". The screen must not contradict
  // the code the person may already be holding.
  const noCodeSent = failed && !everSent;
  const sendLabel = noCodeSent ? "Send code" : "Resend";

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="text-headline text-gray-900 mb-5">You Already Have An Account</h1>
        <p className="text-sm text-gray-500 mb-1">
          {sending
            ? "Sending a sign-in code to"
            : noCodeSent
              ? "We couldn't send a code to"
              : "Enter the 6-digit code sent to"}
        </p>
        <p className="font-semibold text-sm text-gray-900 mb-1">{email}</p>
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={onUseDifferentEmail}
          className="mt-1"
        >
          Not you?
        </Button>
        {failed && (
          <div className="bg-warning-wash text-warning rounded-xl px-4 py-3 mt-3">
            <p className="text-xs leading-relaxed">
              <span className="font-semibold">
                {noCodeSent ? "No code was sent." : "We couldn't send a new code."}
              </span>{" "}
              {sendError}
            </p>
          </div>
        )}
        {resendCount > 0 && (
          <p
            className={`text-xs mt-2 ${codeExpired ? "text-danger font-medium" : "text-ink-faint"}`}
          >
            {codeExpired
              ? "Your code has expired — request a new one below."
              : `Code expires in ${formatCountdown(secondsLeft)}`}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (allFilled && !codeExpired && !sending) handleVerify();
        }}
        className="flex flex-col gap-6"
      >
        <OtpBoxes
          key={otpAttempt}
          value={digits}
          onChange={handleDigitChange}
          length={OTP_LENGTH}
          autoFocus
          renderBoxes={renderDashedOtpBoxes}
        />

        <ErrorMessage message={error} />

        <PrimaryButton
          onClick={handleVerify}
          loading={loading}
          disabled={!allFilled || codeExpired || sending}
        >
          {loading ? "Verifying..." : "Continue"}
        </PrimaryButton>
      </form>

      <p className="text-sm text-center text-gray-500 pb-2">
        {noCodeSent ? "Nothing was sent." : "Didn't get a code?"}{" "}
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={send}
          disabled={cooldownSeconds > 0 || sending}
        >
          {cooldownSeconds > 0 ? `${sendLabel} in ${cooldownSeconds}s` : sendLabel}
        </Button>
      </p>
    </div>
  );
}
