import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import { useAuth } from "../store/AuthContext";

// App.jsx wires every route, guard, and lazy page boundary but had zero
// coverage. These tests exercise only critical wiring — a public auth route
// resolving through Suspense, the catch-all, the admin guard's redirect, the
// member join device gate, and the member auth guard — NOT every rendered page
// (each page's own behavior belongs to its own test file). Guards' internal
// decisions are already covered in routes/guards.test.jsx; this pins that
// App actually mounts them where the comments say it does.
vi.mock("../store/AuthContext", () => ({ useAuth: vi.fn() }));
// GoogleAuthButton needs a real GoogleOAuthProvider to mount.
vi.mock("../components/auth/GoogleAuthButton", () => ({
  default: () => <div data-testid="google-auth-button" />,
}));
// MobileRequired draws a QR onto <canvas>; stubbed to expose the URL it was
// given (same approach as CheckEmail.test.jsx).
vi.mock("../components/common/QRCodeCanvas", () => ({
  default: ({ value }) => <div data-testid="qr-value">{value}</div>,
}));

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const ORIGINAL_UA = window.navigator.userAgent;
const ORIGINAL_WIDTH = window.innerWidth;

function setUA(ua) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}
function setWidth(width) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

// App owns its own BrowserRouter, so each test seeds window.location before
// rendering. Default session: authenticated=false (see ProtectedRoute's
// contract — loading false, no token, session unverified).
function renderAt(path) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  vi.clearAllMocks();
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
});

// Every route asserted below sits behind a `lazy()` boundary, so these
// assertions are waiting on `await import(...)` to resolve and the chunk to
// render -- not merely on a paint. The 5s that used to be inlined here is
// Testing Library's own default and is INDEPENDENT of the suite-wide
// `testTimeout` (15s, vite.config.js): raising `testTimeout` does not raise a
// `findBy*` wait. Under full-suite parallelism the sign-in chunk alone took
// 3.6-5.5s, so these sat on the boundary and failed intermittently purely as a
// function of how many other files happened to be running. Match the
// repository convention rather than a second, smaller one.
//
// Only the wait budget changes; the queries and their failure messages are
// untouched.
const LAZY_ROUTE_TIMEOUT = 15000;

describe("App public routes", () => {
  it("renders the lazy sign-in page for a public auth route", async () => {
    renderAt("/sign-in");

    expect(
      await screen.findByText("Sign In To Your Account", {}, { timeout: LAZY_ROUTE_TIMEOUT }),
    ).toBeDefined();
  });

  it("renders the catch-all NotFound page for an unknown path", async () => {
    renderAt("/definitely/not/a/route");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Page not found" },
        { timeout: LAZY_ROUTE_TIMEOUT },
      ),
    ).toBeDefined();
  });
});

describe("App protected route integration", () => {
  it("bounces an unauthenticated visitor off the admin dashboard to sign-in", async () => {
    renderAt("/dashboard/home");

    await waitFor(() => expect(window.location.pathname).toBe("/sign-in"));
    expect(
      await screen.findByText("Sign In To Your Account", {}, { timeout: LAZY_ROUTE_TIMEOUT }),
    ).toBeDefined();
  });

  it("keeps the member app behind authentication on desktop", async () => {
    renderAt("/member/home");

    await waitFor(() => expect(window.location.pathname).toBe("/member/app-sign-in"));
    expect(
      await screen.findByText("Sign In To Your Account", {}, { timeout: LAZY_ROUTE_TIMEOUT }),
    ).toBeDefined();
  });

  it("keeps desktop member registration device-gated", async () => {
    renderAt("/member/join");

    await waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe(
        "/member/mobile-required?to=%2Fmember%2Fjoin",
      ),
    );
  });

  it("bounces a signed-out mobile session to member sign-in", async () => {
    setUA(IPHONE_UA);
    renderAt("/member/home");

    // Device gate passes (mobile UA), MemberProtectedRoute rejects: no token.
    await waitFor(() => expect(window.location.pathname).toBe("/member/app-sign-in"));
    expect(
      await screen.findByText("Sign In To Your Account", {}, { timeout: LAZY_ROUTE_TIMEOUT }),
    ).toBeDefined();
  });
});
