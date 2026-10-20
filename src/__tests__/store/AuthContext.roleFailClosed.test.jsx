import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../../store/AuthContext";

vi.mock("../../api/members", () => ({
  getMe: vi.fn(),
}));

vi.mock("../../api/communityList", () => ({
  fetchCompleteMyCommunityList: vi.fn(),
}));

import { getMe } from "../../api/members";
import { fetchCompleteMyCommunityList } from "../../api/communityList";

function Probe() {
  const ctx = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="verified">{String(ctx.sessionVerified)}</div>
      <div data-testid="role">{ctx.user?.role ?? "none"}</div>
      <div data-testid="isPlatformAdmin">{String(ctx.isPlatformAdmin)}</div>
      <div data-testid="isAdmin">{String(ctx.isAdmin)}</div>
      <button
        type="button"
        data-testid="patch"
        onClick={() => ctx.updateUser({ firstName: "Renamed", isAdmin: true, role: "SUPER_ADMIN" })}
      >
        patch
      </button>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

/** A /user/me response that carries no platformRole. */
function profileWithoutRole(overrides = {}) {
  return {
    data: {
      data: {
        id: "u1",
        email: "user@example.com",
        userData: { firstName: "Test", lastName: "User" },
        ...overrides,
      },
    },
  };
}

describe("AuthContext — role standing fails closed", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    fetchCompleteMyCommunityList.mockResolvedValue([]);
  });

  it("does not fall back to the cached role when the server omits platformRole", async () => {
    // The cached `glass_user` snapshot is client-writable. If a tampered
    // role in it were used as the fallback, a server response that omits
    // platformRole would hand platform-admin standing to whoever edited
    // localStorage — and the hydration that does it is the same one that
    // keeps `sessionVerified` true, so the guard would render the admin
    // shell on it.
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("refreshToken", "rt");
    localStorage.setItem(
      "glass_user",
      JSON.stringify({
        id: "u1",
        role: "SUPER_ADMIN",
        isAdmin: true,
        isPlatformAdmin: true,
      }),
    );
    getMe.mockResolvedValue(profileWithoutRole());

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("isPlatformAdmin").textContent).toBe("false");
    expect(screen.getByTestId("isAdmin").textContent).toBe("false");
  });

  it("uses the server's role when the server does send one", async () => {
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("refreshToken", "rt");
    localStorage.setItem("glass_user", JSON.stringify({ id: "u1", role: "USER" }));
    getMe.mockResolvedValue(profileWithoutRole({ platformRole: "SUPER_ADMIN" }));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));
    expect(screen.getByTestId("role").textContent).toBe("SUPER_ADMIN");
    expect(screen.getByTestId("isPlatformAdmin").textContent).toBe("true");
  });

  it("never grants platform standing for an unknown role code", async () => {
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("refreshToken", "rt");
    getMe.mockResolvedValue(profileWithoutRole({ platformRole: "SUPPORT_AGENT" }));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));
    // SUPPORT_AGENT is a legitimate backend platform role, but it is not in
    // the full-admin set — unknown/unmatched codes fail closed.
    expect(screen.getByTestId("isPlatformAdmin").textContent).toBe("false");
  });

  it("strips privilege fields out of an updateUser patch", async () => {
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("refreshToken", "rt");
    localStorage.setItem("glass_user", JSON.stringify({ id: "u1", role: "USER" }));
    getMe.mockResolvedValue(profileWithoutRole({ platformRole: "USER" }));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("verified").textContent).toBe("true"));

    await act(async () => {
      screen.getByTestId("patch").click();
    });

    // The ordinary field went through…
    expect(screen.getByTestId("role").textContent).toBe("USER");
    // …and the privilege fields did not, even though the patch carried them.
    expect(screen.getByTestId("isPlatformAdmin").textContent).toBe("false");
    expect(screen.getByTestId("isAdmin").textContent).toBe("false");

    const stored = JSON.parse(localStorage.getItem("glass_user"));
    expect(stored.role).toBe("USER");
    expect(stored.isAdmin).toBe(false);
    expect(stored.isPlatformAdmin).toBe(false);
  });
});
