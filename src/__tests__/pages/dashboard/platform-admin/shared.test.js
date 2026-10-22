import { describe, expect, it } from "vitest";
import { fmt } from "../../../../pages/dashboard/platform-admin/shared";

describe("platform-admin money formatting", () => {
  it("displays API amounts in major units without dividing by 100", () => {
    expect(fmt(500000)).toBe("₦500,000.00");
    expect(fmt(50)).toBe("₦50.00");
    expect(fmt(0)).toBe("₦0.00");
  });

  it("does not rescale foreign-currency API amounts", () => {
    expect(fmt(1234.56, "USD")).toBe("US$1,234.56");
  });

  it("keeps missing amounts distinct from zero", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
  });

  it("still converts explicitly identified minor-unit fields", () => {
    expect(fmt(500000, "NGN", { minor: true })).toBe("₦5,000.00");
  });

  it("preserves fractional amounts, small discrepancies, and numeric strings", () => {
    expect(fmt(1234.56)).toBe("₦1,234.56");
    expect(fmt(0.01)).toBe("₦0.01");
    expect(fmt(-0.01)).toBe("-₦0.01");
    expect(fmt("1234.56")).toBe("₦1,234.56");
  });

  it("keeps balances and audit figures at their requested precision", () => {
    expect(fmt(1036427.56, "NGN", { minor: false, decimals: 2 })).toBe("₦1,036,427.56");
    expect(fmt(-0.01, "NGN", { minor: false, decimals: 2 })).toBe("-₦0.01");
  });
});
