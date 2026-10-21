import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Join from "../../../../pages/auth/member/Join";
import { useAuth } from "../../../../store/AuthContext";

// Regression coverage for the Join.jsx -> Join/ split: index.jsx's initial-step
// selection (sessionStorage pending-verification vs ?email= vs the plain
// default) is the trickiest hand-written branching in that file, and the part
// most likely to silently break from a copy/paste mistake during a refactor
// that moved it into its own module. These assert step selection only --
// StepContact/StepProfile/etc.'s own internal behavior belongs in their own
// test files, not here.
vi.mock("../../../../store/AuthContext", () => ({ useAuth: vi.fn() }));

// requestLoginOtp fires from StepSignInOtp's own auto-send-on-mount effect,
// not from anything index.jsx does -- stubbed purely so the SIGNIN_OTP case
// below doesn't make a real network call while asserting index.jsx routed to
// the right step.
vi.mock("../../../../services/authService", () => ({
  requestLoginOtp: vi.fn(() => new Promise(() => {})), // never resolves; test only checks the initial render
}));

// StepContact renders GoogleAuthButton, which needs a real GoogleOAuthProvider
// (client ID, script load) to mount at all -- irrelevant to step-selection,
// which is all this file is testing.
vi.mock("../../../../components/auth/GoogleAuthButton", () => ({
  default: () => <div data-testid="google-auth-button-stub" />,
}));

function renderJoin(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Join />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useAuth.mockReturnValue({
    setSession: vi.fn(),
    storeSessionIfPresent: vi.fn(),
    isAuthenticated: false,
    loading: false,
  });
});

describe("Join's initial step selection", () => {
  it("defaults to the contact step with no pending state or params", () => {
    renderJoin("/member/join");
    expect(screen.getByText("Create Your Account")).toBeDefined();
  });

  it("resumes the OTP step when a pending verification is in sessionStorage", () => {
    sessionStorage.setItem(
      "glass_pending_member_verification",
      JSON.stringify({ email: "pending@example.com" }),
    );
    renderJoin("/member/join");
    expect(screen.getByText("Check Your Email")).toBeDefined();
    expect(screen.getByText("pending@example.com")).toBeDefined();
  });

  it("routes straight to sign-in-by-code when arriving via CheckEmail's QR (?email=, no invite token)", () => {
    renderJoin("/member/join?email=qr@example.com");
    expect(screen.getByText("You Already Have An Account")).toBeDefined();
  });

  // Regression test for a bug this file caught: `step`'s useState
  // lazy-initializer only ever runs once, on the first render, so it needs
  // `token` to be accurate immediately -- it can't rely on a later re-render
  // to correct a stale value the way effect-driven logic can. useInviteToken()
  // used to source `token` from sessionStorage alone, which is still empty on
  // this first render (the hook's own effect, which persists ?token= there,
  // hasn't run yet). Fixed in useInviteToken.js by reading the URL param
  // synchronously as well, so `token` is correct from the very first render.
  it("prefers the contact step over the QR shortcut when a personal invite token is also present", () => {
    renderJoin("/member/join?email=qr@example.com&token=abc123");
    expect(screen.getByText("You've Been Invited")).toBeDefined();
    expect(screen.queryByText("You Already Have An Account")).toBeNull();
  });
});
