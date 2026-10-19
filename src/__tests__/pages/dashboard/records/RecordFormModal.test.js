import { describe, it, expect } from "vitest";
import { buildPatch, buildCreate } from "../../../../pages/dashboard/records/recordPatch";

// PATCH SEMANTICS, pinned.
//
// The backend's rule is: omission preserves, an explicit null CLEARS, and `{}`
// clears nothing. So a form that always sends every field cannot tell "leave
// this alone" from "wipe this" — it collapses them, and clearing a field the
// user never touched is silent data loss.
//
// These are pure functions specifically so this contract is testable without a
// backend, a browser, or a form.

const EXISTING = {
  id: "rec-1",
  recordType: "MEMBER_PAYMENT",
  direction: "INFLOW",
  occurredOn: "2026-09-15",
  amount: 1250.5,
  currency: "NGN",
  description: "September dues",
  payerName: "Ada Example",
  payerReference: "00017",
  categoryLabel: "dues",
  externalReference: "receipt-017",
};

const form = (over = {}) => ({
  recordType: EXISTING.recordType,
  direction: EXISTING.direction,
  occurredOn: EXISTING.occurredOn,
  amount: String(EXISTING.amount),
  currency: EXISTING.currency,
  payerName: EXISTING.payerName,
  payerReference: EXISTING.payerReference,
  description: EXISTING.description,
  categoryLabel: EXISTING.categoryLabel,
  externalReference: EXISTING.externalReference,
  ...over,
});

describe("buildPatch", () => {
  it("sends nothing when nothing changed", () => {
    // The important case: an open-then-close edit must not blank the record.
    expect(buildPatch(EXISTING, form())).toEqual({});
  });

  it("sends only the field that changed", () => {
    const patch = buildPatch(EXISTING, form({ description: "October dues" }));
    expect(patch).toEqual({ description: "October dues" });
  });

  it("sends an explicit null to CLEAR a field the user emptied", () => {
    // Omitting it would preserve; sending "" is not the same as clearing.
    const patch = buildPatch(EXISTING, form({ description: "" }));
    expect(patch).toEqual({ description: null });
  });

  it("does not send null for a field that was already empty", () => {
    const record = { ...EXISTING, externalReference: null };
    const patch = buildPatch(record, form({ externalReference: "" }));
    expect(patch).not.toHaveProperty("externalReference");
  });

  it("clears several emptied fields at once", () => {
    const patch = buildPatch(EXISTING, form({ payerName: "", categoryLabel: "  " }));
    expect(patch).toEqual({ payerName: null, categoryLabel: null });
  });

  it("treats whitespace-only input as cleared, not as a value", () => {
    // Otherwise a stray space saves " " and the backend normalises it to "",
    // which looks like a successful edit that changed nothing.
    const patch = buildPatch(EXISTING, form({ description: "   " }));
    expect(patch).toEqual({ description: null });
  });

  it("compares amount numerically, not as a string", () => {
    // "1250.50" and "1250.5" are the same amount; a string compare would send a
    // pointless patch every time the user reformatted the figure.
    expect(buildPatch(EXISTING, form({ amount: "1250.50" }))).toEqual({});
    expect(buildPatch(EXISTING, form({ amount: "1250.50 " }))).toEqual({});
  });

  it("sends a changed amount as a number, in major units", () => {
    const patch = buildPatch(EXISTING, form({ amount: "99.99" }));
    expect(patch.amount).toBe(99.99);
    expect(typeof patch.amount).toBe("number");
  });

  it("ignores an unparseable amount rather than sending NaN", () => {
    // JSON.stringify(NaN) is `null`, which the backend would read as "clear
    // this field" — a silent data loss instead of a validation error.
    const patch = buildPatch(EXISTING, form({ amount: "abc" }));
    expect(patch).not.toHaveProperty("amount");
  });

  it("sends a changed enum or date through", () => {
    expect(buildPatch(EXISTING, form({ direction: "OUTFLOW" }))).toEqual({ direction: "OUTFLOW" });
    expect(buildPatch(EXISTING, form({ occurredOn: "2026-10-01" }))).toEqual({
      occurredOn: "2026-10-01",
    });
  });

  it("never sends an editable field the record doesn't have", () => {
    // expectedVersion / source / provenance / issues / status are not editable.
    const keys = Object.keys(buildPatch(EXISTING, form({ description: "changed" })));
    for (const forbidden of [
      "expectedVersion",
      "source",
      "issues",
      "status",
      "reviewStatus",
      "id",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("buildCreate", () => {
  it("omits blank optional fields rather than sending nulls", () => {
    const payload = buildCreate(
      form({ payerName: "", payerReference: "", categoryLabel: "", externalReference: "" }),
    );
    expect(payload).toEqual({
      recordType: "MEMBER_PAYMENT",
      direction: "INFLOW",
      occurredOn: "2026-09-15",
      amount: 1250.5,
      currency: "NGN",
      description: "September dues",
    });
  });

  it("carries the required fields with the amount as a number", () => {
    const payload = buildCreate(form());
    expect(payload.amount).toBe(1250.5);
    expect(payload.recordType).toBe("MEMBER_PAYMENT");
    expect(payload.direction).toBe("INFLOW");
    expect(payload.occurredOn).toBe("2026-09-15");
    expect(payload.currency).toBe("NGN");
  });

  it("trims optional values", () => {
    expect(buildCreate(form({ payerName: "  Ada  " })).payerName).toBe("Ada");
  });

  it("does not default duplicateAccepted — consent must be explicit", () => {
    // The caller adds duplicateAccepted:true only after a 409 the user
    // acknowledged, so a plain create must never carry it.
    expect(buildCreate(form())).not.toHaveProperty("duplicateAccepted");
  });
});
