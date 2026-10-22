import { useState } from "react";
import { requestLoginOtp, verifyLoginOtp } from "../services/authService";
import { getEmailError } from "../utils/validators";
import { isPhoneValid, PHONE_FORMAT_HINT } from "../utils/phone";
import { notifyError, getErrorMessage, getRetryAfterSeconds } from "../utils/errorHandler";
import { useCountdown, formatCountdown } from "./useCountdown";

// Passwordless (OTP) sign-in state + handlers, as previously inline in
// SignIn.jsx. Bodies are unchanged; only the session-boundary effects are
// injected so the hook stays router/session independent:
//   onAuthAttempt()             — called at the top of handleVerifyOtp, BEFORE
//                                 the request, so the page can disarm its
//                                 pre-auth redirect effect. Not the same as
//                                 onAuthenticated: by the time the session
//                                 exists the guard is too late. Only the
//                                 verify path establishes a session, so
//                                 handleSendOtp/handleResendOtp don't call it.
//   onMfaRequired(mfaChallengeToken) — show the MFA challenge for the token
//   onAuthenticated(authData)        — establish the session and route onward
export function useOtpSignIn({ onAuthAttempt, onMfaRequired, onAuthenticated }) {
  const [otpStep, setOtpStep] = useState("request"); // "request" | "verify"
  const [otpChannel, setOtpChannel] = useState("email"); // "email" | "phone"
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpIdentifierError, setOtpIdentifierError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  // Seconds-left for the code itself, driven by the server's expiresAt (not
  // a hardcoded TTL) -- resendCount as the reset key restarts it on resend.
  const [otpInitialSeconds, setOtpInitialSeconds] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  // Separate cooldown for the resend button itself, driven by a 429's
  // Retry-After when one comes back -- 0 whenever there's no active cooldown.
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCooldownKey, setResendCooldownKey] = useState(0);
  const otpSecondsLeft = useCountdown(otpInitialSeconds, resendCount);
  const resendSecondsLeft = useCountdown(resendCooldown, resendCooldownKey);
  const otpCodeExpired = otpStep === "verify" && otpSecondsLeft <= 0;

  function getOtpIdentifier() {
    const identifier = otpIdentifier.trim();
    return otpChannel === "email"
      ? { email: identifier.toLowerCase() }
      : { phoneNumber: identifier };
  }

  async function handleSendOtp() {
    const identifierError =
      otpChannel === "email"
        ? getEmailError(otpIdentifier)
        : !otpIdentifier.trim()
          ? "Phone number is required."
          : isPhoneValid(otpIdentifier)
            ? ""
            : PHONE_FORMAT_HINT;
    if (identifierError) {
      setOtpIdentifierError(identifierError);
      return;
    }
    setOtpSending(true);
    setOtpIdentifierError("");
    try {
      const result = await requestLoginOtp(getOtpIdentifier());
      const seconds = Math.max(0, Math.round((new Date(result.expiresAt) - Date.now()) / 1000));
      setOtpInitialSeconds(seconds);
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
      setOtpStep("verify");
    } catch (err) {
      setOtpIdentifierError(notifyError(err, { context: "Send login code" }));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.some((d) => !d) || otpCodeExpired) return;
    onAuthAttempt();
    setOtpVerifying(true);
    setOtpError("");
    try {
      const result = await verifyLoginOtp({
        ...getOtpIdentifier(),
        token: otp.join(""),
      });
      if (result?.mfaRequired) {
        onMfaRequired(result.mfaChallengeToken);
        return;
      }
      await onAuthenticated(result);
    } catch (err) {
      setOtpError(
        notifyError(err, {
          context: "Verify login code",
          fallback: "Invalid or expired code.",
        }),
      );
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleResendOtp() {
    setOtpSending(true);
    setOtpError("");
    try {
      const result = await requestLoginOtp(getOtpIdentifier());
      const seconds = Math.max(0, Math.round((new Date(result.expiresAt) - Date.now()) / 1000));
      setOtpInitialSeconds(seconds);
      setResendCount((c) => c + 1);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      const retryAfter = getRetryAfterSeconds(err);
      if (retryAfter) {
        setResendCooldown(retryAfter);
        setResendCooldownKey((k) => k + 1);
        setOtpError(`Too many attempts — try again in ${formatCountdown(retryAfter)}.`);
      } else {
        setOtpError(getErrorMessage(err, "Couldn't resend. Please try again."));
      }
    } finally {
      setOtpSending(false);
    }
  }

  return {
    otpStep,
    setOtpStep,
    otpChannel,
    setOtpChannel,
    otpIdentifier,
    setOtpIdentifier,
    otpIdentifierError,
    setOtpIdentifierError,
    otpSending,
    otpVerifying,
    otpError,
    setOtpError,
    otp,
    setOtp,
    otpSecondsLeft,
    resendSecondsLeft,
    otpCodeExpired,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  };
}
