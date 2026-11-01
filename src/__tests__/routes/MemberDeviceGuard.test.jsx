import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import MemberDeviceGuard from "../../routes/MemberDeviceGuard";

// deviceRedirect's isMobileSession()/mobileRequiredPath() internals are already
// unit-tested in utils/deviceRedirect.test.js — these tests cover only the
// guard's own contract: verified mobile sessions render the member Outlet,
// everything else is handed to the mobile-required screen with the FULL
// original target (pathname + query string) preserved in ?to=.
// The guard is synchronous — it reads session state, so there is deliberately
// no loading state to cover.

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
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

function MobileRequiredMarker() {
  const location = useLocation();
  return <div data-testid="mobile-required">{location.pathname + location.search}</div>;
}

function renderGuarded(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<MemberDeviceGuard />}>
          <Route path="/member/home" element={<div>Member home</div>} />
          <Route path="/member/transactions" element={<div>Member transactions</div>} />
        </Route>
        <Route path="/member/mobile-required" element={<MobileRequiredMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  setUA(ORIGINAL_UA);
  setWidth(ORIGINAL_WIDTH);
});

describe("MemberDeviceGuard", () => {
  it("lets a mobile session through to the guarded outlet", async () => {
    setUA(IPHONE_UA);
    setWidth(1440); // device check is UA-primary; width is irrelevant here

    renderGuarded("/member/home");

    expect(await screen.findByText("Member home")).toBeDefined();
    expect(screen.queryByTestId("mobile-required")).toBeNull();
  });

  it("redirects a desktop session to the mobile-required screen with path and query preserved", async () => {
    setUA(DESKTOP_UA);
    setWidth(1440);

    renderGuarded("/member/transactions?ref=abc");

    const marker = await screen.findByTestId("mobile-required");
    expect(marker.textContent).toBe(
      "/member/mobile-required?to=%2Fmember%2Ftransactions%3Fref%3Dabc",
    );
    // The guarded content must never render for a blocked device.
    expect(screen.queryByText("Member transactions")).toBeNull();
  });

  it("redirects a desktop session with no query string to a path-only target", async () => {
    setUA(DESKTOP_UA);
    setWidth(1440);

    renderGuarded("/member/home");

    const marker = await screen.findByTestId("mobile-required");
    expect(marker.textContent).toBe("/member/mobile-required?to=%2Fmember%2Fhome");
    expect(screen.queryByText("Member home")).toBeNull();
  });
});
