import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import { ShieldCheck } from "lucide-react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import OtpBoxes from "../../../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../../../components/common/renderDashedOtpBoxes";
import { useMe, useRequestPhoneUpdate, useUpdatePhone } from "../../../../hooks/useMyAccount";
import { useAuth } from "../../../../store/AuthContext";
import { useCountdown, formatCountdown } from "../../../../hooks/useCountdown";
import { notifyError, getErrorMessage } from "../../../../utils/errorHandler";
import { isPhoneValid, PHONE_FORMAT_HINT } from "../../../../utils/phone";
import { Button } from "../../../../components/ui/Button";
import { TextInput } from "../../../../components/ui/TextInput";
import SuccessBadge from "../../../../components/common/SuccessBadge";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

// Masks a phone number for display, keeping the last 4 digits visible, e.g.
// "2348012345678" -> "*********5678".
function maskPhone(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

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

// One flow, two modes -- same OTP mechanics either way, per AQ's call
// ("same flow" for updating as for the first add). Which mode
// shows is decided entirely by user.phoneVerified, not by which entry
// point (Home banner vs. Profile's pencil icon) was used to get here: an
// unverified number is always "Add" copy (phone is optional at signup and
// collected later in Settings), a verified one is always "Update" copy,
// regardless of where the tap came from.
export default function VerifyPhone() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { refreshUser } = useAuth();
  const requestPhoneUpdate = useRequestPhoneUpdate();
  const updatePhone = useUpdatePhone();

  const isUpdate = Boolean(user?.phoneVerified);

  const [step, setStep] = useState("form"); // "form" | "otp" | "success"
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [fieldError, setFieldError] = useState("");
  const [sending, setSending] = useState(false);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCount, setResendCount] = useState(0);

  const secondsLeft = useCountdown(15 * 60, `${phone}-${resendCount}`);
  const codeExpired = secondsLeft <= 0;

  async function handleSubmitNumber() {
    const trimmed = phone.trim();
    if (!isPhoneValid(trimmed)) {
      setFieldError(PHONE_FORMAT_HINT);
      return;
    }
    if (isUpdate && trimmed === user?.phoneNumber) {
      setFieldError("That's already your current phone number.");
      return;
    }
    setFieldError("");
    setSending(true);
    try {
      await requestPhoneUpdate.mutateAsync({ phoneNumber: trimmed });
      setStep("otp");
    } catch (err) {
      setFieldError(getErrorMessage(err, "Couldn't send a code to that number. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError("");
    setVerifying(true);
    try {
      await updatePhone.mutateAsync({
        phoneNumber: phone.trim(),
        phoneVerificationOtp: otp.join(""),
      });
      await refreshUser();
      setStep("success");
      setTimeout(() => goBackInApp(navigate, "/member/profile"), 1800);
    } catch (err) {
      setOtpError(
        notifyError(err, {
          context: "Add phone",
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
      await requestPhoneUpdate.mutateAsync({ phoneNumber: phone.trim() });
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
        <SuccessBadge
          message={
            isUpdate ? "Your Phone Number Has Been Updated!" : "Your Phone Number Has Been Added!"
          }
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />

      {step === "form" && (
        <>
          <StepHeader
            title={isUpdate ? "Update Your Phone Number" : "Add Your Phone Number"}
            onBack={() => goBackInApp(navigate, "/member/profile")}
          />
          <div className="px-4">
            <div className="border border-surface-container-border bg-white rounded-2xl p-4">
              <label className="text-xs text-ink-ghost block mb-1.5">Phone Number</label>
              <TextInput
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFieldError("");
                }}
                autoFocus
                error={fieldError}
              />
              {fieldError && <p className="text-xs text-danger mt-1.5 mx-1 mb-0">{fieldError}</p>}
            </div>

            {!isUpdate && (
              <div className="flex items-start gap-2.5 mt-3.5 px-4 py-3.5 rounded-xl bg-brand-mist">
                <ShieldCheck size={18} className="text-brand flex-shrink-0 mt-0.5" />
                <p className="text-sm text-brand leading-snug m-0">
                  Your number is only used for payment reminders and account recovery. We will never
                  share it.
                </p>
              </div>
            )}

            <Button onClick={handleSubmitNumber} loading={sending} className="mt-5">
              {sending ? "Sending Code…" : isUpdate ? "Update Phone Number" : "Add Phone Number"}
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
            <p className="text-sm font-semibold text-gray-900 mb-3">{maskPhone(phone)}</p>
            <Button variant="tertiary" size="sm" fullWidth={false} onClick={() => setStep("form")}>
              Wrong Number?
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
