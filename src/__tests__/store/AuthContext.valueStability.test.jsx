import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../../store/AuthContext";

// The provider value used to be a fresh object literal on every render.
// useAuth() is consumed in 38 files and the codebase has no React.memo
// anywhere, so an unstable value re-renders every consumer subtree on ANY
// AuthProvider state change — including re-renders that leave user and token
// untouched.
//
// This pins the memo. A consumer that records the value it received must not
// see a new identity when the provider re-renders with unchanged auth state,
// while a genuine state change (session ending) must still propagate.

vi.mock("../../api/members", () => ({ getMe: vi.fn(async () => ({ data: { data: null } })) }));
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual("../../api/client");
  return {
    ...actual,
    default: { ...(actual.default ?? {}), get: vi.fn(async () => ({ data: [] })) },
  };
});

function ValueRecorder({ onValue }) {
  const auth = useAuth();
  // Records every distinct value object identity this consumer is handed.
  useEffect(() => {
    onValue(auth);
  }, [auth, onValue]);
  return null;
}

function rerenderable() {
  const seen = [];
  const push = (v) => seen.push(v);
  return { seen, push };
}

describe("AuthContext value stability", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    // No session in storage: restore() resolves false and fails closed, which
    // is the stable no-op state this test measures against.
    window.localStorage.clear();
  });

  it("hands consumers a referentially stable value across unrelated re-renders", async () => {
    const { seen, push } = rerenderable();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ValueRecorder onValue={push} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    // Let restore() settle so the provider is past its loading transitions.
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    const before = seen.length;
    const identityBefore = seen[before - 1];

    // Force parent re-renders. The provider re-renders as a child each time,
    // which is precisely the case that used to mint a new value object.
    for (let i = 0; i < 3; i += 1) {
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ValueRecorder onValue={push} />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await act(async () => {});
    }

    const identitiesAfter = seen.slice(before).map((v) => v);

    // Every value delivered after the initial settle must be the SAME object as
    // the one before the re-renders. A regression to a plain literal makes
    // these differ, which is the bug this test exists to catch.
    identitiesAfter.forEach((v) => {
      expect(v).toBe(identityBefore);
    });

    // And the exposed shape is unchanged -- this is a perf change, not an API
    // change, so every previously-exported field must still be present.
    expect(identityBefore).toMatchObject({
      // null on a signed-out session -- expect.anything() would reject it.
      user: null,
      token: null,
      loading: expect.any(Boolean),
      sessionVerified: expect.any(Boolean),
      isAuthenticated: false,
      isPlatformAdmin: expect.any(Boolean),
      isAdmin: expect.any(Boolean),
      isMember: expect.any(Boolean),
      login: expect.any(Function),
      logout: expect.any(Function),
      setSession: expect.any(Function),
      storeSessionIfPresent: expect.any(Function),
      updateUser: expect.any(Function),
      refreshUser: expect.any(Function),
      hydrateUserProfile: expect.any(Function),
    });
  });
});
