import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage, ok } from "./support.js";

// Admin dashboard responsiveness (Figma 1:13185). Pixel 7 is 412px wide;
// the Figma phone frame and the review harness both target 365, so override
// the project viewport. Desktop geometry is covered by the unit suite and the
// desktop-chromium project — these tests pin the phone layout only.

const C = "kings-college";
const PHONE = { width: 365, height: 833 };

// SUPER_ADMIN bounces /dashboard/admin to /dashboard/admin-panel; a community
// owner keeps the community shell (owned: true passes hasAdminCommunity).
const PERSONA = {
  ...ADMIN_PERSONA,
  user: { ...ADMIN_PERSONA.user, role: "USER", isPlatformAdmin: false, isAdmin: true },
  profile: { ...ADMIN_PERSONA.profile, platformRole: "USER" },
};

const env = (items) => ({
  content: items,
  pageNumber: 0,
  pageSize: 20,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  last: true,
});

function seedDashboard(scenario) {
  const route = (path, data) =>
    scenario.overrides.push({
      match: (u) => u.pathname === path,
      handle: async (r) => {
        await ok(r, data);
        return true;
      },
    });

  scenario.persona = PERSONA;
  route(
    "/api/v1/communities/me",
    env([
      {
        id: "comm-kings",
        slug: C,
        name: "Kings College",
        owned: true,
        memberRole: "COMMUNITY_OWNER",
        memberStatus: "ACTIVE",
        logo: null,
      },
    ]),
  );
  route(`/api/v1/communities/${C}`, {
    id: "comm-kings",
    slug: C,
    name: "Kings College",
    owned: true,
    metrics: {
      activeMembers: 12,
      inactiveMembers: 1,
      overdueMembers: 0,
      outstandingAmount: 0,
      currency: "NGN",
    },
  });
  route(
    `/api/v1/communities/${C}/members`,
    env([
      {
        id: "m1",
        status: "ACTIVE",
        memberRole: "MEMBER",
        billingExempt: false,
        user: { id: "u1", firstName: "Ada", lastName: "Admin", email: "a@x.test" },
      },
    ]),
  );
  route(`/api/v1/communities/${C}/members/me`, {
    id: "m1",
    status: "ACTIVE",
    billingExempt: false,
    memberRole: "MEMBER",
    user: { id: "u1", firstName: "Ada", lastName: "Admin", email: "admin@glass-e2e.test" },
  });
  route(
    `/api/v1/communities/${C}/payment-links`,
    env([
      {
        id: "pl1",
        slug: "dues",
        title: "Termly Dues",
        description: "",
        paymentType: "ONE_TIME",
        amount: 5000,
        status: "ACTIVE",
        activateImmediately: true,
        recurringPlan: null,
        reminderFrequency: null,
        reminderChannels: [],
        amountMode: "FIXED",
        audience: "ALL_MEMBERS",
        visibility: "PUBLIC",
        memberIds: [],
        groupIds: [],
        dueAt: "2026-12-01",
        metrics: {
          amountCollected: 0,
          expectedAmount: 0,
          currency: "NGN",
          audienceSize: 0,
          membersFullyPaid: 0,
          membersPartiallyPaid: 0,
          membersUnpaid: 0,
        },
      },
    ]),
  );
  route(
    `/api/v1/communities/${C}/finance/transactions`,
    env(
      Array.from({ length: 10 }, (_, i) => ({
        id: `tx-${i}`,
        status: i % 2 ? "SUCCESSFUL" : "PENDING",
        amount: 5000,
        description: "Termly Dues",
        planName: "Termly Dues",
        channel: "CARD",
        internalReference: `r${i}`,
        createdAt: "2026-10-15T10:00:00Z",
        paidAt: "2026-10-15T10:00:00Z",
        member: { user: { id: "u1", firstName: "Ada", lastName: "Admin", email: "a@x.test" } },
      })),
    ),
  );
  route(`/api/v1/communities/${C}/finance/obligations`, env([]));
  route(`/api/v1/communities/${C}/activity`, env([]));
  route(`/api/v1/communities/${C}/account`, { id: "acc-1", status: "ACTIVE" });
  route(`/api/v1/communities/${C}/invites/me`, env([]));
  route("/api/v1/finance/obligations/me", env([]));
  route("/api/v1/finance/transactions/me", env([]));
  route("/api/v1/finance/authorizations", env([]));
  route("/api/v1/payment-links", env([]));
  route("/api/v1/notifications", env([]));
  return scenario;
}

test.describe("admin dashboard — phone layout (365px)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "phone layout only");
    await page.setViewportSize(PHONE);
    await installNetworkMock(page, seedDashboard(createScenario()));
    await preparePage(page, PERSONA, {
      seedTour: testInfo.title !== "first-run tour is optional and its choice persists",
    });
  });

  test("page header is hidden; shell + content stack for the phone frame", async ({ page }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(page.locator("header").getByText("Dashboard")).toBeVisible();
    await expect(page.locator("header").getByText("Kings College")).toBeVisible();
    // The desktop-only h1/subtitle block is display:none below md.
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeHidden();
    await expect(page.getByText("Active Plans")).toBeVisible();
    expect(
      await page.getByText("Active Plans").evaluate((el) => Boolean(el.closest(".col-span-2"))),
    ).toBe(true);
    await expect(page.getByText("Member Payments")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("admin-mobile-365.png"), fullPage: true });
  });

  test("first-run tour is optional and its choice persists", async ({ page }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    const prompt = page.getByRole("region", { name: "Dashboard tour" });
    await expect(prompt).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await prompt.getByRole("button", { name: "Take a tour" }).click();
    await expect(page.getByRole("button", { name: "Close tour" })).toBeVisible();
    await page.getByRole("button", { name: "Close tour" }).click();
    await expect(prompt).toBeHidden();
    await page.reload();
    await expect(prompt).toBeHidden();
  });

  test("drawer opens full width with the community switcher", async ({ page }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch community" })).toBeVisible();
    await expect(page.getByText("Take the tour")).toBeVisible();
    const communityHeading = page
      .getByRole("button", { name: "Switch community" })
      .locator("xpath=../preceding-sibling::div[1]");
    await expect(communityHeading).toHaveText("Kings College");
    expect(
      await communityHeading.evaluate((el) => el.parentElement.getBoundingClientRect().width),
    ).toBeGreaterThan(180);
    await page.waitForTimeout(350);
    await page.screenshot({ path: test.info().outputPath("admin-mobile-drawer.png") });

    await page.getByRole("button", { name: "Switch community" }).click();
    await expect(page.getByText("Your Communities")).toBeVisible();
  });

  test("filter dropdown, chips and pagination are reachable on the phone", async ({ page }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    const section = page.locator('[data-tour="member-payments-table"]');
    await section.scrollIntoViewIfNeeded();
    await section.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByRole("menu", { name: "Filter payments" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Termly Dues" }).click();
    await expect(page.getByRole("button", { name: "Clear All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Termly Dues filter" })).toBeVisible();
  });

  test("members are presented as actionable cards on the phone", async ({ page }) => {
    await page.goto(`/dashboard/members?community=${C}`);
    await expect(page.getByRole("button", { name: "Remove Ada Admin" })).toBeVisible();
    await expect(page.getByRole("listitem").getByText("0/1 Paid")).toBeVisible();
    await expect(page.locator("table")).toBeHidden();
  });
});
