import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EmailPhoneStep from "../../../../pages/auth/SignUp/EmailPhoneStep";
import { requestEmailOtp } from "../../../../services/authService";

// Avoids depending on Google's Identity Services script/API in a jsdom
// test -- this file's own submit behavior is what's under test here, not
// GoogleAuthButton's.
vi.mock("../../../../components/auth/GoogleAuthButton", () => ({
  default: () => <div data-testid="google-auth-button" />,
}));

// The submit dispatches the verification code before advancing: the account
// is not created until the code has been read back, so a failed send has to
// keep the person on this form rather than moving them to a code screen for
// a mail that was never sent.
vi.mock("../../../../services/authService", () => ({
  requestEmailOtp: vi.fn(),
}));

function renderStep() {
  const onNext = vi.fn();
  render(
    <MemoryRouter>
      <EmailPhoneStep onNext={onNext} onSwitch={vi.fn()} onGoogleAuth={vi.fn()} />
    </MemoryRouter>,
  );
  return onNext;
}

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText("Enter Your Email Address"), {
    target: { value: "sulaimon@example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmailPhoneStep's Continue button", () => {
  it("sends the code, then hands the email up to the orchestrator", async () => {
    requestEmailOtp.mockResolvedValue({ expiresAt: "2026-11-15T12:00:00Z" });
    const onNext = renderStep();

    fillValidForm();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Continue"));

    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith({
        email: "sulaimon@example.com",
        phone: "",
      }),
    );
    expect(requestEmailOtp).toHaveBeenCalledWith({ email: "sulaimon@example.com" });
  });

  it("keeps the person on the form when the code cannot be sent", async () => {
    requestEmailOtp.mockRejectedValue({
      response: { status: 400, data: { message: "Email is already registered" } },
    });
    const onNext = renderStep();

    fillValidForm();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Continue"));

    expect(await screen.findByText("Email is already registered")).toBeDefined();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("shows an error and does not call onNext when clicked without accepting the terms", () => {
    const onNext = renderStep();

    fillValidForm();
    fireEvent.click(screen.getByText("Continue"));

    expect(screen.getByText("Please Accept Our Terms to Continue")).toBeDefined();
    expect(onNext).not.toHaveBeenCalled();
    expect(requestEmailOtp).not.toHaveBeenCalled();
  });
});
