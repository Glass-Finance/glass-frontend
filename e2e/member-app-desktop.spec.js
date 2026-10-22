import { test, expect } from "@playwright/test";
import { MEMBER_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

test("member app uses desktop navigation and content layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop member-app shell");
  await page.setViewportSize({ width: 1440, height: 960 });
  await installNetworkMock(page, createScenario({ persona: MEMBER_PERSONA }));
  await preparePage(page, MEMBER_PERSONA);

  await page.goto("/member/home");

  await expect(page.getByRole("complementary", { name: "Member app navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole("link", { name: "Payment history" }).click();
  await expect(page).toHaveURL(/\/member\/transactions$/);
  await expect(page.getByRole("heading", { name: "Payment History" })).toBeVisible();

  await page.getByRole("link", { name: "Manage payments" }).click();
  await expect(page.getByRole("heading", { name: "Manage Payments" })).toBeVisible();
  await expect(page.getByText("Review recurring plans and manage auto-pay.")).toBeVisible();
  const managePaymentsWidth = await page
    .locator(".member-app-page-content > div > div")
    .nth(2)
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(managePaymentsWidth).toBeLessThanOrEqual(896);
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByText("Manage your account, payment preferences, and communities."),
  ).toBeVisible();
  const settingsWidth = await page
    .locator(".member-app-page-content > div > div")
    .nth(2)
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(settingsWidth).toBeLessThanOrEqual(768);
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(
    page.getByText("Manage your account, payment preferences, and communities."),
  ).toBeHidden();

  const responsivePages = [
    {
      path: "/member/invites",
      title: "Invitations",
      description: "Review community invitations and join requests.",
    },
    {
      path: "/member/notifications",
      title: "Notifications",
      description: "Stay up to date with payments, community activity, and invitations.",
    },
    {
      path: "/member/communities/search",
      title: "Browse Communities",
      description: "Find communities and send a request to join.",
    },
    {
      path: "/member/upcoming",
      title: "Upcoming Payments",
      description: "Review upcoming dues and export your payment schedule.",
    },
    {
      path: "/member/transactions",
      title: "Payment History",
      description: "View, filter, and export your past payments.",
    },
    {
      path: "/member/transactions/txn-e2e-1",
      title: "Transaction Details",
      description: "Review the receipt and details for this payment.",
    },
  ];

  for (const { path, title, description } of responsivePages) {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeHidden();
    const contentWidth = await page
      .locator(".member-app-page-content > div")
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(contentWidth).toBeLessThanOrEqual(1024);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByText(description)).toBeHidden();
  }
});
