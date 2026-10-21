# Account, phone, and identity flows

## Current behavior

This page describes the product flows for **sign-in**, **optional phone**, and **identity verification (KYC)** as implemented in this frontend. Backend contracts remain authoritative (`docs/authentication.md`, `docs/kyc.md`, `docs/authorization.md`).

### Sign-in accepts email or phone

- `/sign-in` and `/member/app-sign-in` take a single identifier that accepts an **email or phone number** (password tab and One-Time Code tab).
- `"@"` is the one unambiguous signal between the two formats; phone input is format-validated (`isPhoneValid`), email input by `getEmailError`.
- Password reset (`ForgotPassword`) is email-only.
- Backend login APIs accept both shapes (`{ email }` XOR `{ phoneNumber }` — `identifierPayload` in `src/services/authPayloads.js`); the identifier pass-through was restored after a frontend-only email-only regression.

### Phone is optional and added after signup

Phone is **not** collected during registration (email + name/password → email OTP). The number is **added later** in Settings when needed (payment reminders, account recovery).

| Surface                           | First-time copy                                      | After the number is verified            |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| Member home nudge                 | **Add Your Phone Number**                            | Hidden                                  |
| Member / dashboard Profile pencil | **Add phone number**                                 | **Update phone number**                 |
| Member `/member/verify-phone`     | **Add Your Phone Number** / CTA **Add Phone Number** | **Update Your Phone Number**            |
| Dashboard Profile phone panel     | **Add Your Phone Number** / CTA **Add Phone Number** | **Update…**                             |
| Success after OTP                 | **Your Phone Number Has Been Added!**                | **Your Phone Number Has Been Updated!** |

**Do not use “Verify phone number” for the first-time flow.** OTP still confirms ownership of the number; product language for the first entry is **add**, because users never had a phone field at account creation.

### Which channel a code goes out on

| Surface                                           | Channel                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Registration (both `/sign-up` and `/member/join`) | **Email only.** The phone number is not collected at signup, so there is no number to send an SMS to. |
| Passwordless sign-in (the “One-Time Code” tab)    | Email or SMS, matching the identifier that was typed.                                                 |
| Add / update phone number                         | SMS to the number being added.                                                                        |
| Password reset                                    | Email.                                                                                                |
| Change account email                              | Email to the proposed address.                                                                        |

A signup therefore never sends an SMS — if someone is waiting on a text after registering, the phone number still has to be added in Settings. The delivery mechanics (who sends, what a failed send looks like) are in [`authentication.md`](authentication.md#verification-codes--who-sends-them-and-who-reports-a-failed-send).

Flow (same OTP mechanics for add vs update; mode is `user.phoneVerified`):

1. Enter number → `POST` request (action verification / phone update request).
2. Enter 6-digit code → confirm (`PATCH` user phone / update hook).
3. Refresh session user; success badge; navigate back.

Entry points: member home banner (until `phoneVerified`), member Profile, community-admin dashboard banner, dashboard Settings → Account → Profile.

### Change account email

Both dashboard Profile and the member app request an `EMAIL_UPDATE` code through
`POST /api/v1/action-verification/request` with the proposed email address.
Resending requests another challenge through the same endpoint. The code is
confirmed with `PATCH /api/v1/user/email` and the `emailVerificationOtp` field;
the email is not changed until that request succeeds.

### Identity verification (KYC)

Members verify identity with Smile ID before creating or managing communities (and can complete it from Settings). Full detail: [`kyc.md`](kyc.md).

Summary:

- Member page: `/member/verify-identity` (+ history) and the dashboard counterpart; gates and badges open the wizard modal inline.
- Status badges: Settings Account, Home header, communities surfaces.
- Gate: wizard modal when summary is not `APPROVED` (fails open on load/error).
- Platform admin: Admin Panel → KYC review queue and decision modal.
- Kill switch: `VITE_FLAGS={"kycDisabled":true}`.

### Related env / flags

| Variable       | Role                                             |
| -------------- | ------------------------------------------------ |
| `VITE_FLAGS`   | `paymentsDisabled`, `kycDisabled` kill switches  |
| `VITE_SMILE_*` | Smile ID SDK init only (token minted by backend) |

See `.env.example` and `docs/runbooks/incident-rollback.md`.

## Proposed/future direction

- Optional: rename route `verify-phone` → `add-phone` with redirects if URL copy should match product language (not required for correctness).
- Marketing copy under `glass-waitlist-v1` must be re-ported if landing “how it works” steps change here (see root `README.md` two-repo rule).
