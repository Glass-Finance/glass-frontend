import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { getEmailError } from "../../../utils/validators";
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton";
import { SignUpTextInput, SignUpFieldError } from "./SignUpTextInput";
import { Button, Button as PrimaryBtn } from "../../../components/ui/Button";

// Desktop (md+) follows Figma "MacBook Pro 14" - 125" (Sign Up): "or" in
// the 18px Subtitle style, 24px above and below. Phones keep the small divider.
const Divider = () => (
  <div className="flex items-center gap-3 my-5 md:gap-[10px] md:my-6">
    <div className="flex-1 h-px bg-gray-300" />
    <span className="text-xs text-gray-400 md:text-[18px] md:leading-[22px] md:tracking-[0.5px] md:text-black/60">
      or
    </span>
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
    // Desktop (md+) matches Figma "MacBook Pro 14" - 125": a 652px column
    // centred in the form sheet, Title/Large heading, Label/Large label,
    // 56px input, 64px Continue, 16px footer. Every desktop value is md:,
    // so the phone layout is untouched. md:ml-[22px]: Figma's form sheet
    // starts at x=816, ours where the 46% hero ends (~795), so the centred
    // column is nudged 11px right to land on the frame's x=946.
    <div className="w-full max-w-md flex flex-col md:max-w-[652px] md:ml-[22px] md:w-[calc(100%-22px)]">
      <div className="mb-3 md:mb-8">
        <h1 className="text-headline text-gray-900 mb-1.5 md:mb-0 md:text-[22px] md:leading-[28px] md:font-medium md:tracking-normal md:text-ink">
          Create Your Account
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col gap-1.5 md:gap-3">
          <label
            htmlFor="signup-email"
            className="text-label font-medium text-gray-700 md:text-base md:leading-6 md:text-ink"
          >
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
            className="md:py-[15px] md:placeholder:text-black/60"
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
          <span className="text-xs md:text-sm text-gray-700 md:text-black/60">
            I accept the{" "}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline text-brand md:font-normal"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline text-brand md:font-normal"
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        {/* Figma 125: 32px from the checkbox row and 32px to Continue. */}
        {error && <p className="text-sm my-4 text-danger md:mt-4 md:mb-0">{error}</p>}

        {/* Always enabled, per Figma: a disabled Primary renders at 60%
            opacity, which read as a washed-out blue. An empty email is
            caught on submit by getEmailError ("Email is required."). */}
        <PrimaryBtn
          type="submit"
          className="mt-2 md:mt-4 md:h-16 md:py-5 md:px-10 md:text-[16px]"
          size="sm"
        >
          Continue
        </PrimaryBtn>
      </form>

      <Divider />
      <GoogleAuthButton
        onAuthenticated={onGoogleAuth}
        label="signup_with"
        size="lg"
        desktopText="Sign Up With Google"
      />

      <p className="text-center text-sm mt-5 text-gray-500 md:mt-6 md:text-base md:text-black/60 md:tracking-[0.5px]">
        Already Have An Account?{" "}
        {/* Tertiary renders muted ink by default (design-system §2.1); Figma
            draws this one in brand blue. `!` because two text-colour
            utilities on one element have no guaranteed cascade order. */}
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={onSwitch}
          className="text-brand! md:h-auto md:px-0 md:py-0 md:text-[16px] md:tracking-[0.5px]"
        >
          Sign In
        </Button>
      </p>
    </div>
  );
}
