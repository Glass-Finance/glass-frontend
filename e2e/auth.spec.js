import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

// One platform-admin persona covers the whole auth journey: the shared
// SignIn page serves sign-in and failure alike, and resolvePostAuthDestination
// routes isPlatformAdmin first — straight to /dashboard/admin-panel.
const PASSWORD = "CorrectHorseBattery1!";

test("signs in and lands in the platform admin shell", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "admin shell is desktop");
  const scenario = createScenario();
  await installNetworkMock(page, scenario);
  await preparePage(page); // fresh session — only the tour flag is pre-seeded

  await page.goto("/sign-in");
  await page.locator("#identifier").fill(ADMIN_PERSONA.email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await page.waitForURL("**/dashboard/admin-panel");
  await expect(page.getByRole("heading", { name: "Platform Admin" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("accessToken")))
    .toBe(ADMIN_PERSONA.accessToken);

  // The credential payload matches the backend login contract.
  expect(scenario.calls.login).toMatchObject({
    email: ADMIN_PERSONA.email,
    password: PASSWORD,
  });
  expect(scenario.calls.login.deviceInfo).toBeTruthy();
});

test("shows the pre-auth error copy when credentials are rejected", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "admin shell is desktop");
  const scenario = createScenario({ loginResult: "failure" });
  await installNetworkMock(page, scenario);
  await preparePage(page);

  await page.goto("/sign-in");
  await page.locator("#identifier").fill(ADMIN_PERSONA.email);
  await page.locator("#password").fill("WrongPassword123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // A 401 from a pre-auth endpoint is "wrong credentials", not an expired
  // session — errorHandler's fallback copy renders inline (and may be
  // mirrored by the toast), hence .first().
  await expect(page.getByText("Incorrect email or password.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(scenario.calls.login).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
});

test("logs out from the dashboard shell", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "admin shell is desktop");
  const scenario = createScenario();
  await installNetworkMock(page, scenario);
  await preparePage(page, ADMIN_PERSONA);

  await page.goto("/dashboard/admin-panel");
  await expect(page.getByRole("heading", { name: "Platform Admin" })).toBeVisible();

  await page.locator('[title="Log out"]').first().click();

  await page.waitForURL("**/sign-in");
  await expect(page.getByText("Signed out")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(scenario.calls.logout).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
});

test("hard-redirects to sign-in with the expiry toast when refresh fails", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "admin shell is desktop");
  const scenario = createScenario();
  await installNetworkMock(page, scenario);
  await preparePage(page, ADMIN_PERSONA);

  await page.goto("/dashboard/admin-panel");
  await expect(page.getByRole("heading", { name: "Platform Admin" })).toBeVisible();

  // Load the Users tab so its list query is live, then expire the session.
  // The search input's 350ms debounce produces a new queryKey → a fresh
  // GET /admin/users → 401 → POST /auth/token/refresh → 401 →
  // clearSessionAndRedirect (client.js) → hard navigation + expiry flag →
  // SignIn's one-shot toast.
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.getByRole("row", { name: /member@example\.test/ })).toBeVisible();

  scenario.expired = true;
  await page.getByPlaceholder("Search users…").fill("mona");

  await page.waitForURL("**/sign-in");
  await expect(page.getByText("Session expired")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
});
