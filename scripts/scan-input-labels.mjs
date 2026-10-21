// Accessibility contract scanner: finds every form control in the app that
// has no accessible name.
//
// WHY THIS EXISTS
//
// An <input> with no label, no aria-label, and no wrapping <label> is
// announced by a screen reader as an unlabelled edit box. It cannot be
// operated by voice, it is skipped by "tab to next field" workflows that
// rely on the name, and it fails WCAG 2.1 SC 1.3.1 (Info and Relationships)
// and 4.1.2 (Name, Role, Value).
//
// The gap was invisible because jsx-a11y cannot catch it: its
// label-has-associated-control rule checks that a <label> HAS a control,
// not that every control HAS a label. Native <input> elements are also
// outside its control-has-associated-label rule, which only applies to
// custom components.
//
// So this scanner is the guard. It reads the JSX source and reports any
// <input> (and any <TextInput> call site) that carries no accessible name.
//
// HOW IT DECIDES
//
// A control is considered named when it has ANY of:
//   - aria-label / aria-labelledby pointing at an id that exists
//   - an id matched by a <label htmlFor="..."> (or the shared <Label>
//     component from components/auth/FormFields.jsx)
//   - being wrapped inside a <label> element (implicit association)
//
// Comments are stripped before scanning, because prose that mentions
// "<input>" (OtpBoxes.jsx documents its own single hidden <input>) is not a
// control.
//
// The tag scanner is hand-written rather than regex-based: a regex over
// attributes stops at the first ">", and JSX props routinely contain "=>"
// (onChange={(e) => ...}), which truncated the attribute list and made
// every input with an arrow-function prop look unnamed.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/**
 * Remove JS comments ONLY. String literals are preserved verbatim, because
 * JSX attribute values (`type="checkbox"`, `placeholder="Search…"`) live in
 * strings and stripping them would destroy the data being scanned.
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Collect the ids a <label> points at, literal and expression form. */
function labelTargets(code) {
  return new Set([
    ...[...code.matchAll(/<label[^>]*htmlFor=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...code.matchAll(/<Label[^>]*htmlFor=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...code.matchAll(/<label[^>]*htmlFor=\{([A-Za-z_$][\w$]*)\}/g)].map((m) => m[1]),
    ...[...code.matchAll(/<Label[^>]*htmlFor=\{([A-Za-z_$][\w$]*)\}/g)].map((m) => m[1]),
  ]);
}

/**
 * Walk every JSX tag in `code`, calling `visit(tagName, attrs, isClosing)`.
 * Returns the tag records. Brace-aware so "=>" inside props does not end
 * the tag early.
 */
function eachTag(code, visit) {
  const tags = [];
  let labelDepth = 0;
  let i = 0;
  const n = code.length;
  while (i < n) {
    if (code[i] !== "<") {
      i++;
      continue;
    }
    let j = i + 1;
    let closing = false;
    if (code[j] === "/") {
      closing = true;
      j++;
    }
    const nameStart = j;
    while (j < n && /[A-Za-z0-9]/.test(code[j])) j++;
    const rawName = code.slice(nameStart, j);
    if (!rawName) {
      i++;
      continue;
    }
    const name = rawName.toLowerCase();

    let depth = 0;
    let k = j;
    while (k < n) {
      const c = code[k];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      k++;
    }
    const attrs = code.slice(j, k);
    const selfClose = code[k - 1] === "/";
    const line = code.slice(0, i).split("\n").length;

    if (name === "label") {
      if (closing) labelDepth = Math.max(0, labelDepth - 1);
      else if (!selfClose) labelDepth++;
    }

    visit({ name, rawName, attrs, closing, selfClose, line, labelDepth });
    tags.push({ name, attrs, closing, line });
    i = k + 1;
  }
  return tags;
}

/**
 * Every <input> in a JSX source file, with whether it has an accessible name.
 */
export function findInputs(src) {
  const code = stripComments(src);
  const ids = new Set([...code.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
  const targets = labelTargets(code);
  const results = [];

  eachTag(code, (tag) => {
    if (tag.name !== "input" || tag.closing) return;
    const { attrs, line, labelDepth } = tag;
    const idMatch = /(?<![\w-])id=["']([^"']+)["']/.exec(attrs);
    const idExpr = /(?<![\w-])id=\{([A-Za-z_$][\w$]*)\}/.exec(attrs);
    const aria = /aria-label(?:ledby)?\s*=/.test(attrs);
    const labelledBy = /aria-labelledby=["']([^"']+)["']/.exec(attrs);
    const labelledByExists = !!labelledBy && ids.has(labelledBy[1]);
    const idBound = (!!idMatch && targets.has(idMatch[1])) || (!!idExpr && targets.has(idExpr[1]));
    const implicit = labelDepth > 0;
    const named = aria || labelledByExists || idBound || implicit;
    results.push({
      kind: "input",
      line,
      named,
      reason: aria
        ? "aria-label"
        : labelledByExists
          ? "aria-labelledby"
          : idBound
            ? "label htmlFor"
            : implicit
              ? "wrapped in <label>"
              : "NONE",
      type: (/type=["']([^"']*)["']/.exec(attrs) || [])[1] || "text",
      placeholder: (/placeholder=["']([^"']*)["']/.exec(attrs) || [])[1] || "",
      id: idMatch ? idMatch[1] : "",
    });
  });

  return results;
}

/**
 * Every <TextInput> call site in a JSX source file.
 *
 * The shared TextInput (components/ui/TextInput.jsx) owns its accessible
 * name through the `label` prop, which renders a real <label htmlFor>. A
 * call site that passes neither `label` nor an id bound to a <label> leaves
 * the field with a placeholder as its only name — and a placeholder is not
 * an accessible name.
 *
 * SignUpTextInput (pages/auth/SignUp/SignUpTextInput.jsx) forwards every
 * prop to TextInput, so it is checked the same way.
 */
export function findTextInputs(src) {
  const code = stripComments(src);
  const ids = new Set([...code.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
  const targets = labelTargets(code);
  const results = [];

  eachTag(code, (tag) => {
    if (tag.closing) return;
    if (tag.rawName !== "TextInput" && tag.rawName !== "SignUpTextInput") return;
    const { attrs, line } = tag;
    // A prop spread forwards whatever the caller passed, so the name cannot be
    // decided from this file. SignUpTextInput is exactly that case: it is a
    // thin wrapper that forwards every prop to TextInput, and its own call
    // sites are checked individually.
    if (/\{\.\.\./.test(attrs)) return;
    const hasLabelProp = /(?<![\w-])label\s*=/.test(attrs);
    const aria = /aria-label(?:ledby)?\s*=/.test(attrs);
    const labelledBy = /aria-labelledby=["']([^"']+)["']/.exec(attrs);
    const labelledByExists = !!labelledBy && ids.has(labelledBy[1]);
    const idMatch = /(?<![\w-])id=["']([^"']+)["']/.exec(attrs);
    const idExpr = /(?<![\w-])id=\{([A-Za-z_$][\w$]*)\}/.exec(attrs);
    const idBound = (!!idMatch && targets.has(idMatch[1])) || (!!idExpr && targets.has(idExpr[1]));
    const named = hasLabelProp || aria || labelledByExists || idBound;
    results.push({
      kind: "textinput",
      line,
      named,
      reason: hasLabelProp
        ? "label prop"
        : aria
          ? "aria-label"
          : labelledByExists
            ? "aria-labelledby"
            : idBound
              ? "label htmlFor"
              : "NONE",
      placeholder: (/placeholder=["']([^"']*)["']/.exec(attrs) || [])[1] || "",
      id: idMatch ? idMatch[1] : "",
    });
  });

  return results;
}

/** Every .jsx source file under a directory, excluding tests. */
export function jsxFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(p);
      } else if (entry.name.endsWith(".jsx")) {
        out.push(p);
      }
    }
  })(root);
  return out;
}

/**
 * Scan a source tree and return every control without an accessible name.
 */
export function scanProject(srcRoot) {
  const findings = [];
  for (const file of jsxFiles(srcRoot)) {
    const src = readFileSync(file, "utf8");
    const rel = relative(srcRoot, file).replace(/\\/g, "/");
    for (const row of [...findInputs(src), ...findTextInputs(src)]) {
      if (!row.named) findings.push({ file: rel, ...row });
    }
  }
  return findings;
}

// --- CLI --------------------------------------------------------------------
// Guarded so the pure functions above can be imported by the test suite without
// this walking the tree and exiting the process on import.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const findings = scanProject(join(root, "src"));

  if (findings.length === 0) {
    console.log("OK — every form control has an accessible name.");
    process.exit(0);
  }

  console.error(`FAIL — ${findings.length} control(s) with no accessible name:\n`);
  for (const f of findings) {
    console.error(
      `  ${f.file}:${f.line}  <${f.kind}>  placeholder="${f.placeholder.slice(0, 40)}"`,
    );
  }
  console.error(
    '\nFix: give the control a <label htmlFor="id"> + id="id", or an aria-label. ' +
      "The shared TextInput takes a `label` prop for this.",
  );
  process.exit(1);
}
