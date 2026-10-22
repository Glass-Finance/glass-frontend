import { test, expect } from "@playwright/test";
import { createScenario, installNetworkMock, preparePage, json } from "./support.js";

test("member registration works on desktop and mobile", async ({ page }) => {
  const scenario = createScenario({
    overrides: [
      {
        method: "POST",
        match: (url) => url.pathname.endsWith("/auth/register"),
        handle: async (route, request) => {
          scenario.registerRequest = request.postDataJSON();
          await json(route, 201, { success: true, data: { emailVerified: false } });
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

  await expect(page.getByRole("heading", { name: "Complete Your Profile" })).toBeVisible();
  await page.getByLabel("First Name").fill("New");
  await page.getByLabel("Last Name").fill("Member");
  await page.getByLabel("Create Password").fill("MemberPass1!");
  await page.getByLabel("Confirm Password").fill("MemberPass1!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  await expect(page.getByText("new.member@example.test")).toBeVisible();
  expect(scenario.registerRequest).toMatchObject({
    email: "new.member@example.test",
    firstName: "New",
    lastName: "Member",
    password: "MemberPass1!",
  });
});
