import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Component } from "react";
import { MemoryRouter } from "react-router-dom";
import CrispChat from "../../../components/common/CrispChat";
import CrispRouteBridge from "../../../components/common/CrispRouteBridge";

// Deliberately does NOT mock crisp-sdk-web: this exercises the real SDK's
// init-order contract. Crisp.chat.show()/hide() call autoInjectIfNecessary()
// → load(), which throws "websiteId must be set before loading Crisp" until
// CrispChat's mount effect has run Crisp.configure(). On a fresh page load
// that effect ordering is the whole ballgame — if the bridge wins the race,
// the throw used to propagate to the top-level ErrorBoundary in main.jsx and
// replace the entire app with the "Something went wrong" fallback (what
// showed on /sign-in in production).
vi.mock("../../../store/AuthContext.jsx", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("../../../hooks/useCrispToken", () => ({
  useCrispToken: () => ({ data: undefined }),
}));

class CrashBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    return this.state.crashed ? <div role="alert">app crashed</div> : this.props.children;
  }
}

describe("CrispRouteBridge with the real SDK", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CRISP_WEBSITE_ID", "test-website-id");
    vi.useFakeTimers();
    // React logs any effect error it routes to a boundary; silence it so
    // the assertions below are the only signal.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Runs FIRST: the Crisp singleton is shared across this file, and once the
  // chat-first test has configured it, show() no longer throws.
  it("keeps an unconfigured-SDK failure out of the app error boundary", () => {
    expect(() =>
      render(
        <CrashBoundary>
          <MemoryRouter initialEntries={["/dashboard/home"]}>
            <CrispRouteBridge />
          </MemoryRouter>
        </CrashBoundary>,
      ),
    ).not.toThrow();
    expect(screen.queryByRole("alert")).toBeNull();

    // The debounced page-context write must be equally contained.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps an unconfigured-SDK failure contained on sensitive pages too", () => {
    render(
      <CrashBoundary>
        <MemoryRouter initialEntries={["/dashboard/verify-identity"]}>
          <CrispRouteBridge />
        </MemoryRouter>
      </CrashBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Mirrors the main.jsx composition (CrispChat mounted before the bridge's
  // tree): configure's effect flushes first, so show() finds a configured
  // client and the widget command actually lands — chat visible on first
  // load of an allowed page (the landing route), no boundary trip.
  it("shows the widget on first load when the chat mounts before the bridge", () => {
    render(
      <>
        <CrispChat />
        <CrashBoundary>
          <MemoryRouter initialEntries={["/"]}>
            <CrispRouteBridge />
          </MemoryRouter>
        </CrashBoundary>
      </>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.$crisp).toContainEqual(["do", "chat:show"]);
  });
});
