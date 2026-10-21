#!/usr/bin/env node
// scripts/endpoint-audit.mjs
//
// Compares every HTTP call this app can make against the routes the backend
// actually exposes, using the deployed springdoc document as the source of
// truth — no backend checkout required.
//
// Why this exists: an audit against the backend source found the frontend
// calling POST /communities/{id}/payment-links/{id}/reminders, a route that
// does not exist at all. It sat behind a finished-looking modal, and nothing
// in CI complained, because a call to a nonexistent route type-checks, lints,
// builds and passes unit tests exactly like a real one. This script is the
// missing assertion.
//
// Reports, in order:
//   UNMATCHED   frontend call with no backend route. A bug, unless it is in
//               PENDING_BACKEND (a route we know is not deployed yet).
//   PENDING     known-missing backend routes, with the reason they are safe.
//   UNCONNECTED backend routes nothing calls — a roadmap, not an error, so it
//               only prints with --unconnected.
//   INFRA       backend routes that are not frontend surfaces (provider
//               webhooks, provider redirect targets, health). Never counted.
//
// Usage:
//   npm run audit:endpoints                          # fetch the live OpenAPI
//   node scripts/endpoint-audit.mjs --unconnected    # + roadmap view
//   node scripts/endpoint-audit.mjs --strict         # exit 1 on any drift
//   node scripts/endpoint-audit.mjs --openapi doc.json   # offline, no network
//   node scripts/endpoint-audit.mjs --api https://staging.example.com
//
// Exit codes: 0 = no unmatched calls, or no OpenAPI source reachable (that is
// a SKIP, not a pass, and says so). 1 = unmatched calls found, with --strict.

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Configuration ───────────────────────────────────────────────────────────

// Routes the backend exposes but that are not frontend surfaces. Listing them
// keeps them out of the unconnected count — they would otherwise read as
// "features nobody built". Written in readable form (leading slash and all);
// normalized into comparison keys at startup.
const INFRA_ROUTE_LIST = [
  "GET /status", // Spring Boot health probe
  "POST /webhooks/payments/paystack", // provider → backend
  "POST /webhooks/smile-id", // provider → backend
  "POST /webhooks/smile-id/attempts/{attemptId}", // per-attempt variant
  "GET /payments/callback/paystack", // provider redirects the payer here
];

// Frontend calls whose backend route does not exist yet, and why that is
// tolerated. Anything added here needs a comment justifying the wait; an
// entry with no justification is just a way to hide a bug.
//
// Currently empty. The entry that used to be here — GET /user/crisp-token —
// is gone because the frontend stopped calling it: the backend mints no
// chat-specific token, and useCrispToken reads the account's stable
// `externalReference` off the GET /user/me response instead (see
// src/hooks/useCrispToken.js). With no call site the entry matched nothing,
// so the audit never reported it as PENDING, and its stated reason ("useCrispToken
// maps 404 → null") described a request the hook no longer makes.
//
// A future call to a route the backend has not deployed belongs here, with
// its reason, added when the call site is added — not before.
const PENDING_BACKEND_LIST = [];

// Frontend call sites that build a trailing path segment from a local
// variable, so the literal alone can't be matched. Each entry expands one
// call into the concrete routes it can produce; a new verb added at the call
// site but not here is reported as UNMATCHED, which is the point.
const TEMPLATE_ACTIONS = [
  {
    file: "src/api/payments.js",
    // patchAction(action) → PATCH .../payment-links/{id}/{action}; group 1 is
    // everything before the verb, so an expansion is `${prefix}/${verb}`.
    match: /^(.*\/payment-links\/\{\})\/(\{\})$/,
    values: ["activate", "pause", "resume", "expire", "archive"],
  },
];

// Methods worth comparing. springdoc also advertises HEAD/OPTIONS noise.
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

// ── Arguments ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const showUnconnected = flag("--unconnected");
const strict = flag("--strict");
const openapiFile = option("--openapi");

// ── OpenAPI source ──────────────────────────────────────────────────────────

// CI sets VITE_API_BASE_URL in the job env; locally .env usually has it. Read
// the file by hand rather than pulling in dotenv so the script keeps working
// with zero dependencies, like the rest of scripts/.
function baseUrlFromEnv() {
  if (process.env.VITE_API_BASE_URL) return process.env.VITE_API_BASE_URL;
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("VITE_API_BASE_URL="));
  return line
    ?.slice("VITE_API_BASE_URL=".length)
    .trim()
    .replace(/^["']|["']$/g, "");
}

// A SKIP is not a pass. The "SKIP:" lines below say so for anyone reading the
// log, but in CI they scroll past as a green step while nothing was ever
// compared — the very failure mode this script exists to prevent. Surface the
// skip as a GitHub Actions warning so it shows up on the PR itself. Still
// exit 0: a backend outage must not block a frontend PR (see ci.yml).
function skipExit(annotation) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::warning::Endpoint audit skipped — ${annotation}`);
  }
  process.exit(0);
}

async function loadOpenApi() {
  if (openapiFile) {
    const path = join(root, openapiFile);
    if (!existsSync(path)) {
      console.error(`No OpenAPI file at ${path}`);
      process.exit(1);
    }
    return { doc: JSON.parse(readFileSync(path, "utf8")), source: path };
  }
  const base = option("--api") ?? baseUrlFromEnv();
  if (!base) {
    console.log("SKIP: no API base URL. Pass --api, set VITE_API_BASE_URL, or add it to .env.");
    skipExit("no API base URL configured");
  }
  const url = `${base.replace(/\/+$/, "")}/v3/api-docs`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { doc: await res.json(), source: url };
  } catch (err) {
    console.log(`SKIP: could not read ${url} (${err.message}).`);
    console.log("      Offline or unreachable is not a pass — run with --openapi <file> to check.");
    skipExit(`could not read ${url} (${err.message})`);
  }
}

// ── Path normalisation ──────────────────────────────────────────────────────

// Both sides collapse to `METHOD /a/b/{}`: the springdoc `/api/v1` prefix is
// dropped (the frontend client already appends it via baseURL), every
// frontend interpolation becomes a `{}` segment, and every springdoc
// `{paramName}` collapses to the same token — so `/communities/${id}` matches
// `/communities/{communityIdentifier}` no matter what either side names its
// parameters.
function normalizePath(raw) {
  return (
    raw
      // A full-URL call (client.js refreshes through raw axios so the request
      // can't re-enter the interceptor) carries its own base URL inline.
      .replace(/\$\{[^}]*baseURL[^}]*\}/g, "")
      .replace(/\$\{[^}]*\}/g, "{}")
      .replace(/\{[^}]*\}/g, "{}")
      .split("?")[0]
      .replace(/^\/+/, "")
      .replace(/^\/?api\/v1\/?/, "")
      .replace(/\/{2,}/g, "/")
      .replace(/\/$/, "") || "/"
  );
}

const routeKey = (method, path) => `${method.toUpperCase()} ${normalizePath(path)}`;

// Config lists above are written for humans ("GET /status"); routeKey would
// render the same thing without the leading slash. Going through one place
// keeps a typo in a comment from silently becoming a real exemption.
const INFRA_ROUTES = new Set(
  INFRA_ROUTE_LIST.map((entry) => {
    const [method, ...rest] = entry.trim().split(/\s+/);
    return routeKey(method, rest.join(" "));
  }),
);

const PENDING_BACKEND = new Map(
  PENDING_BACKEND_LIST.map(([entry, reason]) => {
    const [method, ...rest] = entry.trim().split(/\s+/);
    return [routeKey(method, rest.join(" ")), reason];
  }),
);

// ── Backend routes ──────────────────────────────────────────────────────────

function collectBackendRoutes(doc) {
  const routes = new Map();
  for (const [path, operations] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!METHODS.has(method.toUpperCase())) continue;
      const key = routeKey(method, path);
      routes.set(key, operation?.summary || operation?.operationId || "");
    }
  }
  return routes;
}

// ── Frontend calls ──────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Test doubles hard-code every route by hand; they are not call sites
      // and would drown the real ones.
      if (entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Matches `client.get("/x")` and `axios.post(`/x/${id}`)` — the only two
// receivers the app uses. A third instance means this scan needs updating.
const CALL_RE =
  /\b(?:client|axios)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*([`'"])((?:\\.|(?!\2)[\s\S])*)\2/g;

function collectFrontendCalls() {
  const calls = new Map();
  for (const file of walk(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file).split("\\").join("/");
    for (const match of text.matchAll(CALL_RE)) {
      const [, method, , literal] = match;
      const line = text.slice(0, match.index).split("\n").length;
      const add = (path) => {
        const key = routeKey(method, path);
        if (!calls.has(key)) calls.set(key, { sites: new Set() });
        calls.get(key).sites.add(`${rel}:${line}`);
      };
      // A templated trailing segment can only be checked against the verbs the
      // call site is allowed to produce — and when a rule applies, the bare
      // `{}` literal must NOT also be recorded, or it reports as a bug on a
      // call that is actually fine.
      const expansions = [];
      for (const rule of TEMPLATE_ACTIONS) {
        if (rel !== rule.file) continue;
        const parsed = rule.match.exec(normalizePath(literal));
        if (!parsed) continue;
        for (const value of rule.values) expansions.push(`${parsed[1]}/${value}`);
      }
      if (expansions.length) {
        expansions.forEach(add);
      } else {
        add(literal);
      }
    }
  }
  return calls;
}

// ── Report ──────────────────────────────────────────────────────────────────

const { doc, source } = await loadOpenApi();
const backend = collectBackendRoutes(doc);
const frontend = collectFrontendCalls();

const unmatched = [];
const pending = [];
for (const [key, entry] of frontend) {
  if (backend.has(key)) continue;
  if (PENDING_BACKEND.has(key)) pending.push([key, entry]);
  else unmatched.push([key, entry]);
}

const unconnected = [...backend.keys()]
  .filter((key) => !INFRA_ROUTES.has(key) && ![...frontend.keys()].includes(key))
  .sort();

console.log(`\nEndpoint audit — backend: ${source}`);
console.log(`  ${backend.size} backend routes · ${frontend.size} frontend call shapes\n`);

if (pending.length) {
  console.log(`PENDING (${pending.length}) — frontend call, backend route not deployed yet:`);
  for (const [key, entry] of pending) {
    console.log(`  ${key}`);
    console.log(`      ${PENDING_BACKEND.get(key)}`);
    console.log(`      called at ${[...entry.sites].join(", ")}`);
  }
  console.log("");
}

if (unmatched.length) {
  console.log(`UNMATCHED (${unmatched.length}) — frontend call with no backend route. BUGS:`);
  for (const [key, entry] of unmatched) {
    console.log(`  ${key}`);
    console.log(`      called at ${[...entry.sites].join(", ")}`);
  }
  console.log("");
} else {
  console.log("UNMATCHED (0) — every frontend call maps to a backend route.\n");
}

if (showUnconnected) {
  console.log(`UNCONNECTED (${unconnected.length}) — backend routes with no frontend call:`);
  for (const key of unconnected) {
    const summary = backend.get(key);
    console.log(`  ${key}${summary ? `  — ${summary}` : ""}`);
  }
  console.log("");
} else {
  console.log(`UNCONNECTED — ${unconnected.length} backend routes have no frontend call.`);
  console.log("              Roadmap view: re-run with --unconnected.\n");
}

if (strict && unmatched.length) {
  console.error(`FAIL: ${unmatched.length} frontend call(s) have no backend route.`);
  process.exit(1);
}
console.log("OK.\n");
