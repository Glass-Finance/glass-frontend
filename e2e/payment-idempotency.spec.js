import { test, expect } from "@playwright/test";

// The double-charge guard, end-to-end through the real browser app:
// a payment attempt that fails once and is retried on the same mounted
// Payment Summary must resend the SAME idempotencyKey. Everything is
// mocked at the network layer — no backend, no Paystack, no money.
// (The complementary live probe is `npm run probe:idempotency`.)

const API = "**/api/v1/**";

const user = {
  id: "e2e-user-1",
  email: "e2e@glasspay.test",
  platformRole: "USER",
  emailVerified: true,
  firstName: "E2E",
  lastName: "Tester",
};

const obligation = {
  id: "obl-e2e-1",
  amount: 500000,
  community: { name: "E2E Test Community" },
  paymentLink: { id: "link-e2e-1", title: "Termly Dues" },
  recurringPlan: null,
};

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

const emptyPage = { success: true, data: { content: [], totalElements: 0, number: 0, size: 20 } };

test("retrying a failed payment reuses the same idempotencyKey", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "member pay flow is mobile-only");

  // Seed a session before any app code runs — AuthContext restore then
  // verifies it against the mocked /user/me + /communities/me below.
  await page.addInitScript((u) => {
    localStorage.setItem("accessToken", "e2e-access-token");
    localStorage.setItem("refreshToken", "e2e-refresh-token");
    localStorage.setItem("glass_user", JSON.stringify(u));
    localStorage.setItem("glass_session_epoch", "1");
  }, user);

  // Block third-party noise; let our checkout stand-in through.
  await page.route(
    /(cdn\.pendo\.io|sentry\.io|res\.cloudinary\.com|vercel-scripts\.com|vitals\.vercel-insights\.com|api\.pendo\.io)/,
    (r) => r.abort(),
  );
  // Stand-in for Paystack's hosted page so the success redirect is observable.
  await page.route("https://checkout.example.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<html><body>checkout stub</body></html>" }),
  );

  // Catch-all API mock first (Playwright matches later routes first)…
  await page.route(API, (route) => route.fulfill(json(emptyPage)));

  // …then the specific endpoints the payment screen needs.
  await page.route("**/api/v1/user/me", (route) =>
    route.fulfill(json({ success: true, data: user })),
  );
  await page.route("**/api/v1/communities/me", (route) =>
    route.fulfill(json({ success: true, data: { content: [] } })),
  );
  await page.route("**/api/v1/finance/obligations/me/obl-e2e-1", (route) =>
    route.fulfill(json({ success: true, data: obligation })),
  );
  await page.route("**/api/v1/finance/authorizations*", (route) =>
    route.fulfill(json({ success: true, data: { content: [] } })),
  );
  await page.route("**/api/v1/notifications*", (route) =>
    route.fulfill(json({ success: true, data: { content: [], totalElements: 0 } })),
  );
  await page.route("**/api/v1/realtime/ticket", (route) =>
    route.fulfill(json({ success: true, data: { ticket: "e2e-ticket" } })),
  );

  // Payment init: fail the first call (simulated network/backend hiccup),
  // succeed the second — and record every idempotencyKey sent.
  const keys = [];
  let initCalls = 0;
  await page.route("**/api/v1/payments/pay/payment-links/*", async (route) => {
    initCalls += 1;
    const body = route.request().postDataJSON();
    keys.push(body?.idempotencyKey ?? null);
    if (initCalls === 1) {
      await route.fulfill(json({ success: false, message: "temporary failure" }, 500));
    } else {
      await route.fulfill(
        json({
          success: true,
          data: {
            transactionId: "tx-e2e-1",
            reference: "ref-e2e-1",
            authorizationUrl: "https://checkout.example.com/pay/ref-e2e-1",
            billedAmount: 510000,
            idempotencyKey: body?.idempotencyKey,
          },
        }),
      );
    }
  });

  await page.goto("/member/pay/obl-e2e-1");

  const payButton = page.getByRole("button", { name: /make payment/i });
  await expect(payButton).toBeEnabled({ timeout: 15_000 });

  // Attempt 1 → backend 500 → inline error surfaces the (non-generic)
  // backend message, button stays usable for a retry.
  await payButton.click();
  // Scoped to <main> — the same message also appears in the toast region.
  await expect(page.getByRole("main").getByText("temporary failure")).toBeVisible({
    timeout: 15_000,
  });
  await expect(payButton).toBeEnabled();

  // Attempt 2 → same mounted flow → must reuse the key, then redirect.
  await payButton.click();
  await expect(page).toHaveURL(/checkout\.example\.com/, { timeout: 15_000 });

  expect(initCalls).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  // UUID shape — the same contract paymentIdempotencyContract.test.js pins.
  expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
