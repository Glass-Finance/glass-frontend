import { useState } from "react";
import { isPhoneValid, PHONE_FORMAT_HINT } from "../../../utils/phone";
import { requestPhoneOtp } from "../../../services/authService";
import { getErrorMessage } from "../../../utils/errorHandler";
import { SignUpTextInput, SignUpFieldError } from "./SignUpTextInput";
import { Button, Button as PrimaryBtn } from "../../../components/ui/Button";

function validatePhone(value) {
  if (!value.trim()) return "Phone number is required.";
  if (!isPhoneValid(value)) return PHONE_FORMAT_HINT;
  return "";
}

// "Wrong number?" correction screen, reached from PhoneOTPStep — shows only
// the phone field (not email too) so fixing a mistyped number doesn't also
// force re-entering an email that was already correct. Sends a fresh OTP
// itself on submit (same requestPhoneOtp() call EmailPhoneStep makes) so a
// still-duplicate number is caught right here instead of only surfacing
// once back on the OTP-verify screen.
export default function PhoneOnlyStep({ initialPhone, onNext, onCancel }) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const value = e.target.value;
    setPhone(value);
    if (phoneError) setPhoneError(validatePhone(value));
  }

  function handleBlur(e) {
    setPhoneError(validatePhone(e.target.value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const error = validatePhone(phone);
    if (error) {
      setPhoneError(error);
      return;
    }
    const trimmed = phone.trim();
    setSubmitting(true);
    try {
      await requestPhoneOtp({ phoneNumber: trimmed });
      onNext(trimmed);
    } catch (err) {
      setPhoneError(getErrorMessage(err, "Couldn't send a code to that number. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col md:mt-14 mb-auto">
      <div className="mb-3">
        <h1 className="text-headline text-gray-900 mb-1.5">Update Your Phone Number</h1>
        <p className="text-sm text-gray-500">
          We'll send a new verification code to the corrected number.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-phone" className="text-label font-medium text-gray-700">
            Phone Number
          </label>
          <SignUpTextInput
            id="signup-phone"
            type="tel"
            value={phone}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g. 0803 123 4567"
            required
            error={phoneError}
            autoFocus
          />
          <SignUpFieldError message={phoneError} />
        </div>

        <PrimaryBtn type="submit" className="mt-2" loading={submitting} size="sm">
          {submitting ? "Sending Code..." : "Send New Code"}
        </PrimaryBtn>

        <Button variant="tertiary" size="sm" fullWidth={false} onClick={onCancel} type="button">
          Back to verification
        </Button>
      </form>
    </div>
  );
}
