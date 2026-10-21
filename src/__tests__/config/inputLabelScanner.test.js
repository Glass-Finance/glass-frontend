import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  stripComments,
  findInputs,
  findTextInputs,
  scanProject,
} from "../../../scripts/scan-input-labels.mjs";

// Contract guard: every form control in the app must have an accessible
// name.
//
// An <input> with no label, no aria-label, and no wrapping <label> is
// announced by a screen reader as an unlabelled edit box, and fails WCAG
// 2.1 SC 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value).
//
// jsx-a11y cannot catch this. Its label-has-associated-control rule checks
// that a <label> HAS a control, not that every control HAS a label, and its
// control-has-associated-label rule only applies to custom components — so a
// native <input> with no name passes lint cleanly. That is exactly how the
// app ended up with 80 unnamed controls across 33 files.
//
// The scanner in scripts/scan-input-labels.mjs is the guard. These tests
// pin its behaviour (so it cannot quietly stop detecting) and assert the
// repo is clean (so a new unnamed control fails the build).

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const srcRoot = join(repoRoot, "src");

describe("stripComments", () => {
  it("removes a line comment and keeps surrounding content", () => {
    expect(stripComments("a // note\nb")).toBe("a \nb");
  });

  it("removes a block comment", () => {
    expect(stripComments("a /* note */ b")).toBe("a  b");
  });

  it("keeps string literals verbatim, so JSX attribute values survive", () => {
    // The scanner reads type="checkbox" and placeholder="…" out of the
    // source; stripping strings would destroy the data being scanned.
    expect(stripComments(`<input type="checkbox" />`)).toBe(`<input type="checkbox" />`);
  });

  it("does not treat a // inside a string as a comment", () => {
    expect(stripComments(`const u = "https://example.test";`)).toBe(
      `const u = "https://example.test";`,
    );
  });
});

describe("findInputs", () => {
  it("counts a control that has no name", () => {
    const rows = findInputs(`<input type="text" placeholder="Search" />`);
    expect(rows).toHaveLength(1);
    expect(rows[0].named).toBe(false);
    expect(rows[0].reason).toBe("NONE");
  });

  it("accepts an aria-label", () => {
    const rows = findInputs(`<input type="text" aria-label="Search members" />`);
    expect(rows[0].named).toBe(true);
    expect(rows[0].reason).toBe("aria-label");
  });

  it("accepts a label bound by htmlFor", () => {
    const rows = findInputs(`
      <label htmlFor="group-name">Name</label>
      <input id="group-name" type="text" />
    `);
    expect(rows[0].named).toBe(true);
    expect(rows[0].reason).toBe("label htmlFor");
  });

  it("accepts a label whose htmlFor points at an expression id", () => {
    const rows = findInputs(`
      <label htmlFor={codeInputId}>Code</label>
      <input id={codeInputId} type="text" />
    `);
    expect(rows[0].named).toBe(true);
    expect(rows[0].reason).toBe("label htmlFor");
  });

  it("accepts a control wrapped in a label", () => {
    const rows = findInputs(`<label>Pick <input type="checkbox" /></label>`);
    expect(rows[0].named).toBe(true);
    expect(rows[0].reason).toBe("wrapped in <label>");
  });

  it("does not mistake an <input> mentioned in a comment for a control", () => {
    // OtpBoxes.jsx documents its own single hidden <input> in prose. Counting
    // that as a control would report a phantom.
    const rows = findInputs(`// there is exactly ONE real <input> here\nconst x = 1;`);
    expect(rows).toHaveLength(0);
  });

  it("reads attributes past an arrow function in a prop", () => {
    // A regex over attributes stops at the first ">", and onChange={(e) => ...}
    // contains one — which previously truncated the attribute list and made
    // every input with an arrow-function prop look unnamed.
    const rows = findInputs(
      `<input type="text" onChange={(e) => setQ(e.target.value)} aria-label="Search" />`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].named).toBe(true);
  });
});

describe("findTextInputs", () => {
  it("flags a TextInput call site with no label", () => {
    const rows = findTextInputs(`<TextInput type="email" placeholder="Email" />`);
    expect(rows).toHaveLength(1);
    expect(rows[0].named).toBe(false);
  });

  it("accepts a TextInput carrying the label prop", () => {
    const rows = findTextInputs(`<TextInput label="Email address" type="email" />`);
    expect(rows[0].named).toBe(true);
    expect(rows[0].reason).toBe("label prop");
  });

  it("accepts a TextInput whose id is bound by a label", () => {
    const rows = findTextInputs(`
      <label htmlFor="firstName">First Name</label>
      <TextInput id="firstName" />
    `);
    expect(rows[0].named).toBe(true);
  });

  it("does not judge a call site that forwards a prop spread", () => {
    // SignUpTextInput is a thin wrapper that spreads every prop to
    // TextInput; its own call sites are checked individually.
    const rows = findTextInputs(`<TextInput ref={ref} variant="signup" {...props} />`);
    expect(rows).toHaveLength(0);
  });
});

describe("every form control in the app has an accessible name", () => {
  // The guard this whole file exists for. If a control is added without a
  // name, this fails — and the failure names the file and line.
  const findings = scanProject(srcRoot);

  it("reports no unnamed controls", () => {
    const report = findings
      .map((f) => `${f.file}:${f.line} <${f.kind}> placeholder="${f.placeholder}"`)
      .join("\n");
    expect(findings, `Unnamed form controls:\n${report}`).toHaveLength(0);
  });

  it("actually scanned the source tree", () => {
    // A scanner that silently scans nothing would pass the assertion above.
    // Pin that it sees real controls.
    const signIn = readFileSync(join(srcRoot, "pages", "auth", "SignIn.jsx"), "utf8");
    const rows = findTextInputs(signIn);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.named)).toBe(true);
  });
});
