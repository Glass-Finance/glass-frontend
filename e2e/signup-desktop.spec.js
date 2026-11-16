import { test, expect } from "@playwright/test";
import { createScenario, installNetworkMock, preparePage, json } from "./support.js";

// Desktop sign-up (Figma "MacBook Pro 14"" frames). The steps follow the
// 1728px frames, so on smaller laptop screens they must still fit: no
// sideways or vertical scrolling in the form sheet at any step, including
// the tallest state (Complete Your Profile with the password checklist open).
//
// The order is verify-then-create: email -> emailed code -> profile. The
// backend rejects register() without the emailConfirmToken the code step
// produces, so the profile form is no longer reachable first.

const SIZES = [
  { width: 1728, height: 982 },
  { width: 1366, height: 657 },
  { width: 1024, height: 768 },
];

async function sheetOverflow(page) {
  return page.evaluate(() => {
    const sheet = [...document.querySelectorAll("div")].find(
      (d) => d.className.includes("overflow-y-auto") && d.className.includes("flex-1"),
    );
    return {
      x: sheet.scrollWidth - sheet.clientWidth,
      y: sheet.scrollHeight - sheet.clientHeight,
    };
  });
}

test("sign-up steps fit the screen without overflow", async ({ page }) => {
  const okPost = (re, data = {}) => ({
    method: "POST",
    match: (u) => re.test(u.pathname),
    handle: async (route) => {
      await json(route, 200, { success: true, data });
      return true;
    },
  });
  await installNetworkMock(
    page,
    createScenario({
      overrides: [
        okPost(/\/auth\/email\/request-otp$/),
        // The code step hands register() its emailConfirmToken.
        okPost(/\/auth\/email\/verify-otp$/, { confirmToken: "e2e-confirm-token" }),
        okPost(/\/auth\/register$/),
      ],
    }),
  );
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

    // "Verification Code Sent" (252:16554) -- the code screen now sits
    // between the email and the profile form.
    await page.getByLabel("Verification code").waitFor();
    expect(await sheetOverflow(page), `code ${size.width}x${size.height}`).toEqual({ x: 0, y: 0 });

    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Continue" }).click();

    // Complete Your Profile with the password checklist open: tallest state.
    await page.getByLabel("Create Password").waitFor();
    await page.getByLabel("Create Password").focus();
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

    // Registration is the last step: the account is verified when it returns,
    // so the confirmation screen leads straight to onboarding.
    await expect(page.getByText("Your Email Has Been Verified!")).toBeVisible();
    expect(await sheetOverflow(page), `verified ${size.width}x${size.height}`).toEqual({
      x: 0,
      y: 0,
    });
  }
});
