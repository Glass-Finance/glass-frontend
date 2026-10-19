import { describe, expect, it } from "vitest";
import {
  jobActions,
  makeRecordPatch,
  validateRecord,
  jobLabel,
  toggleRowSelection,
  formatRecordAmount,
  isRecordEditable,
  COMMIT_BLOCKED_CODE,
  COMMIT_RETRIES_EXHAUSTED_CODE,
} from "../../utils/recordBook";
describe("record book interpretation", () => {
  it("freezes review for queued commit and unknown states", () => {
    expect(jobActions({ status: "READY_FOR_REVIEW" }).edit).toBe(true);
    for (const status of [
      "QUEUED",
      "READING_FILE",
      "INFERRING_MAPPING",
      "APPLYING_MAPPING",
      "ASSISTING_ROWS",
      "COMMIT_QUEUED",
      "COMMITTED",
      "DISCARDED",
      "UNKNOWN",
    ])
      expect(jobActions({ status }).edit).toBe(false);
    expect(jobActions({ status: "FAILED", retryable: false }).retry).toBe(false);
    expect(jobActions({ status: "FAILED", retryable: true }).retry).toBe(true);
  });
  it("only patches changed editable fields, preserving explicit null", () => {
    expect(
      makeRecordPatch(
        { description: "dues", amount: 25 },
        { description: "", amount: "25", source: "PLATFORM" },
      ),
    ).toEqual({ description: null });
  });
  it("validates decimal precision, positive amounts, and UTC dates without rounding", () => {
    const row = {
      recordType: "EXPENSE",
      direction: "OUTFLOW",
      occurredOn: "2026-01-01",
      amount: "12.50",
      currency: "NGN",
    };
    expect(validateRecord(row)).toEqual({});
    expect(validateRecord({ ...row, amount: "12.501" }).amount).toBeTruthy();
    expect(validateRecord({ ...row, amount: "-5" }).amount).toBeTruthy();
    expect(validateRecord({ ...row, amount: "1e3" }).amount).toBeTruthy();
    expect(validateRecord({ ...row, amount: "9007199254740993" }).amount).toBeTruthy();
    expect(validateRecord({ ...row, occurredOn: "2099-12-31" }).occurredOn).toBeTruthy();
    expect(formatRecordAmount(1250.5, "NGN")).toContain("1,250.50");
  });
  it("labels returning jobs entirely from returned fields", () => {
    expect(
      jobLabel({ id: "abcdef123", fileFormat: "XLSX", createdAt: "2026-10-18T09:35:00Z" }),
    ).toMatch(/XLSX import.*abcdef/);
  });
  it("caps explicit selection at 500 and never selects all matches", () => {
    const ids = Array.from({ length: 500 }, (_, i) => `r${i}`);
    expect(toggleRowSelection(ids, "r501")).toHaveLength(500);
    expect(toggleRowSelection(ids, "r0")).toHaveLength(499);
  });
});

it("turns blank draft numeric and date fields into explicit nulls", () => {
  expect(
    makeRecordPatch({ amount: 25, occurredOn: "2026-01-01" }, { amount: "", occurredOn: "" }),
  ).toEqual({ amount: null, occurredOn: null });
});

it("rejects a decimal that changes in the actual JSON payload", () => {
  expect(
    validateRecord({ amount: "90071992547409.91", currency: "NGN" }, true).amount,
  ).toBeTruthy();
  expect(validateRecord({ amount: "1250.50", currency: "NGN" }, true)).toEqual({});
});
it("preserves explicit cleared payer fields when creating or changing a member link", () => {
  expect(makeRecordPatch(undefined, { memberId: "m1", payerName: "", payerReference: "" })).toEqual(
    { memberId: "m1", payerName: null, payerReference: null },
  );
  expect(
    makeRecordPatch(
      { memberId: null, payerName: null, payerReference: null },
      { memberId: "m1", payerName: "", payerReference: "" },
    ),
  ).toEqual({ memberId: "m1", payerName: null, payerReference: null });
});

it("names the two commit failure codes that reopen a job for review", () => {
  // Both mean "reopen READY_FOR_REVIEW", not "the import failed" — the user's
  // next move is to fix rows and commit again, so the copy must not read as a
  // dead end. They are named once here rather than spelled inline per screen.
  expect(COMMIT_BLOCKED_CODE).toBe("IMPORT_COMMIT_BLOCKED");
  expect(COMMIT_RETRIES_EXHAUSTED_CODE).toBe("IMPORT_COMMIT_RETRIES_EXHAUSTED");
  expect(COMMIT_BLOCKED_CODE).not.toBe(COMMIT_RETRIES_EXHAUSTED_CODE);
});

it("refuses to treat PLATFORM records as editable", () => {
  // PLATFORM records are read-only projections of platform transactions; the
  // backend rejects writes on them, so the UI must not offer Edit or Delete.
  expect(isRecordEditable({ source: "PLATFORM" })).toBe(false);
  expect(isRecordEditable({ source: "MANUAL" })).toBe(true);
  expect(isRecordEditable({ source: "FILE_IMPORT" })).toBe(true);
  expect(isRecordEditable(null)).toBe(false);
});
