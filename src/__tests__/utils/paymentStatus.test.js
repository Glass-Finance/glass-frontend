import { describe, it, expect } from "vitest";
import {
  isSuccessfulStatus,
  isVerificationSuccessStatus,
  isPaidObligationStatus,
  isFailedStatus,
  isOverdueObligationStatus,
} from "../../utils/paymentStatus";

// Regression coverage for every backend status literal the frontend
// interprets. Each expectation mirrors the exact literal sets the call
// sites checked before consolidation (see paymentStatus.js) — if the
// backend adds a value, add it here first, then decide which predicate(s)
// should accept it.
describe("payment status predicates", () => {
  const cases = [
    // [status, successful, verification, paid, failed, overdue]
    ["SUCCESS", true, true, false, false, false],
    ["SUCCESSFUL", true, true, true, false, false],
    ["PAID", true, false, true, false, false],
    ["FAILED", false, false, false, true, false],
    ["PENDING", false, false, false, false, false],
    ["INITIATED", false, false, false, false, false],
    ["DUE", false, false, false, false, false],
    ["OVERDUE", false, false, false, false, true],
    ["WAIVED", false, false, false, false, false],
    ["REFUNDED", false, false, false, false, false],
    // Different axis — plan lifecycle / job / payout statuses must never
    // match a payment predicate.
    ["ACTIVE", false, false, false, false, false],
    ["DELETED", false, false, false, false, false],
    ["EXPIRED", false, false, false, false, false],
    ["COMPLETED", false, false, false, false, false],
    ["REJECTED", false, false, false, false, false],
    ["CANCELLED", false, false, false, false, false],
  ];

  it.each(cases)(
    "%s → successful=%s verification=%s paid=%s failed=%s overdue=%s",
    (status, successful, verification, paid, failed, overdue) => {
      expect(isSuccessfulStatus(status)).toBe(successful);
      expect(isVerificationSuccessStatus(status)).toBe(verification);
      expect(isPaidObligationStatus(status)).toBe(paid);
      expect(isFailedStatus(status)).toBe(failed);
      expect(isOverdueObligationStatus(status)).toBe(overdue);
    },
  );

  it("accepts any case (raw or shaped input)", () => {
    expect(isSuccessfulStatus("success")).toBe(true);
    expect(isSuccessfulStatus("Paid")).toBe(true);
    expect(isVerificationSuccessStatus("successful")).toBe(true);
    expect(isVerificationSuccessStatus("paid")).toBe(false);
    expect(isPaidObligationStatus("paid")).toBe(true);
    expect(isPaidObligationStatus("successful")).toBe(true);
    expect(isFailedStatus("failed")).toBe(true);
    expect(isOverdueObligationStatus("overdue")).toBe(true);
  });

  it("treats missing statuses as non-matching, never throwing", () => {
    for (const status of [null, undefined, ""]) {
      expect(isSuccessfulStatus(status)).toBe(false);
      expect(isVerificationSuccessStatus(status)).toBe(false);
      expect(isPaidObligationStatus(status)).toBe(false);
      expect(isFailedStatus(status)).toBe(false);
      expect(isOverdueObligationStatus(status)).toBe(false);
    }
  });
});
