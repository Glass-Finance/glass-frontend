// Shared fixtures and the single catch-all network dispatcher for the E2E
// suite. Every request whose pathname starts with /api/v1 (whether the app's
// API base is the absolute https://api.glasspay.app or a same-origin
// /api/v1) is answered right here; the Paystack authorization URL is served
// a local stub; everything else outside our own dev server (Pendo, Google
// Identity Services, Sentry, Vercel, Cloudinary) is aborted. No test ever
// reaches a real backend, provider, or credential.

const API_PREFIX = "/api/v1";

// The API origin may differ from the app origin (absolute VITE_API_BASE_URL),
// so fulfilled responses carry CORS headers and preflights are answered —
// harmless when the base is same-origin, required when it is not.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "600",
};

const CHECKOUT_STUB_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Paystack Checkout (stub)</title></head>
  <body><h1>Paystack Checkout (stub)</h1></body>
</html>
`;

// Platform admin covers auth, session expiry, callback verification, and the
// admin mutation: resolvePostAuthDestination sends isPlatformAdmin first, to
// /dashboard/admin-panel, and PaymentCallback renders the admin/desktop
// presentation exactly when isAdmin is true.
export const ADMIN_PERSONA = {
  id: "usr-admin-e2e",
  email: "admin@glass-e2e.test",
  accessToken: "e2e-admin-access-token",
  refreshToken: "e2e-admin-refresh-token",
  user: {
    id: "usr-admin-e2e",
    email: "admin@glass-e2e.test",
    role: "SUPER_ADMIN",
    emailVerified: true,
    isPlatformAdmin: true,
    isAdmin: true,
  },
  profile: {
    id: "usr-admin-e2e",
    email: "admin@glass-e2e.test",
    platformRole: "SUPER_ADMIN",
    emailVerified: true,
    enabled: true,
    firstName: "Ada",
    lastName: "Admin",
    userData: { firstName: "Ada", lastName: "Admin", profileImage: null },
  },
};

// Seeded member session for the payment-initiation journey: MemberProtected
// Route only needs token + verified session, and a USER role keeps the member
// app open (isAdmin false → no bounce to the desktop dashboard).
export const MEMBER_PERSONA = {
  id: "usr-member-e2e",
  email: "member@glass-e2e.test",
  accessToken: "e2e-member-access-token",
  refreshToken: "e2e-member-refresh-token",
  user: {
    id: "usr-member-e2e",
    email: "member@glass-e2e.test",
    role: "USER",
    emailVerified: true,
    isPlatformAdmin: false,
    isAdmin: false,
  },
  profile: {
    id: "usr-member-e2e",
    email: "member@glass-e2e.test",
    platformRole: "USER",
    emailVerified: true,
    enabled: true,
    firstName: "Mo",
    lastName: "Member",
    userData: { firstName: "Mo", lastName: "Member", profileImage: null },
  },
};

export function createScenario(overrides = {}) {
  return {
    persona: ADMIN_PERSONA,
    expired: false,
    loginResult: "success",
    verifyStatus: "SUCCESSFUL",
    suspended: false,
    calls: {},
    // Per-test route rules, checked before the built-in dispatcher:
    // { method?, match(url), handle(route, request, url) -> true when handled }
    overrides: [],
    ...overrides,
  };
}

export async function json(route, status, body) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

export async function ok(route, data) {
  await json(route, 200, { success: true, data });
}

function listEnvelope(items) {
  return {
    content: items,
    pageNumber: 0,
    pageSize: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    last: true,
  };
}

function parseBody(request) {
  try {
    return request.postDataJSON() ?? null;
  } catch {
    return null;
  }
}

function usersFixture(scenario) {
  return {
    id: "usr-e2e-1",
    email: "member@example.test",
    userData: { firstName: "Mona", lastName: "Member" },
    platformRole: "USER",
    isPlatformAdmin: false,
    enabled: !scenario.suspended,
    emailVerified: true,
    lastLoginAt: "2026-09-20T09:30:00.000Z",
    metrics: { totalRelatedCommunities: 2 },
  };
}

async function handleApi(route, request, url, scenario) {
  const method = request.method();
  const path = url.pathname.slice(API_PREFIX.length);

  if (method === "OPTIONS") {
    const requested = request.headers()["access-control-request-headers"];
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, "access-control-allow-headers": requested || "*" },
      body: "",
    });
    return;
  }

  for (const rule of scenario.overrides) {
    if (rule.method && rule.method !== method) continue;
    if (!rule.match(url, request)) continue;
    if (await rule.handle(route, request, url)) return;
  }

  // The realtime ticket is minted "successfully" but carries no ticket: the
  // stream hook then throws internally and backs off, so no EventSource ever
  // opens. It is exempt from expired-mode 401s as well, so the session-expiry
  // test's trigger stays the debounced search query below rather than
  // whichever retry happens to fire first.
  if (method === "POST" && path === "/realtime/ticket") {
    await ok(route, {});
    return;
  }

  // Whole-session expiry: every API call 401s — including the refresh call —
  // which drives client.js's documented clearSessionAndRedirect path.
  if (scenario.expired) {
    await json(route, 401, { success: false, message: "Unauthorized" });
    return;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (method === "POST" && path === "/auth/login") {
    scenario.calls.login = parseBody(request);
    if (scenario.loginResult === "failure") {
      // Generic message → errorHandler's pre-auth 401 fallback copy.
      await json(route, 401, { success: false, message: "Unauthorized" });
      return;
    }
    const { user, accessToken, refreshToken } = scenario.persona;
    await ok(route, {
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      platformRole: user.role,
      emailVerified: true,
      mfaRequired: false,
    });
    return;
  }
  if (method === "POST" && path === "/auth/logout") {
    scenario.calls.logout = parseBody(request);
    await ok(route, {});
    return;
  }
  if (method === "POST" && path === "/auth/token/refresh") {
    await ok(route, { accessToken: "e2e-refreshed-access", refreshToken: "e2e-refreshed-refresh" });
    return;
  }

  // ── Session hydration ─────────────────────────────────────────────────────
  if (method === "GET" && path === "/user/me") {
    await ok(route, scenario.persona.profile);
    return;
  }

  // ── Platform admin: users table + the one covered mutation ───────────────
  if (method === "GET" && path === "/admin/users") {
    await ok(route, listEnvelope([usersFixture(scenario)]));
    return;
  }
  if (method === "PATCH" && /^\/admin\/users\/[^/]+\/suspend$/.test(path)) {
    scenario.suspended = true;
    scenario.calls.suspend = { path, body: parseBody(request) };
    await ok(route, { enabled: false });
    return;
  }

  // ── Payment callback verification ─────────────────────────────────────────
  if (method === "POST" && path === "/payments/callback/verify") {
    scenario.calls.verify = { path, query: url.search, body: parseBody(request) };
    await ok(route, {
      status: scenario.verifyStatus,
      verificationQueued: false,
      transactionId: "txn-e2e-1",
    });
    return;
  }
  // Fetched the instant verification settles on success (see the comment on
  // useTransactionDetail): full shape so formatNaira never sees undefined.
  if (method === "GET" && path.startsWith("/finance/transactions/me/")) {
    await ok(route, {
      id: "txn-e2e-1",
      internalReference: path.slice(path.lastIndexOf("/") + 1),
      reference: path.slice(path.lastIndexOf("/") + 1),
      amount: 250000,
      currency: "NGN",
      status: scenario.verifyStatus,
      isRecurring: false,
      description: "E2E payment",
      createdAt: "2026-09-23T10:00:00.000Z",
      paidAt: "2026-09-23T10:00:00.000Z",
    });
    return;
  }

  // ── Payment initiation (authorization redirect boundary) ──────────────────
  if (method === "POST" && path.startsWith("/payments/pay/payment-links/")) {
    scenario.calls.initiate = { path, body: parseBody(request) };
    await ok(route, {
      transactionId: "txn-e2e-1",
      reference: "ref_e2e_1",
      authorizationUrl: "https://checkout.paystack.com/e2e-session",
      accessCode: "e2e-access-code",
      amount: 250000,
      currency: "NGN",
    });
    return;
  }

  // ── Defaults ──────────────────────────────────────────────────────────────
  if (method === "GET" || method === "HEAD") {
    if (path === "/notifications/unread-count") {
      await ok(route, { count: 0 });
      return;
    }
    if (path === "/notifications/preferences") {
      await ok(route, { email: true, inApp: true });
      return;
    }
    // Paginated-list envelope covers every list GET the journeys touch
    // (/communities/me, /admin/communities, /notifications, invites,
    // authorisations, …) — consumers all read .content defensively.
    await ok(route, listEnvelope([]));
    return;
  }
  await ok(route, {});
}

export async function installNetworkMock(page, scenario) {
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch {
      await route.abort();
      return;
    }

    if (url.pathname.startsWith(API_PREFIX)) {
      try {
        await handleApi(route, request, url, scenario);
      } catch (err) {
        await json(route, 500, { success: false, message: String(err) });
      }
      return;
    }

    // The authorization boundary the payment journey must reach — served as
    // a local stub page, never the real provider.
    if (url.hostname === "checkout.paystack.com") {
      await route.fulfill({ status: 200, contentType: "text/html", body: CHECKOUT_STUB_HTML });
      return;
    }

    // Our own dev server (app bundle, HMR, assets) passes through untouched.
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }

    // Every other origin is third-party — never contacted.
    await route.abort();
  });
}

// Per-page init scripts. The first-run dashboard tour overlay renders
// fixed-inset z-[100] and swallows every dashboard click, so its
// localStorage seen-flag is seeded in all tests — it is a UI preference
// flag, not behavior under test. Session seeding is guarded by a
// sessionStorage marker because init scripts rerun on every hard navigation:
// after clearSessionAndRedirect wipes the tokens (session-expiry journey),
// the guard must keep the redirect from resurrecting the session.
export async function preparePage(page, persona = null) {
  await page.addInitScript((seed) => {
    try {
      localStorage.setItem("glass_dashboard_tour_seen", "1");
      if (!seed) return;
      if (sessionStorage.getItem("glass_e2e_seeded") === "1") return;
      sessionStorage.setItem("glass_e2e_seeded", "1");
      localStorage.setItem("accessToken", seed.accessToken);
      localStorage.setItem("refreshToken", seed.refreshToken);
      localStorage.setItem("userId", seed.id);
      localStorage.setItem("userEmail", seed.email);
      localStorage.setItem("glass_user", JSON.stringify(seed.user));
      localStorage.setItem("glass_session_epoch", "1");
    } catch {
      // Storage unavailable — nothing to seed.
    }
  }, persona);
}
