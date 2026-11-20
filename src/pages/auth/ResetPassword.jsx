import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { resetPassword } from "../../services/authService";
import { notifyError } from "../../utils/errorHandler";
import { toastSuccess } from "../../utils/toast";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "../../utils/password";
import AuthLayout from "../../layouts/AuthLayout";
import { Label, TextInput, PrimaryButton, ErrorMessage } from "../../components/auth/FormFields";
import PasswordChecklist from "../../components/auth/PasswordChecklist";

// Shared by /reset-password and /member/reset-password — see SignIn.jsx
// for why these were merged.
export default function ResetPassword() {
  const navigate = useNavigate();

  // Credentials come from sessionStorage (written by ForgotPassword), never
  // from the URL -- see the comment there for why.
  //
  // Read once in a lazy useState initializer rather than in the render body or
  // an effect:
  //   * in the render body it would re-run every render, and since the key is
  //     consumed, the second render would find nothing and flash "this reset
  //     link is invalid" the moment the user typed a character;
  //   * in an effect it needs a second render to land, which either shows a
  //     loading state or -- worse -- flashes the invalid-link state first;
  //   * sessionStorage.getItem is synchronous, so the initializer has the value
  //     before the first paint and there is no loading window at all.
  //
  // State is the working copy (survives re-renders); storage stays the durable
  // copy (survives a page refresh). Same shape as SignIn.jsx's
  // pendingVerificationEmail read.
  const [credentials] = useState(() => {
    try {
      const raw = sessionStorage.getItem("glass_reset_otp");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { email: parsed.email ?? "", token: parsed.token ?? "" };
      }
    } catch {
      // Unparseable value -- fall through to the invalid-link state below.
    }
    return { email: "", token: "" };
  });

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({ newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validateField(field, value, otherValue) {
    if (field === "newPassword") {
      if (!isPasswordValid(value))
        return `Must include: ${PASSWORD_REQUIREMENTS_TEXT.toLowerCase()}`;
    }
    if (field === "confirmPassword") {
      if (!value) return "Please confirm your new password.";
      if (value !== otherValue) return "Passwords don't match.";
    }
    return "";
  }

  function set(field) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      setError("");
      setFieldErrors((fe) => {
        const next = { ...fe };
        // Only live-validate a field once it's already flagged, so a fresh
        // field doesn't turn red before the user's even left it.
        if (fe[field])
          next[field] = validateField(
            field,
            value,
            field === "newPassword" ? form.confirmPassword : form.newPassword,
          );
        // Editing newPassword after confirmPassword was already checked
        // needs confirmPassword re-checked against the new value too.
        if (field === "newPassword" && fe.confirmPassword)
          next.confirmPassword = validateField("confirmPassword", form.confirmPassword, value);
        return next;
      });
    };
  }

  function handleBlur(field) {
    return (e) => {
      setFieldErrors((fe) => ({
        ...fe,
        [field]: validateField(
          field,
          e.target.value,
          field === "newPassword" ? form.confirmPassword : form.newPassword,
        ),
      }));
    };
  }

  async function handleSubmit() {
    const newPasswordError = validateField("newPassword", form.newPassword, form.confirmPassword);
    const confirmPasswordError = validateField(
      "confirmPassword",
      form.confirmPassword,
      form.newPassword,
    );
    if (newPasswordError || confirmPasswordError) {
      setFieldErrors({ newPassword: newPasswordError, confirmPassword: confirmPasswordError });
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Consume the token only once the user actually submits, so a refresh
      // part-way through the form doesn't strand them.
      sessionStorage.removeItem("glass_reset_otp");
      await resetPassword({
        email: credentials.email,
        token: credentials.token,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      toastSuccess("Password reset — sign in with your new password");
      navigate("/sign-in", { replace: true });
    } catch (err) {
      setError(notifyError(err, { context: "Reset password" }));
    } finally {
      setLoading(false);
    }
  }

  const isReady = form.newPassword && form.confirmPassword;

  return (
    <AuthLayout heroHeadline="Manage Your Community Finance Effortlessly">
      <div className="w-full max-w-md flex flex-col md:mt-14 mb-auto gap-6">
        <div>
          <h1 className="text-headline text-gray-900 mb-1">Reset Password</h1>
        </div>

        {!credentials.email || !credentials.token ? (
          <p className="text-sm text-danger">
            This reset link is invalid or has expired.{" "}
            <Link to="/forgot-password" className="font-semibold text-brand-navy">
              Request a new one
            </Link>
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <TextInput
                id="newPassword"
                type={showPw ? "text" : "password"}
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={set("newPassword")}
                onBlur={handleBlur("newPassword")}
                autoComplete="new-password"
                disabled={loading}
                error={fieldErrors.newPassword}
                rightElement={
                  <Button
                    variant="tertiary"
                    size="icon-sm"
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                }
              />
              <PasswordChecklist password={form.newPassword} />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <TextInput
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                onBlur={handleBlur("confirmPassword")}
                autoComplete="new-password"
                disabled={loading}
                error={fieldErrors.confirmPassword}
                rightElement={
                  <Button
                    variant="tertiary"
                    size="icon-sm"
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className=""
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                }
              />
              <ErrorMessage message={fieldErrors.confirmPassword || error} />
            </div>

            <PrimaryButton onClick={handleSubmit} loading={loading} disabled={!isReady}>
              {loading ? "Resetting..." : "Reset Password"}
            </PrimaryButton>
          </>
        )}

        <p className="text-sm text-center text-gray-500 pb-2">
          Remember your password?{" "}
          <Link to="/sign-in" className="font-semibold text-brand-navy">
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
