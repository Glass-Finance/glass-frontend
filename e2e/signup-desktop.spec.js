import { test, expect } from "@playwright/test";
import { createScenario, installNetworkMock, preparePage, json } from "./support.js";

// Desktop sign-up (Figma "MacBook Pro 14"" frames). The steps follow the
// 1728px frames, so on smaller laptop screens they must still fit: no
// sideways or vertical scrolling in the form sheet at any step, including
// the tallest state (Complete Your Profile with the password checklist open).

const SIZES = [
  { width: 1728, height: 982 },
  { width: 1366, height: 657 },
  { width: 1024, height: 768 },
];

async function sheetOverflow(page) {
  return page.evaluate(() => {
    // The form sheet in AuthLayout has both overflow-y-auto and flex-1.
    // Use a more specific selector: the sheet is the direct child of the
    // main flex container that has min-h-0 (ensures it's the scrollable
    // form area, not the hero panel or other overflow containers).
    const sheet = document.querySelector(
      "div.min-h-0.overflow-y-auto.flex-1, div.overflow-y-auto.flex-1.min-h-0",
    );
    if (!sheet) {
      // Fallback: find any div with both classes (handles class order variations)
      const fallback = [...document.querySelectorAll("div")].find(
        (d) => d.classList.contains("overflow-y-auto") && d.classList.contains("flex-1"),
      );
      if (!fallback) return { x: 0, y: 0 }; // No scrollable sheet found — treat as no overflow
      return {
        x: fallback.scrollWidth - fallback.clientWidth,
        y: fallback.scrollHeight - fallback.clientHeight,
      };
    }
    return {
      x: sheet.scrollWidth - sheet.clientWidth,
      y: sheet.scrollHeight - sheet.clientHeight,
    };
  });
}

test("sign-up steps fit the screen without overflow", async ({ page }) => {
  const okPost = (re) => ({
    method: "POST",
    match: (u) => re.test(u.pathname),
    handle: async (route) => {
      await json(route, 200, { success: true, data: {} });
      return true;
    },
  });
  await installNetworkMock(page, createScenario({ overrides: [okPost(/\/auth\/register$/)] }));
  await preparePage(page);

  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/sign-up");
    await page.getByLabel("Email Address").waitFor();
    // Terms error state ("MacBook Pro 14" - 125").
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Please Accept Our Terms to Continue")).toBeVisible();
    expect(await sheetOverflow(page), `email ${size.width}x${size.height}`).toEqual({ x: 0, y: 0 });

    await page.getByLabel("Email Address").fill("new.admin@example.test");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Create Password").focus(); // checklist open: tallest state
    await expect(page.getByLabel("First Name")).toBeVisible();
    expect(await sheetOverflow(page), `profile ${size.width}x${size.height}`).toEqual({
      x: 0,
      y: 0,
    });

    await page.getByLabel("First Name").fill("New");
    await page.getByLabel("Last Name").fill("Admin");
    await page.getByLabel("Create Password").fill("AdminPass1!");
    await page.getByLabel("Confirm Password").fill("AdminPass1!");
    await page.getByRole("button", { name: /Create Your Account/ }).click();
    await page.getByLabel("Verification code").waitFor();
    expect(await sheetOverflow(page), `code ${size.width}x${size.height}`).toEqual({ x: 0, y: 0 });
  }
});
