import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useInviteToken } from "../../../../hooks/useInviteToken";
import { getEmailError } from "../../../../utils/validators";
import { requestEmailOtp, isEmailAlreadyRegisteredError } from "../../../../services/authService";
import { notifyError, getRetryAfterSeconds } from "../../../../utils/errorHandler";
import GoogleAuthButton from "../../../../components/auth/GoogleAuthButton";
import { Button as PrimaryButton } from "../../../../components/ui/Button";
import { TextInput } from "../../../../components/ui/TextInput";
import { Label, ErrorMessage } from "./shared";

// ---------------------------------------------------------------------------
// Step 1 — Contact (email only)
//
// The verification CODE is sent from here, before the account exists: POST
// /auth/email/request-otp only proves control of the address, and register()
// later consumes the confirmToken that comes back from
// /auth/email/verify-otp. The backend requires that order — register()
// answers 400 "Email must be verified" without the token — so the account
// cannot be created first any more.
//
// The send happens on THIS screen, not on the code screen, for the same
// reason the phone code is sent from the form that owns the number: a refused
// send (an address that is already registered, a rate limit) has to surface
// here, where the person can still fix it, instead of on a screen they have
// already been navigated away to.
//
// Phone is still not collected here -- it's optional at registration
// (Meta/WhatsApp verification isn't fully wired up backend-side yet) and is
// instead added later via Settings/Profile's "Add Your Phone Number" flow.
// Join()'s STEPS.PHONE_OTP branch and register()'s payload already treat an
// empty phone as the normal case.
// ---------------------------------------------------------------------------
export default function StepContact({ initialEmail, onNext, onGoogleAuth, hasCommunity }) {
  const { hasToken } = useInviteToken();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "" });
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [sending, setSending] = useState(false);

  function handleFieldChange(setValue) {
    return (e) => {
      const value = e.target.value;
      setValue(value);
      setError("");
      setAccountExists(false);
      setFieldErrors((fe) => (fe.email ? { ...fe, email: getEmailError(value) } : fe));
    };
  }

  async function handleSubmit() {
    // Explicit over implicit per CEO direction: the button stays clickable
    // regardless of the checkbox, and tells you exactly why it didn't go
    // through instead of just sitting disabled with no explanation.
    if (!agreed) {
      setError("Please Accept Our Terms to Continue");
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailError = getEmailError(trimmedEmail);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }
    setError("");
    setSending(true);
    try {
      // The code is delivered by email; the response carries only its expiry.
      // Nothing here creates the account -- that is register()'s job, once
      // the code has been read back.
      await requestEmailOtp({ email: trimmedEmail });
      onNext({ email: trimmedEmail, phone: "" });
    } catch (err) {
      // The duplicate-email rejection now lands HERE, not on the profile
      // form: /auth/email/request-otp refuses a verified account before any
      // code is sent. Registering them again isn't the right path — they need
      // to sign in, and their invite is waiting under that email.
      if (isEmailAlreadyRegisteredError(err)) {
        setAccountExists(true);
        setError("");
        return;
      }
      // A refused send is the difference between "check your inbox" and
      // "nothing was ever dispatched", so it is both toasted and shown here.
      // A 429 is the API's own limiter answering: wait exactly as long as it
      // asked (Retry-After), not a guess.
      const message = notifyError(err, {
        context: "Send verification code",
        fallback: "We couldn't send a code to that address. Please try again.",
      });
      const retryAfter = getRetryAfterSeconds(err);
      setError(retryAfter ? `${message} Try again in ${retryAfter}s.` : message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col md:mt-14 gap-3">
      <div>
        <h1 className="text-headline text-gray-900">
          {hasToken ? "You've Been Invited" : "Create Your Account"}
        </h1>
        {hasToken ? (
          <p className="text-sm text-gray-500 mt-1">Complete your profile to accept the invite.</p>
        ) : !hasCommunity ? (
          // Reached via the marketing site's contextless "Join A Community"
          // CTA, not a specific invite -- says up front that browsing comes
          // after account creation, not before, so the form doesn't read as
          // a bait-and-switch into full registration with no explanation.
          <p className="text-sm text-gray-500 mt-1">
            Create an account, then choose which communities to join.
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="email">Email Address</Label>
        <TextInput
          id="email"
          type="email"
          placeholder="Enter Your Email Address"
          value={email}
          onChange={handleFieldChange(setEmail)}
          autoComplete="email"
          inputMode="email"
        />
        <ErrorMessage message={fieldErrors.email} />
      </div>

      <div className="my-4">
        <label className="flex items-start gap-2 cursor-pointer select-none">
          {/* appearance-none takes over rendering entirely -- the browser's
              native checkbox is filled white by the OS/browser UA style
              regardless of our own bg classes, which is why removing
              bg-white alone never changed anything. Checkmark is drawn by
              hand since appearance-none also kills the native tick. */}
          <span className="relative mt-0.5 w-4 h-4 flex-shrink-0">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setError("");
              }}
              className="appearance-none w-4 h-4 rounded-sm border border-outline-input/40 checked:bg-brand-deep checked:border-brand-deep cursor-pointer"
            />
            {agreed && (
              <Check
                size={12}
                strokeWidth={3}
                className="absolute inset-0 m-auto text-white pointer-events-none"
              />
            )}
          </span>
          <span className="text-xs md:text-sm text-gray-700">
            I accept the{" "}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline text-brand-deep"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline text-brand-deep"
            >
              Privacy Policy
            </Link>
          </span>
        </label>
      </div>

      {accountExists && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-700 leading-relaxed">
            You already have a Glass account with this email. Sign in and your invite will be
            waiting for you.
          </p>
          <Link
            to="/member/app-sign-in?return=/member/invites"
            className="inline-block mt-2 text-xs font-semibold text-brand-deep"
          >
            Sign in to accept the invite
          </Link>
        </div>
      )}

      <ErrorMessage message={error} />

      <PrimaryButton onClick={handleSubmit} disabled={!email.trim()} loading={sending} size="md">
        {sending ? "Sending Code..." : "Continue"}
      </PrimaryButton>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-300" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-300" />
      </div>

      <GoogleAuthButton onAuthenticated={onGoogleAuth} label="signup_with" />

      <p className="text-sm text-center text-gray-500 pb-2">
        Already Have An Account?{" "}
        <Link to="/member/app-sign-in" className="font-semibold text-brand-deep">
          Sign In
        </Link>
      </p>
    </div>
  );
}
