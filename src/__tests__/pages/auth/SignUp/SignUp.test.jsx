import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SignUp from "../../../../pages/auth/SignUp/SignUp";
import { useAuth } from "../../../../store/AuthContext";

// The SignUp orchestrator owns step selection (email → email code → register),
// the session hand-off after register, and the final onboarding navigation.
// EmailPhoneStep's own submit behavior is already covered by
// EmailPhoneStep.test.jsx — this file drives the real step components through
// the orchestrator and asserts the wiring between them instead of duplicating
// that coverage.
vi.mock("../../../../store/AuthContext", () => ({ useAuth: vi.fn() }));
// The service calls the child steps make (request/verify email code, register,
// phone OTP) — mocked so the orchestrator flow can run end-to-end offline.
vi.mock("../../../../services/authService", () => ({
  register: vi.fn(),
  requestEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
  requestPhoneOtp: vi.fn(),
  verifyPhoneOtp: vi.fn(),
}));
// Real GoogleAuthButton needs a GoogleOAuthProvider to mount; the stub exposes
// the authenticated-user callback so the Google sign-up branch stays testable.
vi.mock("../../../../components/auth/GoogleAuthButton", () => ({
  default: ({ onAuthenticated }) => (
    <button onClick={() => onAuthenticated({ email: "google.user@example.com" })}>
      Continue with Google
    </button>
  ),
}));

const VALID_PASSWORD = "Glass123!";
const EMAIL = "sulaimon@example.com";
const CONFIRM_TOKEN = "confirm-abc";

function ChoosePathMarker() {
  const location = useLocation();
  return <div data-testid="choose-path">{JSON.stringify(location.state)}</div>;
}

function renderSignUp() {
  return render(
    <MemoryRouter initialEntries={["/sign-up"]}>
      <Routes>
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/sign-in" element={<div data-testid="sign-in-destination" />} />
        <Route path="/onboarding/choose-path" element={<ChoosePathMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillEmailStep() {
  fireEvent.change(screen.getByPlaceholderText("Enter Your Email Address"), {
    target: { value: EMAIL },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  // The submit dispatches the code before advancing.
  await screen.findByLabelText("Verification code");
}

function fillEmailCodeStep() {
  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function fillRegisterStep() {
  const nameInputs = screen.getAllByPlaceholderText("Enter Your Name");
  fireEvent.change(nameInputs[0], { target: { value: "Sulaimon" } });
  fireEvent.change(nameInputs[1], { target: { value: "Balogun" } });
  fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
    target: { value: VALID_PASSWORD },
  });
  fireEvent.change(screen.getByPlaceholderText("re-enter Password"), {
    target: { value: VALID_PASSWORD },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create Your Account|Creating Account/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({
    storeSessionIfPresent: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    setSession: vi.fn(),
  });
});

describe("SignUp step selection", () => {
  it("sends the code on the email step and advances to the code step, not the register step", async () => {
    const { requestEmailOtp } = await import("../../../../services/authService");
    requestEmailOtp.mockResolvedValue({ expiresAt: "2026-11-15T12:00:00Z" });
    renderSignUp();

    await fillEmailStep();

    // Verification must precede account creation: the backend rejects
    // register() without the confirmToken this step produces.
    expect(requestEmailOtp).toHaveBeenCalledWith({ email: EMAIL });
    expect(screen.queryByText("Complete Your Profile")).toBeNull();
    expect(useAuth().storeSessionIfPresent).not.toHaveBeenCalled();
  });

  it("keeps the person on the email step when the code cannot be sent", async () => {
    const { requestEmailOtp } = await import("../../../../services/authService");
    requestEmailOtp.mockRejectedValue({
      response: { status: 400, data: { message: "Email is already registered" } },
    });
    renderSignUp();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email Address"), {
      target: { value: EMAIL },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Email is already registered")).toBeDefined();
    expect(screen.queryByLabelText("Verification code")).toBeNull();
  });

  it("routes the 'Sign In' switch to the sign-in page", async () => {
    renderSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByTestId("sign-in-destination")).toBeDefined();
  });
});

describe("SignUp full flow", () => {
  it("runs email → email code → register → onboarding, carrying the confirmToken", async () => {
    const { register, requestEmailOtp, verifyEmailOtp } =
      await import("../../../../services/authService");
    const auth = useAuth();
    requestEmailOtp.mockResolvedValue({ expiresAt: "2026-11-15T12:00:00Z" });
    verifyEmailOtp.mockResolvedValue({ confirmToken: CONFIRM_TOKEN });
    register.mockResolvedValue({ accessToken: "reg-token" });
    renderSignUp();

    await fillEmailStep();
    fillEmailCodeStep();

    await screen.findByText("Complete Your Profile");
    expect(verifyEmailOtp).toHaveBeenCalledWith({ email: EMAIL, token: "123456" });

    fillRegisterStep();

    // Registration is the last API step — there is no activation code after
    // it, because the address was verified before the account was created.
    expect(await screen.findByText("Your Email Has Been Verified!")).toBeDefined();
    expect(register).toHaveBeenCalledWith({
      email: EMAIL,
      firstName: "Sulaimon",
      lastName: "Balogun",
      password: VALID_PASSWORD,
      emailConfirmToken: CONFIRM_TOKEN,
    });
    expect(auth.storeSessionIfPresent).toHaveBeenCalledWith({ accessToken: "reg-token" });

    const marker = await screen.findByTestId("choose-path", {}, { timeout: 4000 });
    expect(marker.textContent).toContain(EMAIL);
  });

  it("skips the code and register steps for Google sign-up and lands on onboarding", async () => {
    const auth = useAuth();
    renderSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    const marker = await screen.findByTestId("choose-path");
    expect(marker.textContent).toContain("google.user@example.com");
    expect(auth.storeSessionIfPresent).not.toHaveBeenCalled();
  });
});
