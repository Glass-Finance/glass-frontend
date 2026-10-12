import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../../store/AuthContext";

// Boundary mocking only. AuthContext itself is exercised for real — including
// the real storeAuthSession() -> persistSession() -> localStorage write chain,
// which is precisely what the MFA gate has to be able to PREVENT. That is why
// authService is spread from importActual rather than replaced wholesale: a
// no-op storeAuthSession stub would make "tokens are not persisted" true by
// construction instead of by the gate actually working.
//
// These two are the genuine network boundaries AuthContext reaches through:
// getMe() during buildUser(), and fetchCompleteMyCommunityList() for admin
// standing. Both are asserted call-count 0 on the MFA path, which is how the
// test proves the authenticated-init path was never entered at all.
vi.mock("../../services/authService", async () => {
  const actual = await vi.importActual("../../services/authService");
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    // storeAuthSession is left as the REAL implementation on purpose.
  };
});

vi.mock("../../api/members", () => ({ getMe: vi.fn() }));
vi.mock("../../api/communityList", () => ({ fetchCompleteMyCommunityList: vi.fn() }));

import { login as apiLogin } from "../../services/authService";
import { getMe } from "../../api/members";
import { fetchCompleteMyCommunityList } from "../../api/communityList";

// Published from an effect rather than assigned during render, so the probe
// stays a pure component (react-hooks/globals rejects render-time writes to
// module scope).
const authHolder = { current: null };

function Probe() {
  const ctx = useAuth();
  useEffect(() => {
    authHolder.current = ctx;
  });
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="token">{ctx.token ?? "none"}</div>
      <div data-testid="verified">{String(ctx.sessionVerified)}</div>
      <div data-testid="user">{ctx.user?.id ?? "none"}</div>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(["seeded"], { keep: true });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

const MFA_RESPONSE = {
  mfaRequired: true,
  mfaChallengeToken: "challenge-abc",
  // Deliberately carries no identity: if the gate ever fell through to the
  // normal path, buildUser() would immediately try to resolve these and the
  // getMe/network assertions below would trip.
};

const SESSION_RESPONSE = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  userId: "u1",
  email: "u1@example.com",
  platformRole: "USER",
  emailVerified: true,
};

describe("AuthContext.login() MFA gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    authHolder.current = null;
  });

  it("returns the challenge and stores NOTHING when the backend demands MFA", async () => {
    apiLogin.mockResolvedValue(MFA_RESPONSE);
    getMe.mockResolvedValue({ data: { data: { id: "u1" } } });
    fetchCompleteMyCommunityList.mockResolvedValue([]);

    const { queryClient } = renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    let result;
    await act(async () => {
      result = await authHolder.current.login({ email: "u1@example.com", password: "pw" });
    });

    // 1. The challenge is handed back verbatim, and nothing else.
    expect(result).toEqual({ mfaRequired: true, mfaChallengeToken: "challenge-abc" });
    expect(result.user).toBeUndefined();

    // 2. No token of any kind was persisted. These go through the real
    //    persistSession() write chain — nothing was stubbed away.
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("userId")).toBeNull();
    expect(localStorage.getItem("userEmail")).toBeNull();

    // 3. No user object was persisted or produced.
    expect(localStorage.getItem("glass_user")).toBeNull();

    // 4. The authenticated-session init path was never entered: buildUser()
    //    (which calls getMe + the community walk) never ran.
    expect(getMe).not.toHaveBeenCalled();
    expect(fetchCompleteMyCommunityList).not.toHaveBeenCalled();

    // 5. React state stays unauthenticated and unverified, so route guards
    //    fail closed rather than treating a half-authenticated user as in.
    expect(screen.getByTestId("token").textContent).toBe("none");
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("verified").textContent).toBe("false");
    expect(authHolder.current.isAuthenticated).toBe(false);

    // 6. The cache was not cleared either — login() owns that, and it never ran.
    expect(queryClient.getQueryData(["seeded"])).toEqual({ keep: true });
  });

  it("never persists tokens even when the MFA response also carries them", async () => {
    // Defence in depth: a backend that (or a regression that) starts echoing
    // tokens alongside the challenge must still not create a usable session.
    apiLogin.mockResolvedValue({
      ...MFA_RESPONSE,
      accessToken: "should-not-be-stored",
      refreshToken: "should-not-be-stored",
      userId: "u1",
      email: "u1@example.com",
      platformRole: "USER",
    });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    let result;
    await act(async () => {
      result = await authHolder.current.login({ email: "u1@example.com", password: "pw" });
    });

    expect(result.mfaRequired).toBe(true);
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("glass_user")).toBeNull();
    expect(screen.getByTestId("verified").textContent).toBe("false");
  });

  it("an explicit mfaRequired:false still takes the normal authenticated path", async () => {
    // Pins that the gate is a strict truthiness check on the flag, not an
    // inverted or "always gate" condition.
    apiLogin.mockResolvedValue({ ...SESSION_RESPONSE, mfaRequired: false });
    getMe.mockResolvedValue({ data: { data: { id: "u1" } } });
    fetchCompleteMyCommunityList.mockResolvedValue([]);

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    let user;
    await act(async () => {
      user = await authHolder.current.login({ email: "u1@example.com", password: "pw" });
    });

    expect(user.id).toBe("u1");
    expect(localStorage.getItem("accessToken")).toBe("access-1");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-1");
    expect(screen.getByTestId("token").textContent).toBe("access-1");
    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));
    expect(JSON.parse(localStorage.getItem("glass_user")).id).toBe("u1");
  });

  it("a normal login with no mfaRequired field is unchanged", async () => {
    // The overwhelmingly common backend shape — the flag is simply absent.
    apiLogin.mockResolvedValue(SESSION_RESPONSE);
    getMe.mockResolvedValue({ data: { data: { id: "u1" } } });
    fetchCompleteMyCommunityList.mockResolvedValue([]);

    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    let user;
    await act(async () => {
      user = await authHolder.current.login({ email: "u1@example.com", password: "pw" });
    });

    expect(user.mfaRequired).toBeUndefined();
    expect(user.isAdmin).toBe(false);
    expect(localStorage.getItem("accessToken")).toBe("access-1");
    expect(screen.getByTestId("token").textContent).toBe("access-1");
    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));
  });
});
