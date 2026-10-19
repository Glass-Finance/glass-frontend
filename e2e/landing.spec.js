import { test, expect } from "@playwright/test";

// Public landing must render without a backend. Pendo/analytics are blocked
// (see blockExternal) so the test stays hermetic and fast.
test.beforeEach(async ({ page }) => {
  await page.route("**cdn.pendo.io/**", (r) => r.abort());
  await page.route("**sentry.io/**", (r) => r.abort());
  await page.route("**res.cloudinary.com/**", (r) => r.abort());
  await page.route("**vercel-scripts.com/**", (r) => r.abort());
  await page.route("**vitals.vercel-insights.com/**", (r) => r.abort());
  await page.route("**api.pendo.io/**", (r) => r.abort());
});

test("landing page renders the organizations hero", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "landing checked on desktop");
  await page.goto("/");
  await expect(page).toHaveTitle(/Community Finance/i);
  await expect(page.getByRole("navigation").first()).toBeVisible();
});

test("sign-in page is reachable from the public route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "auth checked on desktop");
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/Sign in/i);
});
