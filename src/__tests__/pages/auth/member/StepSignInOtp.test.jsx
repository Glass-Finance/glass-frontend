import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StepSignInOtp from "../../../../pages/auth/member/Join/StepSignInOtp";

// The member-join QR handoff screen -- the one OTP screen where the FRONTEND
// owns the send (it fires POST /auth/otp/request on mount). It is also the
// screen behind the reported bug: on a phone the send can be refused by the
// API's per-IP limiter, and the refusal used to be invisible -- no toast, no
// Sentry, no console -- while the screen kept claiming a code was on its
// way.
vi.mock("../../../../services/authService", () => ({
  requestLoginOtp: vi.fn(),
  verifyLoginOtp: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { requestLoginOtp } from "../../../../services/authService";
import { toast } from "sonner";

const EMAIL = "member@example.com";

function rateLimited() {
  return {
    response: {
      status: 429,
      data: { message: "error", description: "Rate limit exceeded. Please try again later." },
      headers: { "retry-after": "17" },
    },
    config: { url: "/auth/otp/request" },
  };
}

function renderStep() {
  return render(<StepSignInOtp email={EMAIL} onVerified={vi.fn()} onUseDifferentEmail={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StepSignInOtp's automatic code send", () => {
  it("asks for a code on mount and tells the user it is on its way", async () => {
    requestLoginOtp.mockResolvedValue({
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    });
    renderStep();

    expect(await screen.findByText("Enter the 6-digit code sent to")).toBeDefined();
    expect(requestLoginOtp).toHaveBeenCalledWith({ email: EMAIL });
  });

  // The regression this file exists for.
  it("says so plainly when the send failed, instead of claiming a code was sent", async () => {
    requestLoginOtp.mockRejectedValue(rateLimited());
    renderStep();

    expect(await screen.findByText("We couldn't send a code to")).toBeDefined();
    expect(screen.queryByText("Enter the 6-digit code sent to")).toBeNull();
    expect(screen.getByText(/No code was sent/)).toBeDefined();
    expect(screen.getByText(/Rate limit exceeded/)).toBeDefined();
  });

  it("toasts the failure, so it is not left to a line of text under the boxes", async () => {
    requestLoginOtp.mockRejectedValue(rateLimited());
    renderStep();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toContain("Rate limit exceeded");
  });

  it("offers a fresh send after a failure, locked for as long as the server asked", async () => {
    requestLoginOtp.mockRejectedValue(rateLimited());
    renderStep();

    const retry = await screen.findByRole("button", { name: /Send code in 17s/ });
    expect(retry.disabled).toBe(true);
  });
});
