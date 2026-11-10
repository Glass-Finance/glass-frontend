import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

// Community-setup onboarding on a phone (Figma "iPhone 16 - 108" to "- 118").
// These pin the phone layout only; desktop keeps its sidebar, step label and
// dialogs, which the unit suite and the desktop pages already cover.

const PHONE = { width: 393, height: 852 };

const PERSONA = {
  ...ADMIN_PERSONA,
  user: { ...ADMIN_PERSONA.user, role: "USER", isPlatformAdmin: false, isAdmin: true },
  profile: { ...ADMIN_PERSONA.profile, platformRole: "USER" },
};

const PROGRESS = {
  email: "ada@kings.edu",
  isPaying: true,
  communityId: "comm-kings",
  communitySlug: "kings-college",
  communityName: "Kings College",
};

test.describe("onboarding on a phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
    const scenario = createScenario();
    scenario.persona = PERSONA;
    await installNetworkMock(page, scenario);
    await preparePage(page, PERSONA);
    await page.addInitScript(
      (p) => sessionStorage.setItem("glass_onboarding_progress", JSON.stringify(p)),
      PROGRESS,
    );
  });

  test("the first two steps drop the step label and pair Skip with Continue", async ({ page }) => {
    for (const path of ["choose-path", "paying-member"]) {
      await page.goto(`/onboarding/${path}`);
      await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
      await expect(page.getByText(/^Step \d of \d$/)).toBeHidden();

      const skip = await page.getByRole("button", { name: "Skip" }).boundingBox();
      const cont = await page.getByRole("button", { name: "Continue" }).boundingBox();
      // One row: Skip on the left, Continue the wider button on the right.
      expect(Math.abs(skip.y + skip.height / 2 - (cont.y + cont.height / 2))).toBeLessThan(2);
      expect(skip.x + skip.width).toBeLessThanOrEqual(cont.x);
      expect(cont.width).toBeGreaterThan(skip.width);
    }
  });

  test("the setup steps show the three-step stepper instead of the step label", async ({
    page,
  }) => {
    const cases = [
      ["organization-profile", "Organization Profile"],
      ["payment-profile", "Payment Profile"],
      ["members", "Members"],
    ];
    for (const [path, active] of cases) {
      await page.goto(`/onboarding/${path}`);
      const stepper = page.getByRole("list", { name: "Setup progress" });
      await expect(stepper).toBeVisible();
      await expect(stepper.locator('[aria-current="step"]')).toHaveText(active);
      await expect(page.getByText(/^Step \d of \d$/)).toBeHidden();
      await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
      // The desktop text back link and top bar are desktop-only.
      await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeHidden();
      await expect(page.getByRole("banner")).toBeHidden();
    }
  });

  test("the community-live screen is a full page with a Copy Community Link button", async ({
    page,
  }) => {
    await page.goto("/onboarding/members");
    await page.getByRole("button", { name: "Create Your Community" }).click();

    await expect(page.getByRole("button", { name: "Go To Dashboard" })).toBeVisible();
    const copy = page.getByRole("button", { name: "Copy Community Link" });
    await expect(copy).toBeVisible();
    await expect(page.getByRole("button", { name: /click here to copy/i })).toBeHidden();
    // Full width, matching Go To Dashboard.
    const dash = await page.getByRole("button", { name: "Go To Dashboard" }).boundingBox();
    const copyBox = await copy.boundingBox();
    expect(Math.abs(copyBox.width - dash.width)).toBeLessThan(2);
  });
});
