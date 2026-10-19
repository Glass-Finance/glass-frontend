import { describe, it, expect } from "vitest";
import {
  IMPORT_JOB_STATUSES,
  isImportJobTerminal,
  isImportJobProcessing,
  isImportJobInFlight,
  isReviewOpen,
  importJobActions,
  isCommitFailureCode,
  COMMIT_BLOCKED_CODE,
  COMMIT_RETRIES_EXHAUSTED_CODE,
  importJobStatusLabel,
  aiAllowanceLabel,
  isRecordEditable,
} from "../../utils/recordBook";

// The lifecycle, permitted-action table and failure codes are transcribed from
// the backend's integration guide (docs/new/community-record-book-frontend-api.md
// in glass-backend, "Lifecycle and enabled actions"). These tests pin the
// transitions that a UI would otherwise get wrong — chiefly that COMMIT_QUEUED
// is not terminal and that a blocked commit reopens review rather than failing.

describe("import job lifecycle", () => {
  it("covers every status the backend documents", () => {
    expect([...IMPORT_JOB_STATUSES].sort()).toEqual(
      [
        "QUEUED",
        "READING_FILE",
        "INFERRING_MAPPING",
        "APPLYING_MAPPING",
        "ASSISTING_ROWS",
        "READY_FOR_REVIEW",
        "COMMIT_QUEUED",
        "COMMITTED",
        "FAILED",
        "DISCARDED",
      ].sort(),
    );
  });

  it("treats only COMMITTED and DISCARDED as terminal", () => {
    expect(isImportJobTerminal("COMMITTED")).toBe(true);
    expect(isImportJobTerminal("DISCARDED")).toBe(true);
  });

  it("does not treat FAILED as terminal — a retry or rerun leaves it", () => {
    expect(isImportJobTerminal("FAILED")).toBe(false);
  });

  it("does not treat COMMIT_QUEUED as terminal — a blocked commit comes back", () => {
    // The single most expensive mistake available here: treating a queued
    // commit as finished would show the user a success banner for records that
    // were never written.
    expect(isImportJobTerminal("COMMIT_QUEUED")).toBe(false);
  });

  it("does not treat an unknown status as terminal", () => {
    expect(isImportJobTerminal("SOMETHING_NEW")).toBe(false);
    expect(isImportJobTerminal(undefined)).toBe(false);
  });

  it("counts the four worker phases as processing", () => {
    for (const status of [
      "READING_FILE",
      "INFERRING_MAPPING",
      "APPLYING_MAPPING",
      "ASSISTING_ROWS",
    ]) {
      expect(isImportJobProcessing(status)).toBe(true);
    }
    expect(isImportJobProcessing("QUEUED")).toBe(false);
    expect(isImportJobProcessing("READY_FOR_REVIEW")).toBe(false);
  });

  it("counts QUEUED, processing and COMMIT_QUEUED as in flight", () => {
    expect(isImportJobInFlight("QUEUED")).toBe(true);
    expect(isImportJobInFlight("READING_FILE")).toBe(true);
    expect(isImportJobInFlight("COMMIT_QUEUED")).toBe(true);
  });

  it("does not count a settled-or-reviewable job as in flight", () => {
    // READY_FOR_REVIEW is where polling must STOP: nothing further happens
    // until a human edits a row, so continuing to poll is pure traffic.
    expect(isImportJobInFlight("READY_FOR_REVIEW")).toBe(false);
    expect(isImportJobInFlight("COMMITTED")).toBe(false);
    expect(isImportJobInFlight("FAILED")).toBe(false);
    expect(isImportJobInFlight("DISCARDED")).toBe(false);
  });

  it("opens review only at READY_FOR_REVIEW", () => {
    expect(isReviewOpen("READY_FOR_REVIEW")).toBe(true);
    for (const status of ["QUEUED", "COMMIT_QUEUED", "COMMITTED", "FAILED", "DISCARDED"]) {
      expect(isReviewOpen(status)).toBe(false);
    }
  });
});

describe("importJobActions", () => {
  it("allows discard from QUEUED, review and failure only", () => {
    expect(importJobActions("QUEUED").discard).toBe(true);
    expect(importJobActions("READY_FOR_REVIEW").discard).toBe(true);
    expect(importJobActions("FAILED").discard).toBe(true);
  });

  it("withholds discard while processing and while a commit is queued", () => {
    for (const status of [
      "READING_FILE",
      "INFERRING_MAPPING",
      "APPLYING_MAPPING",
      "ASSISTING_ROWS",
      "COMMIT_QUEUED",
    ]) {
      expect(importJobActions(status).discard).toBe(false);
    }
  });

  it("freezes every review mutation at COMMIT_QUEUED", () => {
    const actions = importJobActions("COMMIT_QUEUED");
    expect(actions.editRows).toBe(false);
    expect(actions.commit).toBe(false);
    expect(actions.discard).toBe(false);
    expect(actions.rerun).toBe(false);
  });

  it("enables editing, commit, discard and rerun at READY_FOR_REVIEW", () => {
    const actions = importJobActions("READY_FOR_REVIEW");
    expect(actions.editRows).toBe(true);
    expect(actions.commit).toBe(true);
    expect(actions.discard).toBe(true);
    expect(actions.rerun).toBe(true);
  });

  it("allows rerun only from FAILED or READY_FOR_REVIEW", () => {
    expect(importJobActions("FAILED").rerun).toBe(true);
    expect(importJobActions("READY_FOR_REVIEW").rerun).toBe(true);
    expect(importJobActions("QUEUED").rerun).toBe(false);
    expect(importJobActions("COMMITTED").rerun).toBe(false);
  });

  it("offers retry on a FAILED job only when the backend says it is retryable", () => {
    expect(importJobActions("FAILED", true).retry).toBe(true);
    expect(importJobActions("FAILED", false).retry).toBe(false);
  });

  it("does not treat a missing retryable flag as retryable", () => {
    // retryable is a server decision. Defaulting it to true would show a Retry
    // button for failures the backend has already given up on.
    expect(importJobActions("FAILED").retry).toBe(false);
    expect(importJobActions("FAILED", undefined).retry).toBe(false);
    expect(importJobActions("FAILED", null).retry).toBe(false);
  });

  it("never offers retry outside FAILED, even when retryable is true", () => {
    for (const status of ["QUEUED", "READY_FOR_REVIEW", "COMMIT_QUEUED", "COMMITTED"]) {
      expect(importJobActions(status, true).retry).toBe(false);
    }
  });

  it("enables nothing at all once a job is committed or discarded", () => {
    for (const status of ["COMMITTED", "DISCARDED"]) {
      expect(importJobActions(status, true)).toEqual({
        editRows: false,
        commit: false,
        discard: false,
        rerun: false,
        retry: false,
      });
    }
  });
});

describe("commit failure codes", () => {
  it("recognises both codes that reopen a job for review", () => {
    expect(isCommitFailureCode(COMMIT_BLOCKED_CODE)).toBe(true);
    expect(isCommitFailureCode(COMMIT_RETRIES_EXHAUSTED_CODE)).toBe(true);
  });

  it("does not treat other failures as commit failures", () => {
    expect(isCommitFailureCode("SOME_OTHER_CODE")).toBe(false);
    expect(isCommitFailureCode(null)).toBe(false);
  });
});

describe("labels", () => {
  it("gives every documented status a human label", () => {
    for (const status of IMPORT_JOB_STATUSES) {
      expect(importJobStatusLabel(status)).not.toBe(status);
    }
  });

  it("falls back to the raw status for an unknown one", () => {
    expect(importJobStatusLabel("BRAND_NEW_STATE")).toBe("BRAND_NEW_STATE");
  });
});

describe("aiAllowanceLabel", () => {
  it("renders UNLIMITED as Unlimited rather than a number", () => {
    // The backend returns null allowance and null remaining for UNLIMITED.
    // Rendering that null as 0 would tell the user they have nothing left.
    expect(aiAllowanceLabel("UNLIMITED", null)).toBe("Unlimited");
    expect(aiAllowanceLabel("UNLIMITED", undefined)).toBe("Unlimited");
  });

  it("renders DISABLED as Disabled", () => {
    expect(aiAllowanceLabel("DISABLED", null)).toBe("Disabled");
  });

  it("shows an em dash when a LIMITED policy reports no remaining units", () => {
    expect(aiAllowanceLabel("LIMITED", null)).toBe("—");
    expect(aiAllowanceLabel("LIMITED", undefined)).toBe("—");
  });

  it("shows the remaining units when there are any", () => {
    expect(aiAllowanceLabel("LIMITED", 0)).toBe("0");
    expect(aiAllowanceLabel("LIMITED", 42)).toBe("42");
  });
});

describe("isRecordEditable", () => {
  it("refuses PLATFORM records — the backend rejects writes on them", () => {
    expect(isRecordEditable({ source: "PLATFORM" })).toBe(false);
  });

  it("allows manual and imported records", () => {
    expect(isRecordEditable({ source: "MANUAL" })).toBe(true);
    expect(isRecordEditable({ source: "FILE_IMPORT" })).toBe(true);
  });

  it("refuses to guess about a missing record", () => {
    expect(isRecordEditable(null)).toBe(false);
    expect(isRecordEditable({})).toBe(true);
  });
});
