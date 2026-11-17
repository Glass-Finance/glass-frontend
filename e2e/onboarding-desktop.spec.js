import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage, ok } from "./support.js";

// Desktop Choose Path and Paying Member (Figma "MacBook Pro 14" - 24 / - 35").
// Pins what the frames changed on desktop -- no "Step X of Y" label, the
// 300px card row -- and that both screens fit laptop screens without
// scrolling (the frames are 982px tall; shorter screens tighten spacing).

const PERSONA = {
  ...ADMIN_PERSONA,
  user: { ...ADMIN_PERSONA.user, role: "USER", isPlatformAdmin: false, isAdmin: true },
  profile: { ...ADMIN_PERSONA.profile, platformRole: "USER" },
};

const SIZES = [
  { width: 1728, height: 982 },
  { width: 1366, height: 657 },
];

test.beforeEach(async ({ page }) => {
  const scenario = createScenario();
  scenario.persona = PERSONA;
  // Not yet verified, so /onboarding/verify-identity opens on "Choose ID".
  scenario.overrides.push({
    match: (u) => u.pathname === "/api/v1/kyc",
    handle: async (route) => {
      await ok(route, { status: "NOT_STARTED", canStart: true, attemptsAllowed: true });
      return true;
    },
  });
  await installNetworkMock(page, scenario);
  await preparePage(page, PERSONA);
});

for (const path of ["choose-path", "paying-member"]) {
  test(`${path} follows the desktop frame and fits the screen`, async ({ page }) => {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.goto(`/onboarding/${path}`);
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
      await expect(page.getByText(/^Step \d of \d$/)).toHaveCount(0);

      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
      }));
      expect(overflow, `${path} ${size.width}x${size.height}`).toEqual({ x: 0, y: 0 });

      if (size.height === 982) {
        // Two cards side by side, 300px tall.
        const cards = page
          .locator("main button, div > button")
          .filter({ hasText: /Community|dues|exempt/ });
        const boxes = await cards.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { y: Math.round(r.y), h: Math.round(r.height) };
          }),
        );
        expect(boxes).toHaveLength(2);
        expect(boxes[0].y).toBe(boxes[1].y);
        expect(boxes[0].h).toBe(300);
      }
    }
  });
}

test("verify identity opens on the desktop Choose ID layout and drives the shared flow", async ({
  page,
}) => {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/onboarding/verify-identity");
    await expect(
      page.getByRole("heading", { name: "Choose how to verify your identity" }),
    ).toBeVisible();
    await expect(
      page.getByText("Step 1 of 3", { exact: true }).locator("visible=true"),
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - innerWidth,
      y: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(overflow, `verify-identity ${size.width}x${size.height}`).toEqual({ x: 0, y: 0 });
  }

  // Picking NIN updates the primary action; Continue moves the shared flow on.
  await page.getByRole("radio", { name: /NIN/ }).check({ force: true });
  const cont = page.getByRole("button", { name: "Continue with NIN" });
  await expect(cont).toBeVisible();
  await cont.click();
  await expect(
    page.getByRole("heading", { name: "Choose how to verify your identity" }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Open Smile ID" })).toBeVisible();
});
