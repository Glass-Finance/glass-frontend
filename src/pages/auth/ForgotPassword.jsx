import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import { notifyError } from "../../utils/errorHandler";
import { getEmailError } from "../../utils/validators";
import AuthLayout from "../../layouts/AuthLayout";
import { Label, TextInput, PrimaryButton, ErrorMessage } from "../../components/auth/FormFields";
import { useCountdown, formatCountdown } from "../../hooks/useCountdown";
import OtpBoxes from "../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../components/common/renderDashedOtpBoxes";

// Codes are valid for 15 minutes (see the same figure quoted to users in
// SignIn.jsx and member/Join.jsx).
const OTP_VALIDITY_SECONDS = 15 * 60;

export default function ForgotPassword() {
  usePageTitle("Reset your password");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState("email"); // "email" | "otp"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const secondsLeft = useCountdown(OTP_VALIDITY_SECONDS, `${email}-${resendCount}`);
  const codeExpired = step === "otp" && secondsLeft <= 0;

  async function handleSendEmail() {
    const nextEmailError = getEmailError(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setStep("otp");
    } catch (err) {
      setError(notifyError(err, { context: "Forgot password" }));
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(next) {
    setOtp(next);
    setError("");
  }

  function handleVerify() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    // Hand the reset credentials over in sessionStorage instead of the URL.
    // A token in a query string leaks through browser history, the Referer
    // header on any outbound request, and every proxy/server access log on the
    // path between here and /reset-password. sessionStorage is tab-scoped and
    // cleared when the tab closes, which is the right lifetime for a secret
    // that is only valid for the next few minutes. ResetPassword reads and
    // consumes it.
    sessionStorage.setItem(
      "glass_reset_otp",
      JSON.stringify({ email: email.trim().toLowerCase(), token: code }),
    );
    navigate("/reset-password");
  }

  async function handleResend() {
    setLoading(true);
    setError("");
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setOtp(["", "", "", "", "", ""]);
      // Also remounts OtpBoxes (keyed on resendCount below), so autoFocus
      // re-fires and refocuses the field for the freshly-sent code.
      setResendCount((c) => c + 1);
    } catch (err) {
      setError(notifyError(err, { context: "Resend code" }));
    } finally {
      setLoading(false);
    }
  }

  const otpComplete = otp.every((d) => d !== "");

  return (
    <AuthLayout heroHeadline="Manage Your Community Finance Effortlessly">
      <div
        className={`w-full ${step === "otp" ? "max-w-lg gap-12" : "max-w-md gap-6"} flex flex-col md:mt-14 mb-auto`}
      >
        {step === "email" ? (
          <>
            <div>
              <h1 className="text-headline text-gray-900 mb-1">Reset Password</h1>
              <p className="text-sm text-gray-500">
                Enter your email and we'll send you a code to reset it.
              </p>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <TextInput
                id="email"
                type="email"
                placeholder="e.g Bax**re@gmail.com"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  setError("");
                  setEmailError((prev) => (prev ? getEmailError(value) : prev));
                }}
                onBlur={(e) => setEmailError(getEmailError(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
                autoComplete="email"
                inputMode="email"
                disabled={loading}
                error={emailError}
              />
              <ErrorMessage message={emailError || error} />
            </div>

            <PrimaryButton onClick={handleSendEmail} loading={loading} disabled={!email.trim()}>
              {loading ? "Sending…" : "Send Reset Code"}
            </PrimaryButton>

            <p className="text-sm text-center text-gray-500 pb-2">
              Remember your password?{" "}
              <Link to="/sign-in" className="font-semibold text-brand-navy">
                Sign In
              </Link>
            </p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-headline text-gray-900 mb-1">Enter Reset Code</h1>
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <span className="font-medium text-gray-800">{email}</span>
                .
              </p>
              <p
                className={`text-xs mt-1 ${codeExpired ? "text-danger font-medium" : "text-gray-400"}`}
              >
                {codeExpired
                  ? "Your code has expired — request a new one below."
                  : `Code expires in ${formatCountdown(secondsLeft)}`}
              </p>
            </div>

            {/* Wrapping in a real <form> matches WebKit's own documented
                pattern for autocomplete="one-time-code" and gets the
                iOS keyboard's Return/Go key to submit for free. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (otpComplete) handleVerify();
              }}
              className="flex flex-col gap-6"
            >
              <div>
                <Label>Verification Code</Label>
                <div className="mt-1.5">
                  <OtpBoxes
                    key={resendCount}
                    value={otp}
                    onChange={handleOtpChange}
                    length={6}
                    autoFocus
                    renderBoxes={renderDashedOtpBoxes}
                  />
                </div>
                <ErrorMessage message={error} />
              </div>

              <PrimaryButton
                onClick={handleVerify}
                disabled={!otpComplete || loading || codeExpired}
              >
                Verify Code
              </PrimaryButton>
            </form>

            {/* Deliberately outside the <form>: a bare <button> with no
                explicit type defaults to type="submit" inside a form, which
                would have triggered the form's onSubmit (and double-fired
                handleVerify) on click. */}
            <div className="flex flex-col items-center gap-1 text-sm text-gray-500 pb-2">
              <p>
                Didn't receive it?{" "}
                <Button
                  variant="tertiary"
                  size="xs"
                  fullWidth={false}
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Resend code"}
                </Button>
              </p>
              <Button
                variant="tertiary"
                size="xs"
                fullWidth={false}
                onClick={() => {
                  setStep("email");
                  setError("");
                  setOtp(["", "", "", "", "", ""]);
                }}
                className="mt-1"
              >
                ← Change email address
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
