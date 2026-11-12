import { useEffect, useState } from "react";
import { usePageTitle } from "../../../hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../../../layouts/AuthLayout";
import EmailPhoneStep from "./EmailPhoneStep";
import PhoneOTPStep from "./PhoneOTPStep";
import PhoneOnlyStep from "./PhoneOnlyStep";
import RegisterStep from "./RegisterStep";
import OTPStep from "./OTPStep";
import EmailVerified from "./EmailVerified";
import { useAuth } from "../../../store/AuthContext";

// Steps: 1 email -> 2 name+password (register()) -> 3 email OTP. Phone is
// no longer collected here -- it's optional at registration (Meta/WhatsApp
// verification isn't fully wired up backend-side yet) and is instead added
// later via Settings/Profile's "Add Your Phone Number" flow. Steps 1.5
// (phone OTP) and 1.6 (its "wrong number" correction screen) are dead code
// paths for now, kept in case phone-at-signup comes back once that's fixed.
// ── Main Component ────────────────────────────────────────────────────────────
// SuccessBadge finishes fading its message in at ~2.2s (badge pop, check,
// accents, then text), so the page holds a little past that to be read.
const VERIFIED_HOLD_MS = 2500;

export default function SignUp() {
  usePageTitle("Create your account");
  const navigate = useNavigate();
  const { storeSessionIfPresent } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirmToken, setPhoneConfirmToken] = useState("");

  const handleEmailPhone = ({ email: submittedEmail, phone: submittedPhone }) => {
    setEmail(submittedEmail);
    setPhone(submittedPhone);
    // Phone is optional at registration -- skip straight to the register
    // step when it's empty, same as the phone-verification spec requires
    // (phoneConfirmToken is only meaningful when a number was provided).
    setStep(submittedPhone ? 1.5 : 2);
  };

  const handlePhoneVerified = (confirmToken) => {
    setPhoneConfirmToken(confirmToken);
    setStep(2);
  };

  const handleRegistered = async (registeredEmail, authData) => {
    // Awaited: some backends issue a session immediately on register, others
    // only after email verification — either way, settle it before advancing
    // so the next step never renders on pre-session state.
    await storeSessionIfPresent(authData);
    setEmail(registeredEmail);
    setStep(3);
  };

  // Figma shows "Your Email Has Been Verified!" between the code step and
  // onboarding, so the confirmation holds for a moment before moving on.
  const [verified, setVerified] = useState(false);
  const handleVerified = async (authData) => {
    await storeSessionIfPresent(authData);
    setVerified(true);
  };
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(
      () => navigate("/onboarding/choose-path", { state: { email } }),
      VERIFIED_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [verified, navigate, email]);

  // Google already proves the user owns this email, so there's no OTP step
  // to go through — skip straight to onboarding.
  const handleGoogleAuth = (user) => {
    navigate("/onboarding/choose-path", { state: { email: user?.email ?? email } });
  };

  if (verified) return <EmailVerified />;

  return (
    <AuthLayout heroHeadline="Manage Your Community Finance Effortlessly">
      {step === 1 && (
        <EmailPhoneStep
          initialEmail={email}
          onNext={handleEmailPhone}
          onSwitch={() => navigate("/sign-in")}
          onGoogleAuth={handleGoogleAuth}
        />
      )}
      {step === 1.5 && (
        <PhoneOTPStep phone={phone} onVerified={handlePhoneVerified} onBack={() => setStep(1.6)} />
      )}
      {step === 1.6 && (
        <PhoneOnlyStep
          initialPhone={phone}
          onNext={(newPhone) => {
            setPhone(newPhone);
            setStep(1.5);
          }}
          onCancel={() => setStep(1.5)}
        />
      )}
      {step === 2 && (
        <RegisterStep
          email={email}
          phone={phone}
          phoneConfirmToken={phoneConfirmToken}
          onNext={handleRegistered}
          onSwitch={() => navigate("/sign-in")}
        />
      )}
      {step === 3 && (
        <OTPStep email={email} onVerified={handleVerified} onBack={() => setStep(1)} />
      )}
    </AuthLayout>
  );
}
