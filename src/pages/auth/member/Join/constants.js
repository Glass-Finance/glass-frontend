// Steps mirror the owner SignUp flow: Contact (email, code sent) ->
// StepEmailOTP (code read back, confirmToken issued) -> StepProfile
// (register() with that token). Registration is the last API step — the
// account is already verified when register() returns, so there is no
// activation screen after it.
//
// OTP is NOT part of that linear flow. It is the LEGACY activation screen,
// kept only for accounts created before the backend started verifying the
// address before creating the account: a pending registration remembered in
// PENDING_KEY still needs POST /auth/verify, which is deprecated but
// retained server-side for exactly that case. New sign-ups never enter it.
//
// SIGNIN_OTP isn't part of the linear flow either -- it's entered directly,
// bypassing CONTACT/PROFILE, when arriving via CheckEmail.jsx's QR (see
// StepSignInOtp).
export const STEPS = {
  CONTACT: "contact",
  EMAIL_OTP: "emailOtp",
  PHONE_OTP: "phoneOtp",
  PROFILE: "profile",
  OTP: "otp",
  SIGNIN_OTP: "signinOtp",
};
export const OTP_LENGTH = 6;
// Codes are valid for 15 minutes (see SignIn.jsx and the spam-notice copy in StepEmailOTP).
export const OTP_VALIDITY_SECONDS = 15 * 60;
export const PENDING_KEY = "glass_pending_member_verification";
