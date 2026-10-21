import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { getEmailError } from "../../../utils/validators";
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton";
import { SignUpTextInput, SignUpFieldError } from "./SignUpTextInput";
import { Button, Button as PrimaryBtn } from "../../../components/ui/Button";

const Divider = () => (
  <div className="flex items-center gap-3 my-5">
    <div className="flex-1 h-px bg-gray-300" />
    <span className="text-xs text-gray-400">or</span>
    <div className="flex-1 h-px bg-gray-300" />
  </div>
);

// ── Step 1: Email ───────────────────────────────────────────────────────────
// Phone is collected later, post-registration (Settings/Profile's "Add
// Your Phone Number" flow) -- not here. It's optional at registration per
// the backend (Meta/WhatsApp verification isn't fully wired up yet), and
// collecting it upfront meant sending a phone OTP and an email OTP as two
// separate verification steps in the same signup session. Email/phone are
// just handed up to SignUp/index.jsx's local state and combined with
// CompleteProfileStep's fields into the same single register() call the old
// one-screen form used to make; SignUp.jsx's routing and RegisterStep.jsx's
// payload already treat an empty phone as the normal case.
export default function EmailPhoneStep({ initialEmail, onNext, onSwitch, onGoogleAuth }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "" });
  const [error, setError] = useState("");

  function handleFieldChange(setValue) {
    return (e) => {
      const value = e.target.value;
      setValue(value);
      setFieldErrors((fe) => (fe.email ? { ...fe, email: getEmailError(value) } : fe));
    };
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    // Explicit over implicit per CEO direction: the button stays clickable
    // regardless of the checkbox, and tells you exactly why it didn't go
    // through instead of just sitting disabled with no explanation.
    if (!agreed) {
      setError("Please Accept Our Terms to Continue");
      return;
    }
    const emailError = getEmailError(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }
    onNext({ email: email.trim().toLowerCase(), phone: "" });
  };

  return (
    <div className="w-full max-w-md flex flex-col md:mt-14">
      <div className="mb-3">
        <h1 className="text-headline text-gray-900 mb-1.5">Create Your Account</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-email" className="text-label font-medium text-gray-700">
            Email Address
          </label>
          <SignUpTextInput
            id="signup-email"
            type="email"
            value={email}
            onChange={handleFieldChange(setEmail)}
            placeholder="Enter Your Email Address"
            required
            error={fieldErrors.email}
          />
          <SignUpFieldError message={fieldErrors.email} />
        </div>

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
              className="appearance-none w-4 h-4 rounded-sm border border-outline-input/40 checked:bg-brand checked:border-brand cursor-pointer"
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
              className="font-medium underline text-brand"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline text-brand"
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        {error && <p className="text-sm text-danger -mt-1">{error}</p>}

        <PrimaryBtn type="submit" className="mt-2" disabled={!email.trim()} size="sm">
          Continue
        </PrimaryBtn>
      </form>

      <Divider />
      <GoogleAuthButton onAuthenticated={onGoogleAuth} label="signup_with" />

      <p className="text-center text-sm mt-5 text-gray-500">
        Already Have An Account?{" "}
        <Button variant="tertiary" size="sm" fullWidth={false} onClick={onSwitch}>
          Sign In
        </Button>
      </p>
    </div>
  );
}
