import { test, expect } from "@playwright/test";
import { createScenario, installNetworkMock, preparePage, json } from "./support.js";

test("member registration works on desktop and mobile", async ({ page }) => {
  const scenario = createScenario({
    overrides: [
      {
        method: "POST",
        match: (url) => url.pathname.endsWith("/auth/email/request-otp"),
        handle: async (route) => {
          await json(route, 200, { success: true, data: {} });
          return true;
        },
      },
      {
        method: "POST",
        match: (url) => url.pathname.endsWith("/auth/email/verify-otp"),
        handle: async (route) => {
          await json(route, 200, { success: true, data: { confirmToken: "e2e-confirm-token" } });
          return true;
        },
      },
      {
        method: "POST",
        match: (url) => url.pathname.endsWith("/auth/register"),
        handle: async (route, request) => {
          scenario.registerRequest = request.postDataJSON();
          // No session in the response: this test stops at the payload, and
          // the legacy fallback screen it lands on is not what it asserts.
          await json(route, 201, { success: true, data: { emailVerified: true } });
          return true;
        },
      },
    ],
  });
  await installNetworkMock(page, scenario);
  await preparePage(page);

  await page.goto("/member/join");
  await expect(page.getByRole("heading", { name: "Create Your Account" })).toBeVisible();
  await page.getByLabel("Email Address").fill("new.member@example.test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Verify-then-create: the emailed code comes BEFORE the profile form,
  // because register() needs the confirmToken it yields.
  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  await expect(page.getByText("new.member@example.test")).toBeVisible();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Complete Your Profile" })).toBeVisible();
  await page.getByLabel("First Name").fill("New");
  await page.getByLabel("Last Name").fill("Member");
  await page.getByLabel("Create Password").fill("MemberPass1!");
  await page.getByLabel("Confirm Password").fill("MemberPass1!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect
    .poll(() => scenario.registerRequest)
    .toMatchObject({
      email: "new.member@example.test",
      firstName: "New",
      lastName: "Member",
      password: "MemberPass1!",
      emailConfirmToken: "e2e-confirm-token",
    });
});
