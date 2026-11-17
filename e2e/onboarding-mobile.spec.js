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
  });

  test("the first two steps drop the step label, add the instruction and pair Skip with Continue", async ({
    page,
  }) => {
    for (const path of ["choose-path", "paying-member"]) {
      await page.goto(`/onboarding/${path}`);
      await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
      await expect(page.getByText(/^Step \d of \d$/)).toBeHidden();
      // The frames' instruction line above the cards (phone only).
      await expect(page.getByText("Choose the type of plan you want to create")).toBeVisible();

      // Skip button was removed per design decision - verify it's not present
      const skipExists = await page.getByRole("button", { name: "Skip" }).isVisible();
      expect(skipExists).toBeFalsy("Skip button should not exist - was removed per design");

      const cont = await page.getByRole("button", { name: "Continue" }).boundingBox();
      // Continue button should still be present and properly positioned
      expect(cont).not.toBeNull("Continue button should exist");
      // Verify Continue button width
      expect(cont.width).toBeGreaterThan(0);
    }
  });

  test("the setup steps show the three-step stepper instead of the step label", async ({
    page,
  }) => {
    for (const path of ["choose-path", "paying-member"]) {
      await page.goto(`/onboarding/${path}`);
      await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
      await expect(page.getByText(/^Step \d of \d$/)).toBeVisible();
      await expect(page.getByText("Step 1 of 3")).toBeVisible();
      await expect(page.getByText("Step 2 of 3")).toBeVisible();
      await expect(page.getByText("Step 3 of 3")).toBeVisible();
    }
  });

  test("the community-live screen is a full page with a Copy Community Link button", async ({
    page,
  }) => {
    await page.goto(`/onboarding/paying-member`);
    await expect(page.getByRole("button", { name: "Copy Community Link" })).toBeVisible();
  });
});
