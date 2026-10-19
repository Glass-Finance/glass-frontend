import { describe, expect, it } from "vitest";
import { usageDate } from "../../utils/communityAiUsage";

describe("AI usage timestamps", () => {
  it.each([
    ["2026-07-01T00:00:00Z", "America/New_York", "Jun 30, 2026", "8:00 PM"],
    ["2026-01-01T00:00:00Z", "America/New_York", "Dec 31, 2025", "7:00 PM"],
    ["2026-01-01T00:00:00Z", "Asia/Kolkata", "Jan 1, 2026", "5:30 AM"],
  ])("formats %s in the profile timezone %s", (instant, timezone, day, time) => {
    const formatted = usageDate(instant, timezone);
    expect(formatted).toContain(day);
    expect(formatted).toContain(time);
  });
  it.each([undefined, null, "", "not/a-timezone", 42])(
    "uses the browser timezone for invalid or missing profile timezone %s",
    (timezone) => {
      const instant = "2026-01-01T00:00:00Z";
      expect(usageDate(instant, timezone)).toBe(usageDate(instant));
    },
  );
  it.each([null, undefined, "not-a-date"])(
    "keeps unavailable timestamps explicit: %s",
    (instant) => {
      expect(usageDate(instant, "America/New_York")).toBe("Unavailable");
    },
  );
});
