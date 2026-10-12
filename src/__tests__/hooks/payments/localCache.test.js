import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  recordLocalPayment,
  stashPendingPaymentCtx,
  peekPendingPaymentCtx,
  recordLocalFee,
  lookupLocalFee,
  settleLocalPaymentForReference,
} from "../../../hooks/payments/localCache";

// localCache.js is pure localStorage/sessionStorage — no module mocking at
// all here, which is the point: this is the module every payment test in the
// suite MOCKS OUT, so nothing about its real behaviour was ever asserted.
const PAID_LOG_KEY = "glass_local_paid_log";
const FEE_LOG_KEY = "glass_local_fee_log";
const PENDING_CTX_KEY = "paymentPendingCtx";

const readPaidLog = () => JSON.parse(localStorage.getItem(PAID_LOG_KEY) ?? "[]");
const readFeeLog = () => JSON.parse(localStorage.getItem(FEE_LOG_KEY) ?? "{}");

describe("localCache — pending payment context", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("peekPendingPaymentCtx is a non-destructive read", () => {
    const ctx = { reference: "ref-1", obligationId: "obl-1", feeMinor: 250 };
    stashPendingPaymentCtx(ctx);

    // Both the peek and a second peek see it — peeking must not consume it,
    // because several pages legitimately need to look before the settling
    // page consumes it.
    expect(peekPendingPaymentCtx()).toEqual(ctx);
    expect(peekPendingPaymentCtx()).toEqual(ctx);
    expect(sessionStorage.getItem(PENDING_CTX_KEY)).not.toBeNull();
  });

  it("peekPendingPaymentCtx returns null for absent and corrupt values", () => {
    expect(peekPendingPaymentCtx()).toBeNull();

    sessionStorage.setItem(PENDING_CTX_KEY, "{not json");
    expect(peekPendingPaymentCtx()).toBeNull();
  });
});

describe("localCache — settling a payment for a reference", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("writes the paid log and consumes the context for a MATCHING reference", () => {
    stashPendingPaymentCtx({ reference: "ref-1", obligationId: "obl-1", feeMinor: 250 });

    settleLocalPaymentForReference("ref-1");

    expect(readPaidLog()).toHaveLength(1);
    expect(readPaidLog()[0].obligationId).toBe("obl-1");
    expect(sessionStorage.getItem(PENDING_CTX_KEY)).toBeNull();
  });

  it("a context for a DIFFERENT reference is NOT consumed", () => {
    // The whole point of keying on reference: payer A's stashed context must
    // not be spent by an unrelated verification, or A's obligation silently
    // stops being "recently paid" in the local log.
    stashPendingPaymentCtx({ reference: "ref-1", obligationId: "obl-1" });

    settleLocalPaymentForReference("ref-SOMEONE-ELSE");

    expect(readPaidLog()).toHaveLength(0);
    // Still stashed, so the real callback can still settle it.
    expect(sessionStorage.getItem(PENDING_CTX_KEY)).not.toBeNull();
    expect(peekPendingPaymentCtx().obligationId).toBe("obl-1");
  });

  it("the missing-reference fallback consumes a reference-less context", () => {
    // PINNED CONTRACT (not an accident): the guard is
    // `!reference || !ctx.reference || ctx.reference === reference`, so a
    // context stashed with NO reference of its own is settled by ANY
    // verification. That is the intended fallback for flows that never had a
    // Paystack reference to key on. It is also the sharp edge: it is the one
    // shape where two in-flight attempts can collide. Documented here so a
    // future tightening of this guard fails loudly in review.
    stashPendingPaymentCtx({ obligationId: "obl-1" });
    settleLocalPaymentForReference("ref-anything");
    expect(readPaidLog()).toHaveLength(1);
  });

  it("a verification with NO reference settles a reference-less context", () => {
    stashPendingPaymentCtx({ obligationId: "obl-1" });
    settleLocalPaymentForReference();
    expect(readPaidLog()).toHaveLength(1);
    expect(sessionStorage.getItem(PENDING_CTX_KEY)).toBeNull();
  });

  it("does nothing when no context was stashed at all", () => {
    expect(() => settleLocalPaymentForReference("ref-1")).not.toThrow();
    expect(readPaidLog()).toHaveLength(0);
  });

  it("survives a corrupt stashed context without throwing", () => {
    sessionStorage.setItem(PENDING_CTX_KEY, "{broken");
    expect(() => settleLocalPaymentForReference("ref-1")).not.toThrow();
    expect(readPaidLog()).toHaveLength(0);
  });
});

describe("localCache — fee cache", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("caches the fee under both the reference and the revealed transactionId", () => {
    // useTransactionDetail falls back to lookupLocalFee() precisely because
    // the completed transaction often comes back with no fee field — losing
    // this cache turns a known fee into "—" on the receipt.
    stashPendingPaymentCtx({ reference: "ref-1", obligationId: "obl-1", feeMinor: 250 });
    settleLocalPaymentForReference("ref-1", "txn-9");

    expect(lookupLocalFee("ref-1")).toBe(250);
    expect(lookupLocalFee("txn-9")).toBe(250);
  });

  it("preserves a zero-valued fee (a waived/absorbed fee is still information)", () => {
    // `feeMinor != null` is the guard, not a truthiness check — 0 must survive.
    // A truthiness regression here would silently drop a real ₦0.00 fee.
    stashPendingPaymentCtx({ reference: "ref-1", obligationId: "obl-1", feeMinor: 0 });
    settleLocalPaymentForReference("ref-1");

    expect(lookupLocalFee("ref-1")).toBe(0);
    expect(readFeeLog()["ref-1"]).toBe(0);
  });

  it("caches no fee when the context carries none, and leaves lookups null", () => {
    stashPendingPaymentCtx({ reference: "ref-1", obligationId: "obl-1" });
    settleLocalPaymentForReference("ref-1");

    expect(readFeeLog()).toEqual({});
    expect(lookupLocalFee("ref-1")).toBeNull();
  });

  it("recordLocalFee ignores a missing key or a null fee", () => {
    recordLocalFee(null, 100);
    recordLocalFee("", 100);
    recordLocalFee("ref-1", null);
    recordLocalFee("ref-1", undefined);
    expect(readFeeLog()).toEqual({});
    expect(lookupLocalFee("ref-1")).toBeNull();
  });

  it("recordLocalFee still caches an explicit zero", () => {
    recordLocalFee("ref-1", 0);
    expect(lookupLocalFee("ref-1")).toBe(0);
  });

  it("evicts the OLDEST keys past the 100-entry cap, keeping the newest", () => {
    for (let i = 0; i < 105; i += 1) recordLocalFee(`key-${i}`, i);

    const log = readFeeLog();
    expect(Object.keys(log)).toHaveLength(100);
    // FIFO: the first five insertions are gone...
    expect(log["key-0"]).toBeUndefined();
    expect(log["key-4"]).toBeUndefined();
    // ...and everything from the cap boundary onward survives.
    expect(log["key-5"]).toBe(5);
    expect(log["key-104"]).toBe(104);
  });

  it("lookupLocalFee recovers from corrupt storage as null instead of throwing", () => {
    localStorage.setItem(FEE_LOG_KEY, "{not json at all");
    expect(lookupLocalFee("ref-1")).toBeNull();
  });

  it("recordLocalFee recovers from corrupt storage instead of throwing", () => {
    localStorage.setItem(FEE_LOG_KEY, "{not json at all");
    expect(() => recordLocalFee("ref-1", 100)).not.toThrow();
    expect(lookupLocalFee("ref-1")).toBe(100);
  });
});

describe("localCache — paid log", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("records a stamp for each settled payment", () => {
    recordLocalPayment({ obligationId: "obl-1" });
    recordLocalPayment({ paymentLinkId: "pl-1" });

    const log = readPaidLog();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ obligationId: "obl-1", paymentLinkId: null });
    expect(log[1]).toMatchObject({ paymentLinkId: "pl-1", obligationId: null });
    expect(typeof log[0].paidAt).toBe("string");
    expect(Number.isNaN(Date.parse(log[0].paidAt))).toBe(false);
  });

  it("ignores a payment with neither a paymentLinkId nor an obligationId", () => {
    recordLocalPayment({});
    recordLocalPayment({ paymentLinkId: null, obligationId: null });
    expect(readPaidLog()).toEqual([]);
  });

  it("caps the paid log at 50 entries, keeping the NEWEST", () => {
    for (let i = 0; i < 60; i += 1) recordLocalPayment({ obligationId: `obl-${i}` });

    const log = readPaidLog();
    expect(log).toHaveLength(50);
    expect(log[0].obligationId).toBe("obl-10");
    expect(log[49].obligationId).toBe("obl-59");
  });

  it("survives corrupt paid-log storage", () => {
    localStorage.setItem(PAID_LOG_KEY, "[[[");
    expect(() => recordLocalPayment({ obligationId: "obl-1" })).not.toThrow();
    expect(readPaidLog()).toHaveLength(1);
  });
});

describe("localCache — storage failures are swallowed, never thrown", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a localStorage quota failure does not escape to the payment flow", () => {
    // A throwing storage call inside a payment-settlement path would surface
    // as a failed payment to the payer. Every entry point swallows instead.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    expect(() => recordLocalPayment({ obligationId: "obl-1" })).not.toThrow();
    expect(() => recordLocalFee("ref-1", 100)).not.toThrow();
    expect(() => stashPendingPaymentCtx({ reference: "ref-1" })).not.toThrow();
    expect(() => settleLocalPaymentForReference("ref-1")).not.toThrow();
  });

  it("a sessionStorage failure does not escape either", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });

    expect(peekPendingPaymentCtx()).toBeNull();
    expect(() => settleLocalPaymentForReference("ref-1")).not.toThrow();
    expect(lookupLocalFee("ref-1")).toBeNull();
  });
});
