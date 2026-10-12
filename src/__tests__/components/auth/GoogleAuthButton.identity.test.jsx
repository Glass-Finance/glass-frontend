import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton";
import { clearSessionStorage } from "../../../store/sessionStorage";

// F6-3: the cached Google identity is privacy/session-isolation state, not an
// authorization mechanism. It must die with the session that created it, and
// it must only ever be written by a sign-in that fully succeeded.
const { googleAuthMock, setSessionMock, notifyErrorMock, onAuthenticatedMock } = vi.hoisted(() => ({
  googleAuthMock: vi.fn(),
  setSessionMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  onAuthenticatedMock: vi.fn(),
}));

const { useGoogleOAuthMock } = vi.hoisted(() => ({
  useGoogleOAuthMock: vi.fn(),
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleOAuth: useGoogleOAuthMock,
}));

vi.mock("../../../services/authService", () => ({ googleAuth: googleAuthMock }));

vi.mock("../../../store/AuthContext", () => ({
  useAuth: () => ({ setSession: setSessionMock }),
}));

vi.mock("../../../utils/errorHandler", () => ({ notifyError: notifyErrorMock }));

const IDENTITY_KEY = "glass_last_google_identity";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// The component's callback is registered through Google's SDK shim, so tests
// capture it here and invoke it exactly as Google would.
let googleCallback;

function makeCredential(claims) {
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return [b64url({ alg: "none", typ: "JWT" }), b64url(claims), "signature"].join(".");
}

const CLAIMS = {
  email: "user-b@example.com",
  picture: "https://example.com/b.png",
  name: "User B",
};

async function renderButton() {
  const utils = render(<GoogleAuthButton onAuthenticated={onAuthenticatedMock} />);
  await waitFor(() => expect(typeof googleCallback).toBe("function"));
  return utils;
}

async function clickGoogle(credential) {
  await act(async () => {
    await googleCallback({ credential });
  });
}

describe("F6-3 — cached Google identity isolation", () => {
  let originalResizeObserver;
  let originalGoogle;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    googleCallback = undefined;
    useGoogleOAuthMock.mockReturnValue({
      clientId: "test-client-id",
      scriptLoadedSuccessfully: true,
    });

    // jsdom implements neither of these.
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    originalGoogle = window.google;
    window.google = {
      accounts: {
        id: {
          initialize: (opts) => {
            googleCallback = opts.callback;
          },
          renderButton: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    window.google = originalGoogle;
  });

  it("renders the returning-user label while the cached identity is valid, then clears it on session end", async () => {
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        email: "user-a@example.com",
        picture: null,
        name: "User A",
        cachedAt: Date.now(),
      }),
    );

    const first = render(<GoogleAuthButton />);
    expect(screen.queryByText(/Continue as User A/)).not.toBeNull();
    first.unmount();

    clearSessionStorage();

    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
    render(<GoogleAuthButton />);
    // A fresh visitor gets the generic label — not the last user's identity.
    expect(screen.queryByText(/Continue as/)).toBeNull();
    expect(screen.queryByText("Continue with Google")).not.toBeNull();
  });

  it("does not cache the identity when the backend rejects the credential", async () => {
    await renderButton();
    googleAuthMock.mockRejectedValue(new Error("invalid credential"));

    await clickGoogle(makeCredential(CLAIMS));

    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(onAuthenticatedMock).not.toHaveBeenCalled();
    // Existing error handling is preserved.
    expect(notifyErrorMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Continue as/)).toBeNull();
  });

  it("does not cache the identity when setSession fails after a good credential", async () => {
    await renderButton();
    googleAuthMock.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    setSessionMock.mockRejectedValue(new Error("hydration failed"));

    await clickGoogle(makeCredential(CLAIMS));

    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
    expect(onAuthenticatedMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalledTimes(1);
  });

  it("caches the identity after a fully successful sign-in", async () => {
    await renderButton();
    googleAuthMock.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    setSessionMock.mockResolvedValue({ id: "u1", email: CLAIMS.email });

    await clickGoogle(makeCredential(CLAIMS));

    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY));
    expect(stored).toMatchObject({
      email: CLAIMS.email,
      picture: CLAIMS.picture,
      name: CLAIMS.name,
    });
    expect(stored.cachedAt).toBeTypeOf("number");
    expect(setSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthenticatedMock).toHaveBeenCalledWith({ id: "u1", email: CLAIMS.email });
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("still expires a stale identity after the 7-day TTL when no session end intervened", async () => {
    // The TTL covers the never-logged-out case and must survive this change.
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        email: "gone@example.com",
        picture: null,
        name: "Gone",
        cachedAt: Date.now() - SEVEN_DAYS - 1000,
      }),
    );

    render(<GoogleAuthButton />);

    expect(screen.queryByText(/Continue as/)).toBeNull();
    expect(localStorage.getItem(IDENTITY_KEY)).toBeNull();
  });
});

describe("GIS configuration/loading failures", () => {
  let originalResizeObserver;
  let originalGoogle;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    googleCallback = undefined;

    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    originalGoogle = window.google;
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    window.google = originalGoogle;
  });

  it("shows an error and does not initialize GIS when clientId is missing", () => {
    useGoogleOAuthMock.mockReturnValue({ clientId: "", scriptLoadedSuccessfully: false });
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton: vi.fn(),
        },
      },
    };

    render(<GoogleAuthButton />);

    expect(screen.queryByText(/temporarily unavailable/)).not.toBeNull();
    expect(window.google.accounts.id.initialize).not.toHaveBeenCalled();
    expect(window.google.accounts.id.renderButton).not.toHaveBeenCalled();
  });

  it("shows an error and does not initialize GIS when clientId is whitespace-only", () => {
    useGoogleOAuthMock.mockReturnValue({ clientId: "   ", scriptLoadedSuccessfully: false });
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton: vi.fn(),
        },
      },
    };

    render(<GoogleAuthButton />);

    expect(screen.queryByText(/temporarily unavailable/)).not.toBeNull();
    expect(window.google.accounts.id.initialize).not.toHaveBeenCalled();
  });

  it("shows an error and notifies when GIS initialization throws", () => {
    useGoogleOAuthMock.mockReturnValue({
      clientId: "test-client-id",
      scriptLoadedSuccessfully: true,
    });
    window.google = {
      accounts: {
        id: {
          initialize: () => {
            throw new Error("GIS init failed");
          },
          renderButton: vi.fn(),
        },
      },
    };

    render(<GoogleAuthButton />);

    expect(screen.queryByText(/failed to load/)).not.toBeNull();
    expect(notifyErrorMock).toHaveBeenCalledTimes(1);
    expect(window.google.accounts.id.renderButton).not.toHaveBeenCalled();
  });

  it("renders the button normally when GIS loads and initializes successfully", () => {
    useGoogleOAuthMock.mockReturnValue({
      clientId: "test-client-id",
      scriptLoadedSuccessfully: true,
    });
    const initializeMock = vi.fn((opts) => {
      googleCallback = opts.callback;
    });
    const renderButtonMock = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
        },
      },
    };

    render(<GoogleAuthButton />);

    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    expect(screen.queryByText(/failed to load/)).toBeNull();
    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(renderButtonMock).toHaveBeenCalledTimes(1);
  });

  // Regression: initialize() and renderButton() used to share one effect that
  // depended on the ResizeObserver-measured `width`, so every resize re-ran
  // initialize(). Google logs "initialize() is called multiple times" and only
  // keeps the last instance -- the previously registered callback is dropped.
  // The button is sized to `width`, so renderButton() must keep re-running on
  // resize; initialize() must not.
  it("re-renders the button on resize but does not re-initialize the client", () => {
    useGoogleOAuthMock.mockReturnValue({
      clientId: "test-client-id",
      scriptLoadedSuccessfully: true,
    });
    let resizeCallback;
    window.ResizeObserver = class {
      constructor(cb) {
        resizeCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const initializeMock = vi.fn((opts) => {
      googleCallback = opts.callback;
    });
    const renderButtonMock = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
        },
      },
    };

    render(<GoogleAuthButton />);

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(renderButtonMock).toHaveBeenCalledTimes(1);

    // The container is now a different measured width (rotation, sidebar,
    // window drag) -- Google's SDK replaces the container contents in place,
    // so this has to happen.
    act(() => {
      resizeCallback([{ contentRect: { width: 512 } }]);
    });

    expect(renderButtonMock).toHaveBeenCalledTimes(2);
    expect(renderButtonMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ width: "512" }),
    );
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it("still calls googleAuth with the credential JWT on successful sign-in", async () => {
    useGoogleOAuthMock.mockReturnValue({
      clientId: "test-client-id",
      scriptLoadedSuccessfully: true,
    });
    const initializeMock = vi.fn((opts) => {
      googleCallback = opts.callback;
    });
    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: vi.fn(),
        },
      },
    };

    render(<GoogleAuthButton onAuthenticated={onAuthenticatedMock} />);
    await waitFor(() => expect(typeof googleCallback).toBe("function"));

    googleAuthMock.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
    setSessionMock.mockResolvedValue({ id: "u1", email: CLAIMS.email });

    await act(async () => {
      await googleCallback({ credential: makeCredential(CLAIMS) });
    });

    expect(googleAuthMock).toHaveBeenCalledWith({ clientToken: makeCredential(CLAIMS) });
    expect(setSessionMock).toHaveBeenCalledTimes(1);
    expect(onAuthenticatedMock).toHaveBeenCalledWith({ id: "u1", email: CLAIMS.email });
  });
});
