import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosSafari, isStandaloneDisplay } from "../../utils/pwaInstall";

const originalUserAgent = navigator.userAgent;
const originalPlatform = navigator.platform;
const originalMaxTouchPoints = navigator.maxTouchPoints;

function setNavigator({ userAgent, platform = "iPhone", maxTouchPoints = 1 }) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

afterEach(() => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: originalPlatform });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: originalMaxTouchPoints,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PWA install platform detection", () => {
  it("recognizes iPhone Safari", () => {
    setNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    });

    expect(isIosSafari()).toBe(true);
  });

  it("recognizes iPadOS using a desktop-style user agent", () => {
    setNavigator({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });

    expect(isIosSafari()).toBe(true);
  });

  it("does not show Safari instructions in iOS Chrome", () => {
    setNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
    });

    expect(isIosSafari()).toBe(false);
  });

  it("detects standalone display mode", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    expect(isStandaloneDisplay()).toBe(true);
  });
});
