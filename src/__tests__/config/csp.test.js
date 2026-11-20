import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The deployed Content-Security-Policy lives in vercel.json (enforcement mode,
// not Report-Only). There is no test for it, which is how two real production
// breaks shipped: a directive is only updated when someone remembers, and
// nothing notices when they don't.
//
// Both of these blocked a working feature, and neither shows up in typecheck,
// lint, build, or the unit suite:
//
//   frame-src  — the inline Smile ID SDK (src/utils/smileScript.js loads
//     cdn.usesmileid.com/inline/v12/js/script.min.js) renders its capture UI in
//     a REMOTE IFRAME served from the same host. cdn.usesmileid.com was
//     allowlisted in script-src and img-src, and camera access was granted to it
//     in Permissions-Policy, but frame-src was never updated to match — so the
//     KYC capture iframe was refused. It has never been in frame-src in any
//     revision of this file.
//
//   style-src  — @react-oauth/google loads Google Identity Services, which
//     injects https://accounts.google.com/gsi/style at runtime. script-src
//     already allows accounts.google.com, but style-src did not, so the
//     "Continue with Google" button rendered unstyled.
//
// This asserts the host each directive must carry. When a new third-party
// dependency is added, adding it here first is what stops the next one from
// shipping broken — the alternative is reading a browser console report.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function readCsp() {
  const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
  const entry = vercel.headers
    .flatMap((route) => route.headers ?? [])
    .find((h) => h.key === "Content-Security-Policy");
  expect(entry, "vercel.json must set a Content-Security-Policy header").toBeDefined();
  return entry.value;
}

const CSP = readCsp();

/** Sources listed for a directive, e.g. ["'self'", "https://cdn.pendo.io"]. */
function sourcesFor(directive) {
  const match = CSP.split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${directive} `));
  expect(match, `CSP must declare ${directive}`).toBeDefined();
  return match.split(/\s+/).slice(1);
}

describe("CSP is served in enforcement mode", () => {
  // Report-Only logs violations without blocking. Both bugs below were only
  // ever *reported* in Report-Only mode, which is exactly why they reached
  // production unnoticed.
  it("serves Content-Security-Policy, not -Report-Only", () => {
    const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
    const keys = vercel.headers.flatMap((r) => r.headers ?? []).map((h) => h.key);

    expect(keys).toContain("Content-Security-Policy");
    expect(keys).not.toContain("Content-Security-Policy-Report-Only");
  });

  it("keeps the reporting endpoint so future violations are still collected", () => {
    expect(CSP).toMatch(/report-to\s+csp-violations/);
  });
});

describe("frame-src", () => {
  it("allows the Smile ID iframe, which renders the KYC capture UI", () => {
    // The inline SDK draws its capture UI in a remote iframe on this host.
    // Without this the identity-verification step cannot display at all.
    expect(sourcesFor("frame-src")).toContain("https://cdn.usesmileid.com");
  });

  it("keeps the Paystack checkout frame, which the hosted payment redirect needs", () => {
    expect(sourcesFor("frame-src")).toContain("https://checkout.paystack.com");
  });

  it("keeps Google frames for One Tap / the GIS credential flow", () => {
    const sources = sourcesFor("frame-src");
    expect(sources).toContain("https://accounts.google.com");
    expect(sources).toContain("https://*.google.com");
  });

  it("does not fall back to allowing every origin", () => {
    // A '*' here would silently re-open clickjacking and credential phishing
    // via framed pages, which is the whole point of keeping this list tight.
    expect(sourcesFor("frame-src")).not.toContain("*");
  });
});

describe("style-src", () => {
  it("allows the Google Identity Services stylesheet", () => {
    // GSI injects /gsi/style at runtime; script-src alone does not cover it
    // because it is a stylesheet, not a script.
    expect(sourcesFor("style-src")).toContain("https://accounts.google.com");
  });

  it("keeps 'unsafe-inline' only because React sets inline styles", () => {
    // Present and load-bearing — this test documents that its removal is a
    // separate, deliberate task, not something to tidy up in passing.
    expect(sourcesFor("style-src")).toContain("'unsafe-inline'");
  });

  it("does not fall back to allowing every origin", () => {
    expect(sourcesFor("style-src")).not.toContain("*");
  });
});

describe("script-src", () => {
  it("keeps the hash allowlist for the inline scripts in index.html", () => {
    // These cover the ld+json structured data and the Pendo bootstrap. Editing
    // either script's content invalidates its hash — see the CSP note at the
    // top of index.html and scripts/compute-csp-hashes.mjs.
    const sources = sourcesFor("script-src");
    expect(sources.filter((s) => s.startsWith("'sha256-")).length).toBeGreaterThanOrEqual(2);
  });

  it("does not fall back to 'unsafe-inline'", () => {
    // Unlike style-src, script-src has no inline-style excuse: the hash
    // allowlist is what replaced it.
    expect(sourcesFor("script-src")).not.toContain("'unsafe-inline'");
  });

  it("keeps the hosts the app's third-party scripts load from", () => {
    const sources = sourcesFor("script-src");
    for (const host of [
      "https://accounts.google.com", // Google Identity Services
      "https://apis.google.com",
      "https://cdn.pendo.io", // Pendo agent
      "https://cdn.usesmileid.com", // Smile ID inline SDK
      "https://vercel.live", // Vercel feedback toolbar
    ]) {
      expect(sources).toContain(host);
    }
  });
});

describe("connect-src", () => {
  it("keeps the backend and telemetry endpoints the app actually calls", () => {
    const sources = sourcesFor("connect-src");
    for (const host of [
      "https://api.glasspay.app",
      "https://staging-api.glasspay.app",
      "https://staging-app.glasspay.app",
      "https://api.smileidentity.com",
      "https://testapi.smileidentity.com",
      "https://res.cloudinary.com",
      "wss://*.relay.crisp.chat",
    ]) {
      expect(sources).toContain(host);
    }
  });

  it("does not need cdn.usesmileid.com — the SDK's API host is smileidentity.com", () => {
    // The SDK script itself loads via script-src and its API calls go to
    // api/testapi.smileidentity.com. Browsers also request
    // cdn.usesmileid.com/inline/v12/js/script.min.js.map, but that is a
    // devtools source map: blocked harmlessly, and deliberately not
    // allowlisted here so connect-src is not widened for a cosmetic console
    // warning. If a future SDK version starts calling its own CDN over
    // fetch/XHR, add it here and note why.
    expect(sourcesFor("connect-src")).not.toContain("https://cdn.usesmileid.com");
  });
});

// There was no img-src coverage at all, which is how TWO real production
// breaks shipped through this file: files.glasspay.app (every user-uploaded
// avatar and community logo) and lh3.googleusercontent.com (the Google
// sign-in avatar). Neither shows up in typecheck, lint, build, or the unit
// suite — only a browser console.
describe("img-src", () => {
  it("allows the backend file host, or every uploaded avatar/logo is blocked", () => {
    // GET /communities/me and /user/me return logo.url and
    // profileImage.url on this host. Without it the images simply never load.
    expect(sourcesFor("img-src")).toContain("https://files.glasspay.app");
    expect(sourcesFor("img-src")).toContain("https://files-cqhym3i5wilhrzya-vc.t3.storageapi.dev");
  });

  it("allows the Google avatar host, or the 'Continue with Google' avatar is blocked", () => {
    // The `picture` claim on the Google ID token points at this host and is
    // bound straight to <img src> in GoogleAuthButton. script-src and
    // style-src already allow accounts.google.com (see above) — without this
    // the button renders but its avatar does not.
    expect(sourcesFor("img-src")).toContain("https://lh3.googleusercontent.com");
  });

  it("keeps the Cloudinary delivery host, which serves the marketing imagery", () => {
    expect(sourcesFor("img-src")).toContain("https://res.cloudinary.com");
  });

  it("keeps data: and blob:, which local previews and inline images rely on", () => {
    // data: is narrowed elsewhere (safeImageUrl rejects it for remote values);
    // here it is needed for inline SVG/data images the app renders itself.
    const sources = sourcesFor("img-src");
    expect(sources).toContain("data:");
    expect(sources).toContain("blob:");
  });

  it("does not fall back to allowing every origin", () => {
    // '*' would let any attacker-chosen host serve an image into the app.
    expect(sourcesFor("img-src")).not.toContain("*");
  });
});

describe("Permissions-Policy stays consistent with frame-src", () => {
  it("grants camera to the Smile ID host, so the iframe it serves can capture", () => {
    const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
    const entry = vercel.headers
      .flatMap((route) => route.headers ?? [])
      .find((h) => h.key === "Permissions-Policy");
    expect(entry).toBeDefined();
    // The mismatch that hid this bug: camera was granted to
    // cdn.usesmileid.com while frame-src refused to let it be framed at all.
    expect(entry.value).toMatch(/camera=\([^)]*https:\/\/cdn\.usesmileid\.com/);
    expect(sourcesFor("frame-src")).toContain("https://cdn.usesmileid.com");
  });

  it("keeps geolocation denied and microphone granted only to self and Crisp", () => {
    const vercel = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
    const entry = vercel.headers
      .flatMap((route) => route.headers ?? [])
      .find((h) => h.key === "Permissions-Policy");
    // microphone was fully denied (()), which hard-blocked the Crisp chatbox
    // voice-message feature before any permission prompt could appear. It is
    // now delegated to self + the Crisp chatbox origin only, and the grant's
    // origin must be one frame-src actually lets us frame (same invariant as
    // the Smile ID camera test above).
    expect(entry.value).toMatch(/microphone=\(self "https:\/\/\*\.crisp\.chat"\)/);
    expect(entry.value).toMatch(/geolocation=\(\)/);
    expect(sourcesFor("frame-src")).toContain("https://*.crisp.chat");
  });
});
