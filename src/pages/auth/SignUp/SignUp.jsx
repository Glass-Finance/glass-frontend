import { useEffect, useState } from "react";
import { usePageTitle } from "../../../hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../../../layouts/AuthLayout";
import EmailPhoneStep from "./EmailPhoneStep";
import EmailOTPStep from "./EmailOTPStep";
import PhoneOTPStep from "./PhoneOTPStep";
import PhoneOnlyStep from "./PhoneOnlyStep";
import RegisterStep from "./RegisterStep";
import EmailVerified from "./EmailVerified";
import { useAuth } from "../../../store/AuthContext";

// Steps: 1 email (code sent) -> 2 email code -> 3 name+password (register()).
// The order is the backend's, not a UI choice: it verifies the address
// BEFORE it creates the account, so the email code comes first and
// register() carries the resulting confirmToken. There is no activation
// step after register() any more — the account is already verified when it
// returns.
//
// Phone is no longer collected here -- it's optional at registration
// (Meta/WhatsApp verification isn't fully wired up backend-side yet) and is
// instead added later via Settings/Profile's "Add Your Phone Number" flow.
// Steps 3/4 (phone OTP and its "wrong number" correction screen) are dead
// code paths for now, kept in case phone-at-signup comes back once that's
// fixed.
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
  const [emailConfirmToken, setEmailConfirmToken] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirmToken, setPhoneConfirmToken] = useState("");

  const handleEmailPhone = ({ email: submittedEmail, phone: submittedPhone }) => {
    setEmail(submittedEmail);
    setPhone(submittedPhone);
    // The code has already been sent by EmailPhoneStep; the next step is
    // always the one that reads it back.
    setStep(2);
  };

  // The email code has been read back: the backend handed us the
  // single-use confirmToken that register() requires. It proves control of
  // the address; it is not a session.
  const handleEmailVerified = (confirmToken) => {
    setEmailConfirmToken(confirmToken);
    // Phone is optional at registration -- skip the phone steps when it's
    // empty, same as the phone-verification spec requires (phoneConfirmToken
    // is only meaningful when a number was provided).
    setStep(phone ? 3 : 5);
  };

  const handlePhoneVerified = (confirmToken) => {
    setPhoneConfirmToken(confirmToken);
    setStep(5);
  };

  const handleRegistered = async (registeredEmail, authData) => {
    // Awaited: register() returns the account's authentication, so the
    // session has to settle before we advance — otherwise the next screen
    // renders on pre-session state.
    await storeSessionIfPresent(authData);
    setEmail(registeredEmail);
    setVerified(true);
  };

  // Figma shows "Your Email Has Been Verified!" as the last beat before
  // onboarding, so the confirmation holds for a moment before moving on.
  // The address was verified on the code step; this screen closes the flow
  // once the account exists.
  const [verified, setVerified] = useState(false);
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
      {step === 2 && (
        <EmailOTPStep email={email} onVerified={handleEmailVerified} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <PhoneOTPStep phone={phone} onVerified={handlePhoneVerified} onBack={() => setStep(4)} />
      )}
      {step === 4 && (
        <PhoneOnlyStep
          initialPhone={phone}
          onNext={(newPhone) => {
            setPhone(newPhone);
            setStep(3);
          }}
          onCancel={() => setStep(3)}
        />
      )}
      {step === 5 && (
        <RegisterStep
          email={email}
          emailConfirmToken={emailConfirmToken}
          phone={phone}
          phoneConfirmToken={phoneConfirmToken}
          onNext={handleRegistered}
          onSwitch={() => navigate("/sign-in")}
        />
      )}
    </AuthLayout>
  );
}
