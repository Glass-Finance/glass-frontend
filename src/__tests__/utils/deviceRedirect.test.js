import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isMobileDevice,
  isMobileSession,
  isMarketingHost,
  isAppHost,
  goToApp,
  buildMobileUrl,
  mobileRequiredPath,
  APP_ORIGIN,
} from "../../utils/deviceRedirect";

function setUA(ua) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}
function setWidth(width) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}
function setPointer(coarse) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: coarse });
}

describe("isMobileDevice", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("is true for an iPhone user agent regardless of viewport", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setWidth(1200);
    expect(isMobileDevice()).toBe(true);
  });

  it("treats an iPad as tablet, not mobile, even at a narrow width", () => {
    setUA("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)");
    setWidth(400);
    expect(isMobileDevice()).toBe(false);
  });

  it("treats a plain Android UA (no 'Mobile' token) as tablet, not mobile", () => {
    setUA("Mozilla/5.0 (Linux; Android 13)");
    setWidth(1200);
    expect(isMobileDevice()).toBe(false);
  });

  it("an empty UA with a narrow viewport is mobile regardless of pointer type", () => {
    setUA("");
    setWidth(400);
    setPointer(false);
    expect(isMobileDevice()).toBe(true);
  });

  it("a non-empty desktop UA at a narrow, coarse-pointer viewport is mobile (device simulator)", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setWidth(400);
    setPointer(true);
    expect(isMobileDevice()).toBe(true);
  });

  it("a non-empty desktop UA at a narrow, fine-pointer viewport is NOT mobile", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setWidth(400);
    setPointer(false);
    expect(isMobileDevice()).toBe(false);
  });

  it("a desktop UA at a wide viewport is not mobile", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setWidth(1440);
    expect(isMobileDevice()).toBe(false);
  });
});

describe("isMobileSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("sets the session flag and returns true on a real mobile device", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setWidth(400);
    expect(isMobileSession()).toBe(true);
    expect(sessionStorage.getItem("glass_mobile_verified")).toBe("1");
  });

  it("keeps returning true on a desktop-UA reload as long as the viewport is still narrow and the flag was set", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setWidth(400);
    isMobileSession(); // sets the flag as a real mobile hit

    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setPointer(false);
    expect(isMobileSession()).toBe(true);
  });

  it("stops trusting the cached flag once the viewport is wide again", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setWidth(400);
    isMobileSession();

    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setWidth(1440);
    expect(isMobileSession()).toBe(false);
  });

  it("returns false with no flag set and a non-mobile device", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    setWidth(1440);
    expect(isMobileSession()).toBe(false);
  });
});

describe("host detection + navigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isAppHost is false on the jsdom test origin (not app.glasspay.app)", () => {
    expect(isAppHost()).toBe(false);
  });

  it("buildMobileUrl prefixes the path with APP_ORIGIN", () => {
    // Asserts against the real APP_ORIGIN constant rather than a hardcoded
    // "https://app.glasspay.app" -- that hardcoded version only passed
    // locally because whoever wrote it had VITE_APP_URL set in their own
    // .env, and silently failed anywhere that env var isn't set (CI never
    // sets it for the test step -- see .github/workflows/ci.yml -- so this
    // was failing there regardless of the actual code being correct). The
    // test's job is to verify buildMobileUrl prefixes correctly, not to
    // pin a specific production value that has nothing to do with the
    // prefixing logic itself.
    expect(buildMobileUrl("/member/join?x=1")).toBe(`${APP_ORIGIN}/member/join?x=1`);
  });

  it("mobileRequiredPath encodes the target path as a query param", () => {
    expect(mobileRequiredPath("/member/join?community=abc")).toBe(
      "/member/mobile-required?to=%2Fmember%2Fjoin%3Fcommunity%3Dabc",
    );
  });

  it("isMarketingHost is false on the jsdom test origin, which isn't glasspay.app/www.glasspay.app", () => {
    expect(isMarketingHost()).toBe(false);
  });

  it("goToApp uses ordinary SPA navigation when not on a marketing host", () => {
    const navigate = vi.fn();
    goToApp("/dashboard/home", navigate);
    expect(navigate).toHaveBeenCalledWith("/dashboard/home");
  });
});
