import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { register } from "../../../services/authService";
import { buildRegisterPayload } from "../../../services/authPayloads";
import { notifyError } from "../../../utils/errorHandler";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "../../../utils/password";
import PasswordChecklist from "../../../components/auth/PasswordChecklist";
import { SignUpTextInput, SignUpFieldError } from "./SignUpTextInput";
import { Button, Button as PrimaryBtn } from "../../../components/ui/Button";

// ── Step 2: Complete Profile (Name + Password) ────────────────────────────────
// Fires the single register() call with email/phone carried over from
// EmailPhoneStep plus the fields collected here -- same payload shape and
// same one-call-only backend contract the old single-screen form used.
function validateField(field, value, otherValue) {
  if (field === "firstName" && !value.trim()) return "First name is required.";
  if (field === "lastName" && !value.trim()) return "Last name is required.";
  if (field === "password" && !isPasswordValid(value)) {
    return `Must include: ${PASSWORD_REQUIREMENTS_TEXT.toLowerCase()}`;
  }
  if (field === "confirmPassword") {
    if (!value) return "Please confirm your password.";
    if (value !== otherValue) return "Passwords don't match.";
  }
  return "";
}

export default function RegisterStep({ email, phone, phoneConfirmToken, onNext, onSwitch }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => {
      const next = { ...fe };
      if (fe[name])
        next[name] = validateField(
          name,
          value,
          name === "password" ? form.confirmPassword : form.password,
        );
      // Editing password after confirmPassword was already checked needs
      // confirmPassword re-checked against the fresh value.
      if (name === "password" && fe.confirmPassword)
        next.confirmPassword = validateField("confirmPassword", form.confirmPassword, value);
      return next;
    });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldErrors((fe) => ({
      ...fe,
      [name]: validateField(
        name,
        value,
        name === "password" ? form.confirmPassword : form.password,
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const nextErrors = {
      firstName: validateField("firstName", form.firstName),
      lastName: validateField("lastName", form.lastName),
      password: validateField("password", form.password),
      confirmPassword: validateField("confirmPassword", form.confirmPassword, form.password),
    };
    if (Object.values(nextErrors).some(Boolean)) {
      setFieldErrors(nextErrors);
      return;
    }
    setLoading(true);
    try {
      const result = await register(
        buildRegisterPayload({
          firstName: form.firstName,
          lastName: form.lastName,
          email,
          password: form.password,
          // Phone stays optional at registration -- phoneConfirmToken is only
          // required (and only sent) when a number was actually verified in
          // the phone OTP step. Omitting phoneRegion: numbers collected here
          // are always entered in international format already (see
          // PHONE_FORMAT_HINT), so there's no separate region field to send.
          ...(phone && { phoneNumber: phone, phoneConfirmToken }),
        }),
      );
      onNext(email, result);
    } catch (err) {
      setError(notifyError(err, { context: "Register" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    // Desktop (md+) follows Figma "MacBook Pro 14" - 31" (Complete Your
    // Profile, right panel 252:16550): a 652px column centred in the form
    // sheet (nudged 11px right, as on the email step), Title/Large heading,
    // Label/Large labels, 56px inputs, 24px between rows, 64px button and the
    // "Already Have An Account?" footer. Every desktop value is md:, so the
    // phone layout is untouched. On laptop screens under 800px tall the
    // vertical gaps tighten (max-height variants) so the form -- with the
    // password checklist open -- still fits without scrolling.
    <div className="w-full max-w-md flex flex-col mb-auto md:max-w-[652px] md:mb-0 md:ml-[22px] md:w-[calc(100%-22px)]">
      <div className="mb-3 md:mb-10 md:[@media(max-height:800px)]:mb-5!">
        <h1 className="text-headline text-gray-900 mb-1.5 md:mb-0 md:text-[22px] md:leading-[28px] md:font-medium md:tracking-normal md:text-ink">
          Complete Your Profile
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-12 md:gap-6 md:[@media(max-height:800px)]:gap-4!"
      >
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <div className="flex flex-col gap-1.5 md:gap-3 md:[@media(max-height:800px)]:gap-2!">
            <label
              htmlFor="signup-first-name"
              className="text-label font-medium text-gray-700 md:text-base md:leading-6 md:text-ink"
            >
              First Name
            </label>
            <SignUpTextInput
              id="signup-first-name"
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter Your Name"
              required
              error={fieldErrors.firstName}
              className="md:py-[15px] md:[@media(max-height:800px)]:py-3! md:placeholder:text-black/60"
            />
            <SignUpFieldError message={fieldErrors.firstName} />
          </div>
          <div className="flex flex-col gap-1.5 md:gap-3 md:[@media(max-height:800px)]:gap-2!">
            <label
              htmlFor="signup-last-name"
              className="text-label font-medium text-gray-700 md:text-base md:leading-6 md:text-ink"
            >
              Last Name
            </label>
            <SignUpTextInput
              id="signup-last-name"
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter Your Name"
              required
              error={fieldErrors.lastName}
              className="md:py-[15px] md:[@media(max-height:800px)]:py-3! md:placeholder:text-black/60"
            />
            <SignUpFieldError message={fieldErrors.lastName} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 md:gap-3 md:[@media(max-height:800px)]:gap-2!">
          <label
            htmlFor="signup-password"
            className="text-label font-medium text-gray-700 md:text-base md:leading-6 md:text-ink"
          >
            Create Password
          </label>
          <div className="relative">
            <SignUpTextInput
              id="signup-password"
              key={showPassword ? "text" : "password"}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setPasswordFocused(true)}
              onBlur={(e) => {
                setPasswordFocused(false);
                handleBlur(e);
              }}
              placeholder="Enter Your Password"
              required
              error={fieldErrors.password}
              className="pr-11 md:py-[15px] md:[@media(max-height:800px)]:py-3! md:placeholder:text-black/60"
            />
            <Button
              variant="tertiary"
              size="icon-sm"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
          {/* Only while the field is focused -- except after a failed
              check, because this list is the only place the password
              error is explained (there is no SignUpFieldError here). */}
          {(passwordFocused || fieldErrors.password) && (
            <PasswordChecklist password={form.password} />
          )}
        </div>

        <div className="flex flex-col gap-1.5 md:gap-3 md:[@media(max-height:800px)]:gap-2!">
          <label
            htmlFor="signup-confirm-password"
            className="text-label font-medium text-gray-700 md:text-base md:leading-6 md:text-ink"
          >
            Confirm Password
          </label>
          <div className="relative">
            <SignUpTextInput
              id="signup-confirm-password"
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="re-enter Password"
              required
              error={fieldErrors.confirmPassword}
              className="pr-11 md:py-[15px] md:[@media(max-height:800px)]:py-3! md:placeholder:text-black/60"
            />
            <Button
              variant="tertiary"
              size="icon-sm"
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
          <SignUpFieldError message={fieldErrors.confirmPassword} />
        </div>

        {error && <p className="text-sm text-danger -mt-1">{error}</p>}

        <PrimaryBtn
          type="submit"
          className="mt-2 md:mt-4 md:h-16 md:py-5 md:px-10 md:[@media(max-height:800px)]:mt-2!"
          loading={loading}
        >
          {loading ? "Creating Account..." : "Create Your Account"}
        </PrimaryBtn>
      </form>

      {/* Desktop frame only: the same way back to Sign In the email step
          offers. Phones keep today's screen. */}
      {onSwitch && (
        <p className="hidden md:block mt-6 md:[@media(max-height:800px)]:mt-4 text-center text-[18px] tracking-[0.5px] text-black/60">
          Already Have An Account?{" "}
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={onSwitch}
            className="text-brand! h-auto! px-0! py-0! text-[16px]! leading-6 hover:bg-transparent!"
          >
            Sign In
          </Button>
        </p>
      )}
    </div>
  );
}
