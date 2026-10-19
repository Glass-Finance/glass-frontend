import { describe, it, expect } from "vitest";
import {
  formatNaira,
  formatNairaCompact,
  toTitleCase,
  toPascalCaseName,
  formatDate,
  formatDateShort,
  formatDateLong,
  formatRelativeDateTime,
  dayLabel,
  formatDateTime,
} from "../../utils/format";

describe("formatNaira", () => {
  it("formats a whole number with the naira sign and no decimals by default", () => {
    expect(formatNaira(12000)).toBe("₦12,000");
  });

  it("defaults null/undefined to ₦0", () => {
    expect(formatNaira(null)).toBe("₦0");
    expect(formatNaira(undefined)).toBe("₦0");
  });

  it("supports 2-decimal precision for receipts", () => {
    expect(formatNaira(12000, { decimals: 2 })).toBe("₦12,000.00");
  });

  it("renders a dash for null/undefined when emptyDash is set", () => {
    expect(formatNaira(null, { emptyDash: true })).toBe("—");
    expect(formatNaira(undefined, { emptyDash: true })).toBe("—");
  });

  it("does not apply emptyDash to a real zero amount", () => {
    expect(formatNaira(0, { emptyDash: true })).toBe("₦0");
  });

  it("divides by 100 when minor is set (kobo -> naira)", () => {
    expect(formatNaira(1_200_000, { minor: true })).toBe("₦12,000");
  });

  it("does not divide when minor is false (the default)", () => {
    expect(formatNaira(1_200_000)).toBe("₦1,200,000");
  });

  it("combines minor with decimals for a fractional kobo remainder", () => {
    expect(formatNaira(1_234_567, { minor: true, decimals: 2 })).toBe("₦12,345.67");
  });
});

describe("formatNairaCompact", () => {
  it("abbreviates millions", () => {
    expect(formatNairaCompact(4_800_000)).toBe("₦4.80M");
  });

  it("abbreviates thousands", () => {
    expect(formatNairaCompact(4_800)).toBe("₦4.8K");
  });

  it("falls back to standard formatting below the K threshold", () => {
    expect(formatNairaCompact(500)).toBe("₦500");
  });

  it("returns a dash for null/undefined/NaN", () => {
    expect(formatNairaCompact(null)).toBe("—");
    expect(formatNairaCompact(undefined)).toBe("—");
    expect(formatNairaCompact("not a number")).toBe("—");
  });
});

describe("toTitleCase", () => {
  it("capitalizes the first letter of every word", () => {
    expect(toTitleCase("associate amount")).toBe("Associate Amount");
  });

  it("passes through falsy values unchanged", () => {
    expect(toTitleCase("")).toBe("");
    expect(toTitleCase(null)).toBe(null);
    expect(toTitleCase(undefined)).toBe(undefined);
  });
});

describe("toPascalCaseName", () => {
  it("capitalizes the first letter of each name part", () => {
    expect(toPascalCaseName("cynthia ee")).toBe("Cynthia Ee");
    expect(toPascalCaseName("robert")).toBe("Robert");
    expect(toPascalCaseName("john doe")).toBe("John Doe");
    expect(toPascalCaseName("alex john smith")).toBe("Alex John Smith");
    expect(toPascalCaseName("vanessa")).toBe("Vanessa");
  });

  it("lowercases the tail of each part", () => {
    expect(toPascalCaseName("ROBERT")).toBe("Robert");
    expect(toPascalCaseName("cynthia EE")).toBe("Cynthia Ee");
  });

  it("preserves names with apostrophes untouched", () => {
    expect(toPascalCaseName("O'Shea")).toBe("O'Shea");
    expect(toPascalCaseName("O'CONNOR")).toBe("O'CONNOR");
    expect(toPascalCaseName("d'artagnan")).toBe("d'artagnan");
  });

  it("preserves names with accented characters untouched", () => {
    expect(toPascalCaseName("maría")).toBe("maría");
    expect(toPascalCaseName("josé")).toBe("josé");
    expect(toPascalCaseName("renée")).toBe("renée");
  });

  it("trims and collapses internal whitespace", () => {
    expect(toPascalCaseName("  john   doe  ")).toBe("John Doe");
  });

  it("leaves already-PascalCase names alone", () => {
    expect(toPascalCaseName("Robert")).toBe("Robert");
    expect(toPascalCaseName("John Doe")).toBe("John Doe");
  });

  it("passes through falsy values unchanged", () => {
    expect(toPascalCaseName("")).toBe("");
    expect(toPascalCaseName(null)).toBe(null);
    expect(toPascalCaseName(undefined)).toBe(undefined);
  });

  it("does not touch toTitleCase -- acronyms and brands must survive", () => {
    // These share the module with names but are NOT names; toTitleCase keeps
    // its original uppercase-preserving behavior.
    expect(toTitleCase("MTN")).toBe("MTN");
    expect(toTitleCase("ATM")).toBe("ATM");
    expect(toTitleCase("USD")).toBe("USD");
  });
});

describe("formatDate", () => {
  it("formats with a short month name and full year", () => {
    expect(formatDate("2026-07-11T00:00:00.000Z")).toMatch(/\d{1,2} Jul 2026/);
  });

  it("returns a dash for a missing date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatDateShort", () => {
  it("formats with a short month name and no year", () => {
    expect(formatDateShort("2026-07-11T00:00:00.000Z")).toMatch(/^\d{1,2} Jul$/);
  });

  it("returns a dash for a missing date", () => {
    expect(formatDateShort(null)).toBe("—");
    expect(formatDateShort(undefined)).toBe("—");
  });
});

describe("formatDateLong", () => {
  it("formats with a full month name", () => {
    expect(formatDateLong("2026-07-11T00:00:00.000Z")).toMatch(/July/);
  });

  it("returns a dash for a missing date", () => {
    expect(formatDateLong(null)).toBe("—");
  });
});

describe("formatRelativeDateTime", () => {
  it("labels a timestamp from today as 'Today'", () => {
    expect(formatRelativeDateTime(new Date().toISOString())).toMatch(/^Today /);
  });

  it("labels a timestamp from yesterday as 'Yesterday'", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDateTime(yesterday.toISOString())).toMatch(/^Yesterday /);
  });

  it("falls back to a dated format further back", () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 8);
    const result = formatRelativeDateTime(lastWeek.toISOString());
    expect(result).not.toMatch(/^Today|^Yesterday/);
  });

  it("returns an empty string for a missing date", () => {
    expect(formatRelativeDateTime(null)).toBe("");
    expect(formatRelativeDateTime(undefined)).toBe("");
  });
});

describe("dayLabel", () => {
  it("labels today as 'Today'", () => {
    expect(dayLabel(new Date().toISOString())).toBe("Today");
  });

  it("labels yesterday as 'Yesterday'", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayLabel(yesterday.toISOString())).toBe("Yesterday");
  });

  it("labels a date within the last 7 days as 'This Week'", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(dayLabel(threeDaysAgo.toISOString())).toBe("This Week");
  });

  it("falls back to a full weekday/date for anything older than a week", () => {
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const result = dayLabel(lastMonth.toISOString());
    expect(result).not.toMatch(/^Today$|^Yesterday$|^This Week$/);
  });

  it("returns 'Earlier' for a missing date", () => {
    expect(dayLabel(null)).toBe("Earlier");
    expect(dayLabel(undefined)).toBe("Earlier");
  });
});

// The AI-usage screens render allowance timestamps in the reader's own
// timezone, so the same instant reads differently for two people. These cases
// were moved here from a feature-named module when the formatter moved into
// this one.
describe("formatDateTime", () => {
  it.each([
    ["2026-07-01T00:00:00Z", "America/New_York", "Jun 30, 2026", "8:00 PM"],
    ["2026-01-01T00:00:00Z", "America/New_York", "Dec 31, 2025", "7:00 PM"],
    ["2026-01-01T00:00:00Z", "Asia/Kolkata", "Jan 1, 2026", "5:30 AM"],
  ])("formats %s in the profile timezone %s", (instant, timezone, day, time) => {
    const formatted = formatDateTime(instant, timezone);
    expect(formatted).toContain(day);
    expect(formatted).toContain(time);
  });

  it.each([undefined, null, "", "not/a-timezone", 42])(
    "uses the browser timezone for invalid or missing profile timezone %s",
    (timezone) => {
      const instant = "2026-01-01T00:00:00Z";
      expect(formatDateTime(instant, timezone)).toBe(formatDateTime(instant));
    },
  );

  it.each([null, undefined, "not-a-date"])(
    "keeps unavailable timestamps explicit: %s",
    (instant) => {
      expect(formatDateTime(instant, "America/New_York")).toBe("Unavailable");
    },
  );

  it("renders the same instant differently in two timezones", () => {
    const instant = "2026-11-01T00:00:00Z";
    expect(formatDateTime(instant, "America/New_York")).not.toBe(
      formatDateTime(instant, "Asia/Tokyo"),
    );
  });
});
