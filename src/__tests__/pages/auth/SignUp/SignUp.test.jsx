import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import SignUp from "../../../../pages/auth/SignUp/SignUp";
import { useAuth } from "../../../../store/AuthContext";

// The SignUp orchestrator owns step selection (1 → 2 → 3), the session
// hand-off after register/verify, and the final onboarding navigation.
// EmailPhoneStep's own submit behavior is already covered by
// EmailPhoneStep.test.jsx — this file drives the real step components through
// the orchestrator and asserts the wiring between them instead of duplicating
// that coverage.
vi.mock("../../../../store/AuthContext", () => ({ useAuth: vi.fn() }));
// The service calls the child steps make (register/verifyEmail/resend/phone
// OTP) — mocked so the orchestrator flow can run end-to-end offline.
vi.mock("../../../../services/authService", () => ({
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
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

function fillEmailStep() {
  fireEvent.change(screen.getByPlaceholderText("Enter Your Email Address"), {
    target: { value: EMAIL },
  });
  fireEvent.click(screen.getByRole("checkbox"));
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
  it("advances email-only sign-up straight to the register step (phone stays optional)", async () => {
    renderSignUp();

    fillEmailStep();

    expect(await screen.findByText("Complete Your Profile")).toBeDefined();
    expect(useAuth().storeSessionIfPresent).not.toHaveBeenCalled();
  });

  it("routes the 'Sign In' switch to the sign-in page", async () => {
    renderSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByTestId("sign-in-destination")).toBeDefined();
  });
});

describe("SignUp full flow", () => {
  it("runs email → register → email OTP → onboarding, settling the session at each step", async () => {
    const { register, verifyEmail } = await import("../../../../services/authService");
    const auth = useAuth();
    register.mockResolvedValue({ accessToken: "reg-token" });
    verifyEmail.mockResolvedValue({ accessToken: "verified-token" });
    renderSignUp();

    fillEmailStep();
    await screen.findByText("Complete Your Profile");
    fillRegisterStep();

    // Step 3: session from the register response is stored before the OTP
    // screen renders (SignUp.jsx's handleRegistered contract).
    await screen.findByText("Check Your Email");
    expect(register).toHaveBeenCalledWith({
      email: EMAIL,
      firstName: "Sulaimon",
      lastName: "Balogun",
      password: VALID_PASSWORD,
    });
    expect(auth.storeSessionIfPresent).toHaveBeenCalledWith({ accessToken: "reg-token" });

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const marker = await screen.findByTestId("choose-path");
    expect(marker.textContent).toContain(EMAIL);
    expect(verifyEmail).toHaveBeenCalledWith({ email: EMAIL, token: "123456" });
    expect(auth.storeSessionIfPresent).toHaveBeenCalledTimes(2);
  });

  it("skips the OTP step for Google sign-up and lands on onboarding with the Google email", async () => {
    const auth = useAuth();
    renderSignUp();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    const marker = await screen.findByTestId("choose-path");
    expect(marker.textContent).toContain("google.user@example.com");
    expect(auth.storeSessionIfPresent).not.toHaveBeenCalled();
  });
});
