import { useEffect, useRef, useState } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../store/AuthContext";
import { getAccessToken } from "../../store/sessionStorage";
import { useMfaChallenge } from "../../hooks/useMfaChallenge";
import { getMyInvites, getMyCommunityJoinRequests, submitJoinRequest } from "../../api/invites";
import { isMobileDevice } from "../../utils/deviceRedirect";
import { notifyError } from "../../utils/errorHandler";
import { resolvePostAuthDestination } from "../../utils/postAuthDestination";
import { toastInfo, toastSuccess } from "../../utils/toast";
import { JOIN_COMMUNITY_KEY } from "../../hooks/useJoinCommunityParam";
import GoogleAuthButton from "../../components/auth/GoogleAuthButton";
import AuthLayout from "../../layouts/AuthLayout";
import LoadingScreen from "../../components/LoadingScreen";
import { Label, TextInput, PrimaryButton, ErrorMessage } from "../../components/auth/FormFields";
import { formatCountdown } from "../../hooks/useCountdown";
import { useOtpSignIn } from "../../hooks/useOtpSignIn";
import { MfaChallengeScreen, OtpVerifyScreen } from "./SignInSections";
import { parseIdentifier, validateIdentifier } from "../../utils/authIdentifiers";
import ModeTabs from "../../components/auth/ModeTabs";

// One sign-in page reachable from two routes (/sign-in and
// /member/app-sign-in) — neither the page nor the login call itself knows
// in advance whether this is a community owner or a mobile-only member,
// only the *resulting* role/device does, so there was never a reason for
// two separate implementations. AuthLayout already adapts its chrome
// between a desktop split-screen and a mobile top-banner/bottom-sheet via
// CSS breakpoints, which is exactly the "one page, adapts by screen size"
// behavior both entry points need.
export default function SignIn() {
  usePageTitle("Sign in");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setSession, user, token, loading: authLoading, sessionVerified } = useAuth();
  const isMemberSignIn = location.pathname === "/member/app-sign-in";
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({
    identifier: "",
    password: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Which field gets the red *border* — the one currently (or most
  // recently) focused, never both identifier and password bordered red at
  // once. Error *messages* still show for every invalid field regardless
  // (nothing's hidden), this just keeps the "which field am I in" signal
  // to one field. Set on focus and left alone on blur, so tapping Sign In
  // (a button, not a field) doesn't clear it -- whichever field the user
  // was last in keeps the border.
  const [activeField, setActiveField] = useState(null);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  // ── Shared session-completion for the MFA and OTP hooks ──────────────────
  // Claimed by whichever auth path gets there first: the pre-auth redirect
  // effect below, or a sign-in the visitor started themselves.
  const destinationTakenRef = useRef(false);

  // One definition serves both hook callbacks below: establish the session,
  // then route by the resulting role/device.
  async function authenticateAndRoute(authData) {
    const user = await setSession(authData);
    navigate(await resolveDestination(user), { replace: true });
  }

  // Disarms the pre-auth redirect effect below, so a visitor who starts an
  // auth attempt themselves can never have that effect race them for the
  // one-shot sessionStorage flags resolveDestination consumes. This MUST run
  // before the session is established, not in authenticateAndRoute above --
  // by the time onAuthenticated fires, the token is already set and the
  // effect's guard has nothing left to protect. Hence a separate
  // onAuthAttempt callback that both hooks invoke at the top of their
  // session-establishing handlers.
  const markAuthAttempted = () => {
    destinationTakenRef.current = true;
  };

  // MFA challenge state + verification live in useMfaChallenge. The hook owns
  // which second factor is active (TOTP vs recovery code) so the inputs and
  // the endpoint that gets called can't disagree.
  const {
    mfaChallenge,
    setMfaChallenge,
    mfaMethod,
    switchMethod,
    mfaCode,
    setMfaCode,
    recoveryCode,
    setRecoveryCode,
    canVerify,
    resetChallenge,
    mfaInputRef,
    handleMfaVerify,
  } = useMfaChallenge({
    setLoading,
    setError,
    onAuthAttempt: markAuthAttempted,
    onAuthenticated: authenticateAndRoute,
  });

  // ── Passwordless (OTP) sign-in — state + handlers live in useOtpSignIn ──
  const [mode, setMode] = useState("password"); // "password" | "otp"
  const {
    otpStep,
    setOtpStep,
    otpChannel,
    setOtpChannel,
    otpIdentifier,
    setOtpIdentifier,
    otpIdentifierError,
    setOtpIdentifierError,
    otpSending,
    otpVerifying,
    otpError,
    setOtpError,
    otp,
    setOtp,
    otpSecondsLeft,
    resendSecondsLeft,
    otpCodeExpired,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  } = useOtpSignIn({
    onAuthAttempt: markAuthAttempted,
    onMfaRequired: (mfaChallengeToken) => {
      setMfaChallenge({ mfaChallengeToken });
      setTimeout(() => mfaInputRef.current?.focus(), 50);
    },
    onAuthenticated: authenticateAndRoute,
  });

  function switchMode(next) {
    setMode(next);
    setOtpStep("request");
    setOtpError("");
    setError("");
  }

  // Show a banner if the user was mid-verification (registered but not yet
  // confirmed email) and then refreshed or navigated away.
  const [pendingVerificationEmail] = useState(() => {
    try {
      const raw = sessionStorage.getItem("glass_pending_member_verification");
      return raw ? JSON.parse(raw).email : null;
    } catch {
      return null;
    }
  });

  // client.js's 401 interceptor hard-redirects here on session expiry — a
  // toast shown right before that navigation gets wiped along with
  // everything else, so it leaves this flag for the destination to read.
  useEffect(() => {
    if (sessionStorage.getItem("glass_session_expired")) {
      sessionStorage.removeItem("glass_session_expired");
      setTimeout(() => {
        toastInfo("Session expired", {
          description: "For your security, please sign in again.",
        });
      }, 0);
    }
  }, []);

  function validateField(field, value) {
    if (field === "identifier") return validateIdentifier(value);
    if (field === "password" && !value) return "Password is required.";
    return "";
  }

  function set(field) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      setError("");
      // Only live-validate once the field has already been flagged invalid,
      // so a fresh field doesn't turn red before the user's even left it.
      setFieldErrors((fe) => (fe[field] ? { ...fe, [field]: validateField(field, value) } : fe));
    };
  }

  // Shared by password sign-in and Google sign-in: resolves the destination
  // by the *resulting* role/device, since neither knows in advance whether
  // this is a community owner or a mobile-only member. Pure routing math
  // lives in resolvePostAuthDestination (unit-tested); this wrapper only
  // performs the async side work (community submit, invite lookups) and
  // consumes the one-shot session flags before delegating.
  async function resolveDestination(user) {
    // A community's generic shareable "Invite Link" (?community=, see
    // useJoinCommunityParam) has no personal token — clicking it as a user
    // who *already has an account but wasn't signed in* lands here via
    // Join.jsx's "Sign in to accept the invite" link with ?return=/member/invites
    // already set, which used to short-circuit the very next check below
    // before the join request was ever actually submitted. Submit it here,
    // before that shortcut, so it isn't silently dropped. Falls through to
    // the normal chain below (unlike Join's own flow, which routes to
    // /member/invites immediately after submitting).
    const pendingCommunity = sessionStorage.getItem(JOIN_COMMUNITY_KEY);
    if (pendingCommunity) {
      sessionStorage.removeItem(JOIN_COMMUNITY_KEY);
      try {
        await submitJoinRequest(pendingCommunity);
        toastSuccess("Join request sent", {
          description: "The community admin will review it shortly.",
        });
      } catch (err) {
        notifyError(err, { context: "Join community" });
      }
    }

    // `?return=` is the public form of this; the route guards hand off via
    // location.state.from (ProtectedRoute's state={{ from: location }}) —
    // same validation either way (resolvePostAuthDestination runs it through
    // isSafeReturnPath), so both a pre-auth bounce and a fresh sign-in land
    // where the user was actually headed.
    const returnTo =
      new URLSearchParams(location.search).get("return") ??
      (location.state?.from?.pathname
        ? `${location.state.from.pathname}${location.state.from.search ?? ""}`
        : null);

    // If the session expired mid-payment (while the user was on Paystack's
    // page), PaymentSummary stored the reference before navigating away.
    // Re-login should land them on the callback to finish verifying.
    const pendingRef = sessionStorage.getItem("paymentPendingRef");
    if (pendingRef) {
      // Tombstone before removing: the Home hook may still have a verify for
      // this reference in flight, and restoring it here would resurrect a
      // payment this sign-in is deliberately closing the door on.
      sessionStorage.setItem("paymentPendingRef_terminal", pendingRef);
      sessionStorage.removeItem("paymentPendingRef");
    }

    // login() has already succeeded by the time we get here -- a failure in
    // either of these two lookups must not surface as "Incorrect email or
    // password" (handleSignIn's catch would otherwise blame the wrong step).
    // Admins return before this point inside the helper's role branches, so
    // these member-only lookups only run for member sessions, as before.
    let hasPendingInvites = false;
    if (!user?.isPlatformAdmin && !user?.isAdmin && isMobileDevice()) {
      try {
        const inviteRes = await getMyInvites();
        const inviteData = inviteRes?.data?.data;
        const invites = Array.isArray(inviteData) ? inviteData : (inviteData?.content ?? []);
        if (invites.length > 0) {
          hasPendingInvites = true;
        } else {
          const joinReqRes = await getMyCommunityJoinRequests();
          const data = joinReqRes?.data?.data;
          const joinRequests = Array.isArray(data) ? data : (data?.content ?? []);
          hasPendingInvites = joinRequests.length > 0;
        }
      } catch {
        // fall through with hasPendingInvites = false
      }
    }

    return resolvePostAuthDestination({
      user,
      isMobile: isMobileDevice(),
      returnTo,
      pendingPaymentRef: pendingRef,
      hasPendingInvites,
    }).to;
  }

  // Pre-auth redirect: a visitor whose session is already verified against
  // the backend has no business filling in a sign-in form — resolve where
  // they belong (same role/device math as a fresh sign-in) and get out of
  // the way. Runs resolveDestination exactly once, because it consumes
  // one-shot sessionStorage flags (pending join, payment reference), and
  // only when the visitor hasn't started an auth attempt themselves: the
  // handlers below flip destinationTakenRef before establishing a session,
  // so a fresh sign-in can never race this effect for the flags. Mirrors
  // Join/index.jsx's already-authenticated short-circuit. The ref itself is
  // declared above the hook wiring, because useOtpSignIn/useMfaChallenge
  // close over it via onAuthAttempt.
  useEffect(() => {
    if (destinationTakenRef.current) return;
    if (authLoading || !token || !sessionVerified) return;
    destinationTakenRef.current = true;
    resolveDestination(user)
      .then((dest) => navigate(dest, { replace: true }))
      .catch(() =>
        navigate(user?.isPlatformAdmin || user?.isAdmin ? "/dashboard/home" : "/member/home", {
          replace: true,
        }),
      );
    // resolveDestination reads live location/sessionStorage state and the
    // ref guard makes reruns no-ops — this fires once per mount, so it must
    // not re-run on function-identity churn.
  }, [authLoading, token, sessionVerified, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    destinationTakenRef.current = true;
    const identifierError = validateField("identifier", form.identifier);
    const passwordError = validateField("password", form.password);
    if (identifierError || passwordError) {
      setFieldErrors({ identifier: identifierError, password: passwordError });
      // Focusing the first invalid field is what makes it "the one you're
      // focused on" -- its own onFocus handler picks up activeField from here.
      (identifierError ? identifierRef : passwordRef).current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await login({
        ...parseIdentifier(form.identifier),
        password: form.password,
      });
      if (result?.mfaRequired) {
        setMfaChallenge({ mfaChallengeToken: result.mfaChallengeToken });
        setTimeout(() => mfaInputRef.current?.focus(), 50);
        return;
      }
      navigate(await resolveDestination(result), { replace: true });
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Sign in",
          fallback: "Incorrect email or password.",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth(user) {
    destinationTakenRef.current = true;
    try {
      navigate(await resolveDestination(user), { replace: true });
    } catch (err) {
      setError(notifyError(err, { context: "Google sign in" }));
    }
  }

  const isReady = form.identifier.trim() && form.password;

  // A stored session that's still being verified server-side shouldn't
  // flash the form and then bounce — hold the spinner until the verdict,
  // the same way the route guards do (they gate on loading first). No
  // stored token means a fresh visitor, who sees the form immediately.
  if (authLoading && getAccessToken()) {
    return <LoadingScreen />;
  }

  // ── MFA challenge screen ──────────────────────────────────────────────────────
  if (mfaChallenge) {
    return (
      <MfaChallengeScreen
        mfaInputRef={mfaInputRef}
        mfaCode={mfaCode}
        setMfaCode={(value) => {
          setMfaCode(value);
          setError("");
        }}
        mfaMethod={mfaMethod}
        recoveryCode={recoveryCode}
        setRecoveryCode={(value) => {
          setRecoveryCode(value);
          setError("");
        }}
        canVerify={canVerify}
        error={error}
        loading={loading}
        onVerify={handleMfaVerify}
        onSwitchMethod={switchMethod}
        onBack={() => {
          // resetChallenge clears the active factor and both inputs, so
          // returning to the MFA screen later doesn't reopen on a
          // half-entered recovery code.
          resetChallenge();
          setError("");
          if (mode === "otp") setOtpStep("request");
        }}
      />
    );
  }

  // ── OTP verify screen — focused, no tabs, mirrors OTPStep.jsx's registration
  // pattern ──────────────────────────────────────────────────────────────────
  if (mode === "otp" && otpStep === "verify") {
    return (
      <OtpVerifyScreen
        otpIdentifier={otpIdentifier}
        otpChannel={otpChannel}
        otp={otp}
        setOtp={(next) => {
          setOtp(next);
          setOtpError("");
        }}
        otpError={otpError}
        otpCodeExpired={otpCodeExpired}
        otpSecondsLeft={otpSecondsLeft}
        otpVerifying={otpVerifying}
        otpSending={otpSending}
        resendSecondsLeft={resendSecondsLeft}
        onBackToIdentifier={() => {
          setOtpStep("request");
          setOtp(["", "", "", "", "", ""]);
          setOtpError("");
        }}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        formatCountdown={formatCountdown}
      />
    );
  }

  return (
    <AuthLayout heroTitle="Manage Your Community" heroSubtitle="Finance Effortlessly">
      {/* mt-* + mb-auto (not my-auto) -- the Password tab has noticeably
          more content than One-Time Code (an extra field, a Forgot-password
          link), so pure vertical centering gave the two tabs different top
          spacing: Password ended up cramped against the panel's top edge
          while One-Time Code centered comfortably. Pinning a fixed top
          offset keeps that gap identical on both tabs; any leftover space
          from the shorter tab collects at the bottom instead. */}
      <div className="w-full max-w-md flex flex-col md:mt-14 mb-auto gap-6">
        {pendingVerificationEmail && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Email verification pending</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              You registered with <span className="font-medium">{pendingVerificationEmail}</span>{" "}
              but didn't finish verifying. Check your inbox — and spam folder — for the 6-digit
              code.
            </p>
            <p className="text-xs text-amber-700 leading-relaxed mt-1">
              Codes expire after 15 minutes. If yours has expired, go back and register again to
              receive a fresh one.
            </p>
            <Link
              to="/member/join"
              className="text-xs font-semibold mt-2 inline-block text-amber-800"
            >
              Back to registration →
            </Link>
          </div>
        )}
        <div>
          <h1 className="text-headline text-gray-900 mb-1">Sign In To Your Account</h1>
          <p className="text-sm text-gray-500">
            {mode === "otp"
              ? "We'll email or text you a one-time code, no password needed."
              : "Enter your credentials to continue."}
          </p>
        </div>

        <ModeTabs mode={mode} setMode={switchMode} disabled={loading || otpSending} />

        {mode === "password" ? (
          <>
            <div>
              <Label htmlFor="identifier">Email or Phone Number</Label>
              <TextInput
                ref={identifierRef}
                id="identifier"
                type="text"
                placeholder="Enter your email or number"
                value={form.identifier}
                onChange={set("identifier")}
                onFocus={() => setActiveField("identifier")}
                autoComplete="username"
                disabled={loading}
                error={activeField === "identifier" ? fieldErrors.identifier : ""}
              />
              <ErrorMessage message={fieldErrors.identifier} />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <TextInput
                ref={passwordRef}
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={set("password")}
                onFocus={() => setActiveField("password")}
                autoComplete="current-password"
                disabled={loading}
                error={activeField === "password" ? fieldErrors.password : ""}
                rightElement={
                  <Button
                    variant="tertiary"
                    size="icon-sm"
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className=""
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                }
              />
              <ErrorMessage message={fieldErrors.password || error} />
              <div className="flex justify-end mt-1.5">
                <Link to="/forgot-password" className="text-label font-medium text-brand-navy">
                  Forgot password?
                </Link>
              </div>
            </div>

            <PrimaryButton onClick={handleSignIn} loading={loading} disabled={!isReady}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in…</span>
                </span>
              ) : (
                "Sign In"
              )}
            </PrimaryButton>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="otp-identifier">
                {otpChannel === "email" ? "Email address" : "Phone number"}
              </Label>
              <TextInput
                id="otp-identifier"
                type={otpChannel === "email" ? "email" : "tel"}
                inputMode={otpChannel === "email" ? "email" : "tel"}
                placeholder={
                  otpChannel === "email" ? "Enter your email address" : "Enter your phone number"
                }
                value={otpIdentifier}
                onChange={(e) => {
                  setOtpIdentifier(e.target.value);
                  setOtpIdentifierError("");
                }}
                autoComplete={otpChannel === "email" ? "email" : "tel"}
                disabled={otpSending}
                error={otpIdentifierError}
              />
              <ErrorMessage message={otpIdentifierError} />
              <p className="text-sm text-gray-500 mt-2">
                <Button
                  variant="tertiary"
                  size="xs"
                  fullWidth={false}
                  aria-label={`Use ${otpChannel === "email" ? "phone number" : "email"} instead`}
                  className="!px-0 !py-0 !h-auto !inline-flex font-semibold text-brand-navy hover:underline"
                  disabled={otpSending}
                  onClick={() => {
                    setOtpChannel(otpChannel === "email" ? "phone" : "email");
                    setOtpIdentifier("");
                    setOtpIdentifierError("");
                  }}
                >
                  <span className="text-gray-500 font-normal">Use </span>
                  <span className="font-semibold text-brand-navy">
                    {otpChannel === "email" ? "phone number" : "email"}
                  </span>
                  <span className="text-gray-500 font-normal"> instead</span>
                </Button>
              </p>
              {otpChannel === "phone" && (
                <p className="text-xs text-gray-500 mt-1">
                  Use a phone number added to and verified on your account. If you haven’t added or
                  verified one, choose email.
                </p>
              )}
            </div>

            <PrimaryButton
              onClick={handleSendOtp}
              loading={otpSending}
              disabled={!otpIdentifier.trim()}
            >
              {otpSending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending code…</span>
                </span>
              ) : (
                "Send Code"
              )}
            </PrimaryButton>
          </>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        <GoogleAuthButton onAuthenticated={handleGoogleAuth} label="signin_with" />

        <p className="text-sm text-center text-gray-500 pb-2">
          New to Glass?{" "}
          {/* /sign-up is the community-owner entry point, /member/join is
              the member one -- same distinction App.jsx's route comment
              draws, so this can't just always point to /sign-up. */}
          <Link
            to={isMemberSignIn ? "/member/join" : "/sign-up"}
            className="font-semibold text-brand-navy"
          >
            Create Account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
