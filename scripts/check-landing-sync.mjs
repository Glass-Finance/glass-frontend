#!/usr/bin/env node
// scripts/check-landing-sync.mjs
//
// The marketing site (../glass-waitlist-v1) and this app deliberately keep
// separate copies of the shared landing/legal components — documented in
// README as a hand-porting rule. This script makes the drift visible: any
// file that exists in BOTH repos under a shared path must be byte-identical,
// UNLESS it is listed in INTENTIONALLY_DIVERGENT below.
//
// Why the list exists: a byte-identical rule cannot express "these two files
// are supposed to differ". The first version of this script had no list, so
// it could never pass — the app-only deployment concerns (cross-domain
// redirects, the marketing origin fallback, SEO vs page-title) are real and
// permanent, not drift. A gate that can never go green is a gate people learn
// to ignore, which defeats the point.
//
// The list is deliberately narrow and each entry OWES A REASON, the same rule
// PENDING_BACKEND_LIST in endpoint-audit.mjs follows. Adding an entry to make
// this check quiet is the failure mode to guard against: an entry is only
// legitimate if the difference is permanent by design. A missed port is not.
//
// Local/dev use:  npm run check:landing-sync
// CI: the sibling repo isn't checked out in this repository's workflow, so
// the script exits 0 with a SKIP notice unless the sibling is present at
// ../glass-waitlist-v1 (clone it next to this repo to run locally, or add a
// second checkout step to CI later).
//
// Exit codes: 0 = in sync (or only allowlisted differences), 1 = unexpected
// drift, 2 = the allowlist itself is wrong (stale/misspelled entry).

import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname, relative, sep } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const siblingRoot = join(appRoot, "..", "glass-waitlist-v1");

// Shared subtrees that are intentionally duplicated across the two repos.
const SHARED_ROOTS = [
  join("src", "components", "organizations"),
  join("src", "components", "members"),
  join("src", "components", "howItWorks"),
  join("src", "components", "legal"),
  join("src", "components", "ui"),
  join("src", "components", "common"),
  join("src", "pages", "legal"),
  join("src", "lib"),
  join("src", "utils"),
  "vercel.json",
  "eslint.config.js",
  ".prettierrc",
];

// Files that legitimately differ, and why the difference is permanent.
// Keys are repo-relative, POSIX-separated. A key that no longer differs is an
// error (exit 2): the exemption has outlived its reason and must be removed,
// otherwise it silently stops covering anything.
//
// NOTE: docs/design-system.md is a known fork and is deliberately NOT in
// SHARED_ROOTS. It renumbers sections (the app carries a 9.7 for dashboard
// settings rows that do not exist on the marketing site), so it can never be
// byte-identical. It is covered by its own in-file warning block instead.
const INTENTIONALLY_DIVERGENT = {
  "vercel.json":
    "Deployment headers differ by design: the marketing site redirects /sign-in, /invite, " +
    "etc. to app.glasspay.app and carries a report-only CSP; the app carries the endpoint " +
    "audit rewrite and the enforcing CSP with sha256 hashes. Same file name, different job.",

  "eslint.config.js":
    "Plugin major skew: react-refresh 0.4.x here vs 0.5.x in the marketing repo, and the " +
    "option names differ (allowConstantExport/customHOCs vs allowCompoundComponents/extraHOCs) " +
    "so a byte-copy fails schema validation. This repo also carries the pendo global and the " +
    "Node-tooling override for playwright/vite configs, which the marketing repo does not have.",

  "src/utils/deviceRedirect.js":
    "APP_ORIGIN's fallback is deployment-specific: here it falls back to window.location.origin " +
    "so local single-domain dev and invite links resolve; on the marketing site it is pinned to " +
    "https://app.glasspay.app because that deployment must always cross-origin hop. The " +
    "marketing copy also owns MARKETING_ORIGIN, which this repo does not need.",

  "src/utils/monitoring.js":
    "Sentry SDK major skew: @sentry/core 10.x here vs 11.x in the marketing repo. The v11 " +
    "dataCollection block carries urlQueryParams/databaseQueryData/graphQL, which v10 silently " +
    "drops on init, so the marketing copy ports only the five keys its SDK applies. Copying " +
    "the app's block verbatim would list a control that does nothing.",

  "src/pages/legal/PrivacyPolicy.jsx":
    "The marketing site is indexed by search engines and needs per-route canonical/OG metadata " +
    "(useSeoMeta); the app only needs a document title (usePageTitle). Same copy, different shell.",

  "src/pages/legal/TermsOfService.jsx":
    "Same as PrivacyPolicy.jsx — useSeoMeta here, usePageTitle in the app.",

  "src/pages/legal/RefundPolicy.jsx":
    "Same as PrivacyPolicy.jsx — useSeoMeta here, usePageTitle in the app.",

  "src/pages/legal/AcceptableUsePolicy.jsx":
    "Same as PrivacyPolicy.jsx — useSeoMeta here, usePageTitle in the app.",

  "src/components/members/MembersCTA.jsx":
    "Navigation target differs by deployment: the marketing site must hop cross-origin via " +
    "goToApp() (with an isRedirecting flag for the gap before the browser leaves), the app " +
    "navigates in-app to /member/join.",

  "src/components/members/MembersHero.jsx":
    "Hero media differs: the marketing site runs its own PhoneHeroDemo; the app renders " +
    "CloudAspectImage and branches on mobileRequiredPath(). The goToApp vs navigate split " +
    "matches MembersCTA.jsx.",

  "src/components/members/MembersHowItWorks.jsx":
    "Different step component per repo: this repo renders howItWorks/HowItWorksSection, the " +
    "marketing site renders members/MembersHowItWorksSection. Same slot, two components.",

  "src/components/organizations/GetStarted.jsx":
    "Same split as MembersHowItWorks.jsx: organizations/OrganizationHowItWorks in the marketing " +
    "site vs the shared howItWorks/HowItWorksSection here. The goToApp vs navigate difference " +
    "matches MembersCTA.jsx.",

  "src/components/organizations/Hero.jsx":
    "Forced by file layout: Reveal.jsx lives at components/Reveal.jsx in the marketing site but " +
    "components/organizations/Reveal.jsx here, so the import path must differ.",
};

function walk(root, dir, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(root, full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Best-effort: which side last touched this path? Helps the porter know which
// direction to copy. Never fatal — a shallow clone or no git is not an error.
function lastTouched(repoRoot, relPath) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", relPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

if (!existsSync(siblingRoot)) {
  console.log(
    `SKIP: sibling repo not found at ${siblingRoot} — clone glass-waitlist-v1 ` +
      `next to this repo (or add a CI checkout) to run the landing-sync check.`,
  );
  process.exit(0);
}

const drift = [];
const allowed = [];
const listProblems = [];
let compared = 0;

for (const shared of SHARED_ROOTS) {
  const appPath = join(appRoot, shared);
  const mkPath = join(siblingRoot, shared);

  const appIsFile = existsSync(appPath) && statSync(appPath).isFile();
  const mkIsFile = existsSync(mkPath) && statSync(mkPath).isFile();

  if (appIsFile && mkIsFile) {
    compared += 1;
    const label = shared.split(sep).join("/");
    if (sha256(appPath) === sha256(mkPath)) {
      if (INTENTIONALLY_DIVERGENT[label]) {
        listProblems.push(`${label} — listed as intentionally divergent but the files match`);
      }
    } else if (INTENTIONALLY_DIVERGENT[label]) {
      allowed.push(label);
    } else {
      drift.push(label);
    }
    continue;
  }

  if (existsSync(appPath) && statSync(appPath).isDirectory()) {
    for (const file of walk(appRoot, appPath)) {
      const rel = relative(appRoot, file);
      const other = join(siblingRoot, rel);
      if (!existsSync(other) || !statSync(other).isFile()) continue; // repo-specific file
      compared += 1;
      const label = rel.split(sep).join("/");
      if (sha256(file) === sha256(other)) {
        if (INTENTIONALLY_DIVERGENT[label]) {
          listProblems.push(`${label} — listed as intentionally divergent but the files match`);
        }
      } else if (INTENTIONALLY_DIVERGENT[label]) {
        allowed.push(label);
      } else {
        drift.push(label);
      }
    }
  }
}

// An allowlist entry that names a path neither repo has is almost certainly a
// typo or a rename nobody followed up. Catch it here rather than letting it
// rot into a no-op exemption.
const seen = new Set([...drift, ...allowed]);
for (const key of Object.keys(INTENTIONALLY_DIVERGENT)) {
  if (!seen.has(key)) {
    const existsSomewhere = existsSync(join(appRoot, key)) && existsSync(join(siblingRoot, key));
    listProblems.push(
      existsSomewhere
        ? `${key} — allowlist entry matches nothing (files are in sync)`
        : `${key} — allowlist entry names a path that does not exist in either repo`,
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (allowed.length > 0) {
  console.log(`Allowlisted differences (${allowed.length}) — expected, by design:\n`);
  for (const f of allowed.sort()) {
    console.log(`  ~ ${f}`);
  }
  console.log();
}

if (listProblems.length > 0) {
  console.error("FAIL: the intentional-divergence list itself is out of date:\n");
  for (const p of listProblems) console.error(`  ! ${p}`);
  console.error(
    "\nRemove entries that no longer differ, and fix any that name a missing path. " +
      "A stale exemption hides future drift.",
  );
  process.exit(2);
}

if (drift.length > 0) {
  console.error(`FAIL: ${drift.length} file(s) drifted between the two repos:\n`);
  for (const f of drift.sort()) {
    const appDate = lastTouched(appRoot, f);
    const mkDate = lastTouched(siblingRoot, f);
    let hint = "";
    if (appDate && mkDate && appDate !== mkDate) {
      hint =
        appDate > mkDate
          ? "  (app newer — port app → v1)"
          : "  (v1 newer — check if this belongs in the allowlist)";
    }
    console.error(`  ✗ ${f}${hint}`);
  }
  console.error(
    "\nPort the newer copy to the other repo (see README 'two-repo' rule), or — if the " +
      "difference is permanent by design — add it to INTENTIONALLY_DIVERGENT with a reason.",
  );
  process.exit(1);
}

console.log(
  `OK: ${compared} shared file(s) identical; ${allowed.length} allowlisted difference(s).`,
);
