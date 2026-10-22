import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import SignIn from "../../../pages/auth/SignIn";
import { useAuth } from "../../../store/AuthContext";
import { verifyMfaLogin, requestLoginOtp, verifyLoginOtp } from "../../../services/authService";
import { verifyMfaRecoveryCodeLogin } from "../../../services/authService";
import { submitJoinRequest } from "../../../api/invites";

// Sign-in is the front door to every other flow and had zero coverage off the
// V8 baseline. AuthContext is mocked (per the repo's convention of mocking at
// the session boundary) so these tests pin SignIn's own behavior — field
// validation, inline error surfacing, loading state, the post-auth destination,
// and the MFA / one-time-code step handoffs — without a real session or a
// network call. login() and setSession() come back from this mock; the
// password-less OTP + MFA service calls SignIn makes directly are mocked below.
vi.mock("../../../store/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../../services/authService", () => ({
  verifyMfaLogin: vi.fn(),
  verifyMfaRecoveryCodeLogin: vi.fn(),
  requestLoginOtp: vi.fn(),
  verifyLoginOtp: vi.fn(),
}));
// Member invite lookups and pending ?community= join-request submissions are
// mocked to assert post-auth routing without network calls.
vi.mock("../../../api/invites", () => ({
  getMyInvites: vi.fn(),
  getMyCommunityJoinRequests: vi.fn(),
  submitJoinRequest: vi.fn(),
}));
// Avoids depending on Google's Identity Services in a jsdom test — this file's
// own sign-in behavior is what's under test here, not GoogleAuthButton's
// (same approach as EmailPhoneStep.test.jsx).
vi.mock("../../../components/auth/GoogleAuthButton", () => ({
  default: () => <div data-testid="google-auth-button" />,
}));

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const ORIGINAL_UA = window.navigator.userAgent;
const ORIGINAL_WIDTH = window.innerWidth;

function setUA(ua) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}
function setWidth(width) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

function renderSignIn(initialPath = "/sign-in") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/member/app-sign-in" element={<SignIn />} />
        <Route path="/dashboard/admin-panel" element={<div>Admin panel</div>} />
        <Route path="/member/home" element={<div>Member home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillCredentials(identifier, password) {
  fireEvent.change(screen.getByPlaceholderText("Enter your email or number"), {
    target: { value: identifier },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
    target: { value: password },
  });
}

function clickSignIn() {
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
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
  sessionStorage.clear();
  localStorage.clear();
  // Desktop device + an unauthenticated session by default; individual tests
  // override the auth mock. Pinning UA/width keeps device-specific entry
  // flows deterministic.
  setUA(DESKTOP_UA);
  setWidth(1440);
  useAuth.mockReturnValue({
    user: null,
    token: null,
    loading: false,
    sessionVerified: false,
    isAuthenticated: false,
    isPlatformAdmin: false,
    isAdmin: false,
    isMember: true,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
    storeSessionIfPresent: vi.fn(),
    updateUser: vi.fn(),
    refreshUser: vi.fn(),
    hydrateUserProfile: vi.fn(),
  });
});

afterEach(() => {
  setUA(ORIGINAL_UA);
  setWidth(ORIGINAL_WIDTH);
  sessionStorage.clear();
});

describe("SignIn password form", () => {
  it("blocks submission and flags an invalid identifier without calling login", () => {
    renderSignIn();
    fillCredentials("bad@", "whatever1");

    clickSignIn();

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(useAuth().login).not.toHaveBeenCalled();
  });

  it("accepts a phone-shaped identifier and passes it through as phoneNumber", async () => {
    renderSignIn();
    useAuth().login.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });

    fillCredentials("+2348012345678", "whatever1");

    clickSignIn();

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(useAuth().login).toHaveBeenCalledWith({
      phoneNumber: "+2348012345678",
      password: "whatever1",
    });
  });

  it("signs in and routes a platform admin to the admin panel, normalizing the email", async () => {
    renderSignIn();
    useAuth().login.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });

    fillCredentials("Owner@Example.com", "secret123");
    clickSignIn();

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(useAuth().login).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "secret123",
    });
  });

  it("routes a non-admin member on desktop into the member app", async () => {
    renderSignIn();
    useAuth().login.mockResolvedValue({ isPlatformAdmin: false, isAdmin: false });

    fillCredentials("member@example.com", "secret123");
    clickSignIn();

    expect(await screen.findByText("Member home")).toBeDefined();
  });

  it("surfaces the pre-auth 401 as credential feedback and re-enables the form", async () => {
    renderSignIn();
    useAuth().login.mockRejectedValue({
      response: { status: 401, data: {} },
      config: { url: "/auth/login" },
    });

    fillCredentials("sulaimon@example.com", "wrongpassword");
    clickSignIn();

    expect(await screen.findByText("Incorrect email or password.")).toBeDefined();
    // Still on the sign-in form, not bounced anywhere, and free to retry.
    expect(screen.getByText("Sign In To Your Account")).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign In" }).disabled).toBe(false),
    );
  });

  it("shows the submitting state and disables the inputs while login is in flight", async () => {
    renderSignIn();
    const gate = deferred();
    useAuth().login.mockReturnValue(gate.promise);

    fillCredentials("sulaimon@example.com", "secret123");
    clickSignIn();

    expect(screen.getByText("Signing in…")).toBeDefined();
    expect(screen.getByPlaceholderText("Enter your email or number").disabled).toBe(true);

    gate.resolve({ isPlatformAdmin: true, isAdmin: true });
    expect(await screen.findByText("Admin panel")).toBeDefined();
  });

  it("submits a pending community join request before resolving the destination", async () => {
    sessionStorage.setItem("glass_join_community", "glass-community-link");
    submitJoinRequest.mockResolvedValue({ data: {} });
    renderSignIn();
    useAuth().login.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });

    fillCredentials("owner@example.com", "secret123");
    clickSignIn();

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(submitJoinRequest).toHaveBeenCalledWith("glass-community-link");
    // One-shot flag: consumed so a later sign-in can't re-submit it.
    expect(sessionStorage.getItem("glass_join_community")).toBeNull();
  });
});

describe("SignIn pre-auth redirect", () => {
  it("sends an already-verified platform admin to the admin panel, never showing the form", async () => {
    useAuth.mockReturnValue({
      ...useAuth(),
      user: { isPlatformAdmin: true, isAdmin: true },
      token: "verified-token",
      sessionVerified: true,
      isAuthenticated: true,
    });

    renderSignIn();

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(screen.queryByText("Sign In To Your Account")).toBeNull();
  });

  it("sends an already-verified desktop member through the same routing math as a fresh sign-in", async () => {
    useAuth.mockReturnValue({
      ...useAuth(),
      user: { isPlatformAdmin: false, isAdmin: false },
      token: "verified-token",
      sessionVerified: true,
      isAuthenticated: true,
    });

    renderSignIn();

    expect(await screen.findByText("Member home")).toBeDefined();
    expect(screen.queryByText("Sign In To Your Account")).toBeNull();
  });

  it("holds a spinner instead of flashing the form while a stored session restores", () => {
    localStorage.setItem("accessToken", "stored-token");
    useAuth.mockReturnValue({ ...useAuth(), loading: true });

    renderSignIn();

    expect(screen.queryByText("Sign In To Your Account")).toBeNull();
  });

  it("keeps the form for an unauthenticated visitor", () => {
    renderSignIn();

    expect(screen.getByText("Sign In To Your Account")).toBeDefined();
  });
});

describe("SignIn MFA challenge", () => {
  it("verifies the challenge code and completes sign-in via setSession", async () => {
    renderSignIn();
    const auth = useAuth();
    auth.login.mockResolvedValue({ mfaRequired: true, mfaChallengeToken: "challenge-1" });
    verifyMfaLogin.mockResolvedValue({ accessToken: "mfa-token" });
    auth.setSession.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });

    fillCredentials("sulaimon@example.com", "secret123");
    clickSignIn();

    expect(await screen.findByText("Enter MFA Code")).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(verifyMfaLogin).toHaveBeenCalledWith({
      challengeToken: "challenge-1",
      code: "123456",
    });
    expect(auth.setSession).toHaveBeenCalledWith({ accessToken: "mfa-token" });
  });

  it("keeps the user on the challenge screen, clears the code, and explains a rejected code", async () => {
    renderSignIn();
    const auth = useAuth();
    auth.login.mockResolvedValue({ mfaRequired: true, mfaChallengeToken: "challenge-1" });
    verifyMfaLogin.mockRejectedValue({
      response: { status: 400, data: { message: "That code was not valid" } },
    });

    fillCredentials("sulaimon@example.com", "secret123");
    clickSignIn();
    await screen.findByText("Enter MFA Code");

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    expect(await screen.findByText("That code was not valid")).toBeDefined();
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(screen.getByRole("button", { name: "Verify Code" }).disabled).toBe(true);
    expect(auth.setSession).not.toHaveBeenCalled();
  });
});

describe("SignIn MFA recovery-code challenge", () => {
  // A real recovery code is 16 alphanumeric characters, returned to the user
  // in "XXXX-XXXX-XXXX-XXXX" form. The backend normalises what it receives
  // (strips separators, uppercases) before comparing against the stored
  // hash, so these tests pin that the dashed form the user pasted is what
  // gets submitted, normalised.
  const DASHED_CODE = "A1B2-C3D4-E5F6-G7H8";

  // Renders, signs in, and waits for the MFA screen. Deliberately does not
  // touch useAuth() — the mock module is mocked at the boundary so it reads
  // as a hook to the lint rule, and a plain helper calling it would trip
  // rules-of-hooks. Tests that need the auth mock call useAuth() themselves,
  // as the rest of this file already does.
  async function reachChallengeScreen() {
    renderSignIn();
    fillCredentials("sulaimon@example.com", "secret123");
    clickSignIn();
    await screen.findByText("Enter MFA Code");
  }

  beforeEach(() => {
    const auth = useAuth();
    auth.login.mockResolvedValue({ mfaRequired: true, mfaChallengeToken: "challenge-1" });
    auth.setSession.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });
  });

  function switchToRecovery() {
    fireEvent.click(screen.getByRole("button", { name: /Lost access to your authenticator\?/ }));
  }

  it("signs in with a recovery code and submits it normalised", async () => {
    await reachChallengeScreen();
    const auth = useAuth();
    verifyMfaRecoveryCodeLogin.mockResolvedValue({ accessToken: "recovery-token" });

    switchToRecovery();
    expect(await screen.findByText("Use a Recovery Code")).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX"), {
      target: { value: DASHED_CODE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    expect(await screen.findByText("Admin panel")).toBeDefined();
    // Normalised on the way out: separators stripped and uppercased, matching
    // what the backend hashes the code as. The TOTP service must not be used.
    expect(verifyMfaRecoveryCodeLogin).toHaveBeenCalledWith({
      challengeToken: "challenge-1",
      recoveryCode: "A1B2C3D4E5F6G7H8",
    });
    expect(verifyMfaLogin).not.toHaveBeenCalled();
    expect(auth.setSession).toHaveBeenCalledWith({ accessToken: "recovery-token" });
  });

  it("accepts a lowercase pasted code and uppercases it", async () => {
    await reachChallengeScreen();
    verifyMfaRecoveryCodeLogin.mockResolvedValue({ accessToken: "recovery-token" });

    switchToRecovery();
    await screen.findByText("Use a Recovery Code");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX"), {
      target: { value: DASHED_CODE.toLowerCase() },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    await screen.findByText("Admin panel");
    expect(verifyMfaRecoveryCodeLogin).toHaveBeenCalledWith({
      challengeToken: "challenge-1",
      recoveryCode: "A1B2C3D4E5F6G7H8",
    });
  });

  it("keeps the button disabled until a full 16-character code is entered", async () => {
    await reachChallengeScreen();
    switchToRecovery();
    const input = await screen.findByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
    const verify = screen.getByRole("button", { name: "Verify Code" });

    // A TOTP-length entry must not be enough: 6 digits is a valid TOTP code
    // but nowhere near a complete recovery code.
    fireEvent.change(input, { target: { value: "123456" } });
    expect(verify.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "A1B2C3D4E5F6G7" } }); // 15 chars
    expect(verify.disabled).toBe(true);

    fireEvent.change(input, { target: { value: DASHED_CODE } }); // 16 chars
    expect(verify.disabled).toBe(false);
    expect(verifyMfaRecoveryCodeLogin).not.toHaveBeenCalled();
  });

  it("clears a rejected recovery code so a spent one can't be resubmitted", async () => {
    await reachChallengeScreen();
    const auth = useAuth();
    verifyMfaRecoveryCodeLogin.mockRejectedValue({
      response: { status: 400, data: { message: "Invalid recovery code" } },
    });

    switchToRecovery();
    const input = await screen.findByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
    fireEvent.change(input, { target: { value: DASHED_CODE } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    expect(await screen.findByText("Invalid recovery code")).toBeDefined();
    // Cleared: each code is single-use server-side, so leaving it in the box
    // invites a repeat submission of a code that's already been consumed.
    expect(input.value).toBe("");
    expect(screen.getByRole("button", { name: "Verify Code" }).disabled).toBe(true);
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("does not carry the TOTP code across when switching to recovery and back", async () => {
    await reachChallengeScreen();
    verifyMfaRecoveryCodeLogin.mockResolvedValue({ accessToken: "recovery-token" });

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: "123456" } });
    switchToRecovery();
    const input = await screen.findByPlaceholderText("XXXX-XXXX-XXXX-XXXX");

    fireEvent.change(input, { target: { value: DASHED_CODE } });
    fireEvent.click(screen.getByRole("button", { name: /Use my authenticator app instead/ }));

    // Back on TOTP: the previous code is gone, so Verify is disabled again
    // rather than silently re-submitting a stale code.
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(screen.getByRole("button", { name: "Verify Code" }).disabled).toBe(true);
    expect(verifyMfaLogin).not.toHaveBeenCalled();
  });

  it("resets the factor when backing out to the sign-in form", async () => {
    await reachChallengeScreen();
    switchToRecovery();
    await screen.findByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX"), {
      target: { value: DASHED_CODE },
    });

    fireEvent.click(screen.getByRole("button", { name: /Back to sign in/ }));

    // Re-entering the challenge must not reopen on the recovery screen with a
    // half-entered code.
    await screen.findByText("Sign In To Your Account");
    fillCredentials("sulaimon@example.com", "secret123");
    clickSignIn();
    expect(await screen.findByText("Enter MFA Code")).toBeDefined();
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(verifyMfaRecoveryCodeLogin).not.toHaveBeenCalled();
  });
});

describe("SignIn one-time-code mode", () => {
  function switchToOtpMode() {
    fireEvent.click(screen.getByRole("button", { name: "One-Time Code" }));
  }

  it("flags an invalid identifier before requesting a code", () => {
    renderSignIn();
    switchToOtpMode();

    fireEvent.change(screen.getByPlaceholderText("Enter your email or number"), {
      target: { value: "bad@" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(requestLoginOtp).not.toHaveBeenCalled();
  });

  it("requests a code, verifies it, and completes sign-in via setSession", async () => {
    renderSignIn();
    const auth = useAuth();
    requestLoginOtp.mockResolvedValue({
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    verifyLoginOtp.mockResolvedValue({ accessToken: "otp-token" });
    auth.setSession.mockResolvedValue({ isPlatformAdmin: true, isAdmin: true });
    switchToOtpMode();

    fireEvent.change(screen.getByPlaceholderText("Enter your email or number"), {
      target: { value: "Member@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

    expect(await screen.findByText("Enter Your Code")).toBeDefined();
    expect(requestLoginOtp).toHaveBeenCalledWith({ email: "member@example.com" });
    expect(screen.getByRole("button", { name: "Use a different email" }).className).toContain(
      "!px-0",
    );

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & Sign In" }));

    expect(await screen.findByText("Admin panel")).toBeDefined();
    expect(verifyLoginOtp).toHaveBeenCalledWith({
      email: "member@example.com",
      token: "654321",
    });
    expect(auth.setSession).toHaveBeenCalledWith({ accessToken: "otp-token" });
  });

  it("requests a code for a phone identifier as well as an email one", async () => {
    renderSignIn();
    requestLoginOtp.mockResolvedValue({
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    switchToOtpMode();

    fireEvent.change(screen.getByPlaceholderText("Enter your email or number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Code" }));

    expect(await screen.findByText("Enter Your Code")).toBeDefined();
    expect(requestLoginOtp).toHaveBeenCalledWith({ phoneNumber: "+2348012345678" });
  });

  it("stays on the code screen and explains a rejected code", async () => {
    renderSignIn();
    const auth = useAuth();
    requestLoginOtp.mockResolvedValue({
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    verifyLoginOtp.mockRejectedValue({
      response: { status: 400, data: { message: "That code has expired" } },
    });
    switchToOtpMode();

    fireEvent.change(screen.getByPlaceholderText("Enter your email or number"), {
      target: { value: "member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Code" }));
    await screen.findByText("Enter Your Code");

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "111222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & Sign In" }));

    expect(await screen.findByText("That code has expired")).toBeDefined();
    expect(screen.getByText("Enter Your Code")).toBeDefined();
    expect(auth.setSession).not.toHaveBeenCalled();
  });
});
