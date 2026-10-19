import { expect, it } from "vitest";
import { formatRecordAmount } from "../../utils/recordBook";

it.each([
  ["NGN", "₦"],
  ["USD", "$"],
  ["EUR", "€"],
  ["GBP", "£"],
  ["JPY", "¥"],
])("derives the %s symbol from the currency code", (code, symbol) => {
  expect(formatRecordAmount(25, code)).toContain(symbol);
});
it("preserves currency-specific precision and missing amounts", () => {
  expect(formatRecordAmount(25, "JPY")).not.toContain(".00");
  expect(formatRecordAmount(25, "KWD")).toContain("25.000");
  expect(formatRecordAmount(null, "NGN")).toBe("Amount missing");
});
it("falls back to the code when no currency symbol is available", () => {
  expect(formatRecordAmount(25, "ZZZ")).toContain("ZZZ");
  expect(formatRecordAmount(25, "INVALID")).toBe("INVALID 25");
});
