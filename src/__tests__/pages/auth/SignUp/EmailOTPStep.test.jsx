import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EmailOTPStep from "../../../../pages/auth/SignUp/EmailOTPStep";
import { verifyEmailOtp, requestEmailOtp } from "../../../../services/authService";

// The step that reads back the emailed code BEFORE the account exists: it
// exchanges the code for the single-use confirmToken register() requires, and
// hands that token to the orchestrator. Uncovered off the baseline; services
// mocked at the module boundary, countdown/OtpBoxes run for real
// (deterministic: the code window starts at 15 minutes, far beyond test
// runtime).
vi.mock("../../../../services/authService", () => ({
  verifyEmailOtp: vi.fn(),
  requestEmailOtp: vi.fn(),
}));

const EMAIL = "sulaimon@example.com";

function renderStep() {
  const onVerified = vi.fn();
  const onBack = vi.fn();
  render(<EmailOTPStep email={EMAIL} onVerified={onVerified} onBack={onBack} />);
  return { onVerified, onBack };
}

function typeCode(code) {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Continue|Verifying/ }));
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmailOTPStep continue button", () => {
  it("stays disabled until all six digits are entered", () => {
    renderStep();

    expect(screen.getByRole("button", { name: "Continue" }).disabled).toBe(true);

    typeCode("123");
    expect(screen.getByRole("button", { name: "Continue" }).disabled).toBe(true);

    typeCode("123456");
    expect(screen.getByRole("button", { name: "Continue" }).disabled).toBe(false);
  });
});

describe("EmailOTPStep verification", () => {
  it("exchanges the code for a confirmToken, shows loading, then hands it to onVerified", async () => {
    const { onVerified } = renderStep();
    const result = { confirmToken: "confirm-abc", expiresAt: "2026-11-15T12:00:00Z" };
    const gate = deferred();
    verifyEmailOtp.mockReturnValue(gate.promise);

    typeCode("123456");
    submit();

    expect(verifyEmailOtp).toHaveBeenCalledWith({ email: EMAIL, token: "123456" });
    expect(screen.getByText("Verifying...")).toBeDefined();

    gate.resolve(result);
    // Only the token is handed up: this proves the address, it is not a
    // session — register() consumes it and returns the authentication.
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith("confirm-abc"));
  });

  it("explains a rejected code inline and does not advance", async () => {
    const { onVerified } = renderStep();
    verifyEmailOtp.mockRejectedValue({
      response: { status: 400, data: { message: "Invalid verification code" } },
    });

    typeCode("654321");
    submit();

    expect(await screen.findByText("Invalid verification code")).toBeDefined();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("resends through the same request endpoint, confirms it, and clears the entered code", async () => {
    renderStep();
    requestEmailOtp.mockResolvedValue({ expiresAt: "2026-11-15T12:00:00Z" });

    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    expect(await screen.findByText("A new code has been sent.")).toBeDefined();
    expect(requestEmailOtp).toHaveBeenCalledWith({ email: EMAIL });
    expect(screen.getByLabelText("Verification code").value).toBe("");
  });

  it("surfaces a resend rate-limit failure in the resend message", async () => {
    renderStep();
    requestEmailOtp.mockRejectedValue({
      response: { status: 429, data: {} },
      config: { url: "/auth/email/request-otp" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    expect(
      await screen.findByText("Too many attempts — please wait a moment and try again."),
    ).toBeDefined();
  });

  it("returns to the previous step on 'Wrong email?'", () => {
    const { onBack } = renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Wrong email?" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
