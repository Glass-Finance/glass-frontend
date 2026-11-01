import { test, expect } from "@playwright/test";
import { MEMBER_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

test("desktop member routes are device-gated to the QR handoff", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop device gate");
  await page.setViewportSize({ width: 1440, height: 960 });
  await installNetworkMock(page, createScenario({ persona: MEMBER_PERSONA }));
  await preparePage(page, MEMBER_PERSONA);

  // Even a fully authenticated member session never renders the member app
  // on desktop — MemberDeviceGuard sends it to the QR handoff first.
  await page.goto("/member/home");
  await expect(page).toHaveURL(/\/member\/mobile-required\?to=%2Fmember%2Fhome/);
  await expect(page.getByRole("heading", { name: "Scan To Continue On Your Phone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Member app navigation" })).toBeHidden();

  // /member/join is gated the same way.
  await page.goto("/member/join");
  await expect(page).toHaveURL(/\/member\/mobile-required\?to=%2Fmember%2Fjoin/);
  await expect(page.getByRole("heading", { name: "Scan To Continue On Your Phone" })).toBeVisible();
});

test("member app uses the mobile shell with a full-width tab bar", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile member app shell");
  await installNetworkMock(page, createScenario({ persona: MEMBER_PERSONA }));
  await preparePage(page, MEMBER_PERSONA);

  await page.goto("/member/home", { waitUntil: "domcontentloaded" });

  // The bottom tab bar spans the full screen width — no desktop offset.
  // (Asserted before any data-dependent content: the shell renders before
  // the mocked community fetches resolve.)
  const mobileNav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(mobileNav).toBeVisible({ timeout: 30_000 });
  const navBox = await mobileNav.boundingBox();
  const viewport = page.viewportSize();
  expect(navBox.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(Math.abs(navBox.x)).toBeLessThanOrEqual(1);

  // The member shell itself — home renders the community empty state for
  // this persona once the mocked fetches settle.
  await expect(page.getByText("You're not part of any community yet.")).toBeVisible({
    timeout: 30_000,
  });

  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).resolves.toBe(true);

  const responsivePages = [
    { path: "/member/invites", title: "Invitations" },
    { path: "/member/notifications", title: "Notifications" },
    { path: "/member/communities/search", title: "Browse Communities" },
    { path: "/member/upcoming", title: "Upcoming payments" },
    { path: "/member/transactions", title: "Payment History" },
    { path: "/member/transactions/txn-e2e-1", title: "Transaction Details" },
    { path: "/member/profile", title: "Profile" },
    { path: "/member/security", title: "Security" },
    { path: "/member/notification-settings", title: "Notifications" },
    { path: "/member/saved-cards", title: "Payment Methods" },
    { path: "/member/auto-pay", title: "Auto-Pay" },
    { path: "/member/communities", title: "My communities" },
    { path: "/member/verify-identity/history", title: "Verification History" },
  ];

  for (const { path, title } of responsivePages) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  // Tab navigation still works from the restored tab bar.
  await page.goto("/member/home");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "History" })
    .click();
  await expect(page).toHaveURL(/\/member\/transactions$/);
  await expect(page.getByRole("heading", { name: "Payment History", exact: true })).toBeVisible();
});
