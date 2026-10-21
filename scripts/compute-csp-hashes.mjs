// Prints the CSP 'sha256-<hash>' source for every inline <script> in the
// built index.html (i.e. one with no src attribute) -- run after `npm run
// build` whenever the structured-data or Pendo bootstrap script in
// index.html changes, and paste the matching hash into vercel.json's
// Content-Security-Policy script-src.
//
// Usage: node scripts/compute-csp-hashes.mjs
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const OPEN = "<!--";
const CLOSE = "-->";

/**
 * Remove every complete HTML comment, scanning explicitly rather than by regex.
 *
 * This exists because a wrong answer here produces a wrong CSP hash, and a wrong
 * CSP hash is a production break that only surfaces as a browser console error.
 * The previous `html.replace(/<!--[\s\S]*?-->/g, "")` is flagged by CodeQL as
 * `js/incomplete-multi-character-sanitization`.
 *
 * Scope of the actual defect, verified against the old implementation rather
 * than assumed: the lazy `[\s\S]*?` handles ADJACENT and NESTED comment markers
 * correctly, because `-->` legitimately ends a comment in HTML and the regex
 * resumes after it. What it does NOT do is notice an UNTERMINATED `<!--`. It
 * silently returns the input unchanged, so a comment that is never closed leaves
 * the rest of the file unstripped -- and if that comment mentions a <script> in
 * prose (the exact case this stripper was added for), that commented-out code
 * gets hashed as though it were a real inline script. The maintainer then pastes
 * a hash for dead content into vercel.json while the real inline script goes
 * unhashed and is blocked in production.
 *
 * So the fix is to fail loudly rather than to guess: an unterminated `<!--` is an
 * error, never a silent pass-through, because a partial strip produces a
 * confidently wrong hash and a confidently wrong CSP.
 *
 * Deliberately not a general HTML parser. This only needs to know where comments
 * begin and end, and it refuses to guess: an unterminated `<!--` is an error,
 * never a partial strip, because silently returning truncated HTML would produce
 * a confidently wrong hash.
 *
 * @param {string} html
 * @returns {string} the input with every complete comment removed
 * @throws {Error} if a `<!--` has no terminating `-->`
 */
export function stripHtmlComments(html) {
  let out = "";
  let cursor = 0;

  for (;;) {
    const start = html.indexOf(OPEN, cursor);
    if (start === -1) {
      // No further comment start: everything from here is real content.
      out += html.slice(cursor);
      return out;
    }

    // Real content before the comment is always kept, including any text that
    // merely looks like markup.
    out += html.slice(cursor, start);

    const end = html.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) {
      throw new Error(
        `Unterminated HTML comment starting at offset ${start} (no "${CLOSE}" found). ` +
          `Refusing to guess which content is inside the comment, because a partial ` +
          `strip yields a wrong CSP hash. Check dist/index.html for a stray "${OPEN}".`,
      );
    }

    // Resume *after* the closing delimiter, so adjacent comments each get their
    // own complete match.
    cursor = end + CLOSE.length;
  }
}

/**
 * Contents of every inline <script> (i.e. with no src attribute), in document
 * order. Comments are removed first so a comment mentioning "<script>" in prose
 * can't be mistaken for a real tag.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function findInlineScriptContents(html) {
  const withoutComments = stripHtmlComments(html);
  return [...withoutComments.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );
}

/** @param {string} content */
export function hashInlineScript(content) {
  return createHash("sha256").update(content, "utf8").digest("base64");
}

// --- CLI --------------------------------------------------------------------
// Guarded so the pure functions above can be imported by the test suite without
// this trying to read dist/index.html (and exiting the process) on import.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const htmlPath = join(root, "dist", "index.html");

  let html;
  try {
    html = readFileSync(htmlPath, "utf8");
  } catch {
    console.error(`Couldn't read ${htmlPath} -- run \`npm run build\` first.`);
    process.exit(1);
  }

  let inlineScripts;
  try {
    inlineScripts = findInlineScriptContents(html);
  } catch (err) {
    console.error(`${err.message}`);
    process.exit(1);
  }

  if (inlineScripts.length === 0) {
    console.log("No inline <script> tags (without src) found in dist/index.html.");
  }

  inlineScripts.forEach((content, i) => {
    const hash = hashInlineScript(content);
    const preview = content.trim().slice(0, 60).replace(/\s+/g, " ");
    console.log(`#${i}  sha256-${hash}`);
    console.log(`    ${preview}${content.trim().length > 60 ? "..." : ""}\n`);
  });
}
