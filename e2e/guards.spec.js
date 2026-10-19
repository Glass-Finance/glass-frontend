import { test, expect } from "@playwright/test";

// Route guards are the app's first line of defence for "someone typed a URL".
// Unit tests cover the decision logic (src/__tests__/routes/guards.test.jsx);
// these pin the same behaviour through the real router + AuthContext boot.

function blockThirdParty(page) {
  return page.route(
    /(cdn\.pendo\.io|sentry\.io|res\.cloudinary\.com|vercel-scripts\.com|vitals\.vercel-insights\.com|api\.pendo\.io)/,
    (r) => r.abort(),
  );
}

test("unauthenticated /dashboard/home redirects to /sign-in", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "dashboard is desktop");
  await blockThirdParty(page);
  await page.goto("/dashboard/home");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("unauthenticated /member/home redirects to /member/app-sign-in on mobile", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "member app is mobile");
  await blockThirdParty(page);
  await page.goto("/member/home");
  await expect(page).toHaveURL(/\/member\/app-sign-in/);
});

test("desktop hitting a member route gets the mobile-required handoff", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "device gate checked on desktop");
  await blockThirdParty(page);
  await page.goto("/member/home");
  await expect(page).toHaveURL(/\/member\/mobile-required/);
});
