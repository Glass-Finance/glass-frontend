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

  test("mobile shell keeps the centered Glass wordmark and stacks dashboard content", async ({
    page,
  }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Glass — your communities" })).toBeVisible();
    // The desktop-only h1/subtitle block is display:none below md.
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeHidden();
    await expect(page.getByText("Active Plans")).toBeVisible();
    expect(
      await page.getByText("Active Plans").evaluate((el) => Boolean(el.closest(".col-span-2"))),
    ).toBe(false);
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

  test("communities overview drawer lets admins enter a community", async ({ page }) => {
    await page.goto("/dashboard/home");
    await page.getByRole("button", { name: "Open menu" }).click();

    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Your communities" })).toBeVisible();
    const community = page.getByRole("button", { name: /^Kings College/ });
    await expect(community).toBeVisible();
    await community.click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/admin/paying\\?community=${C}`));
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

  test("settings swaps the topbar for a back button that returns to the opening page", async ({
    page,
  }) => {
    await page.goto(`/dashboard/admin?community=${C}`);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);

    // Phone frame (iPhone 16 - 91): no shared Topbar, a back button instead.
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

    // All five Account rows stay, including the two the frame doesn't draw.
    for (const row of ["Profile", "My Role", "Security", "Notifications", "Identity Verification"])
      // Scoped to <main>: the drawer has its own "Notifications" row.
      await expect(
        page
          .getByRole("main")
          .first()
          .getByRole("button", { name: new RegExp(`^${row}`) }),
      ).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("admin-mobile-settings.png") });

    // Moving between Settings tabs must not change where Back goes.
    await page.getByRole("button", { name: "Finance" }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/finance/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(`/dashboard/admin?community=${C}`);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("account profile follows the phone frame", async ({ page }) => {
    await page.goto(`/dashboard/settings/account/profile?community=${C}`);
    const main = page.getByRole("main").first();
    // Phone frame (iPhone 16 - 93): dotted initials, "Upload Picture", and a
    // full-width Save Changes and Delete.
    await expect(main.getByText("A.A", { exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "Upload Picture" })).toBeVisible();
    // No edit pencils on the phone (desktop keeps them).
    await expect(main.getByRole("button", { name: "Update email" })).toBeHidden();
    await expect(main.getByRole("button", { name: /^(Add|Update) phone number$/ })).toBeHidden();
    const save = main.getByRole("button", { name: "Save Changes" });
    const del = main.getByRole("button", { name: "Delete" });
    for (const button of [save, del]) {
      const width = await button.evaluate((el) => el.getBoundingClientRect().width);
      const cardWidth = await button.evaluate(
        (el) => el.closest(".border").getBoundingClientRect().width,
      );
      expect(width).toBeGreaterThan(cardWidth - 40);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath("admin-mobile-profile.png"),
      fullPage: true,
    });

    // With no pencil, tapping the phone field itself opens the add/verify flow.
    await main.getByRole("button", { name: "Add your phone number" }).click();
    await expect(main.getByText("Add Your Phone Number")).toBeVisible();
  });

  test("account role follows the phone frame", async ({ page }) => {
    await page.goto(`/dashboard/settings/account/role?community=${C}`);
    const main = page.getByRole("main").first();
    await expect(main.getByRole("button", { name: /^I Pay Dues/ })).toBeVisible();
    // Phone frame (iPhone 16 - 97): r=4 card and options, blue feedback banner.
    const radius = (loc) => loc.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(await radius(main.getByRole("button", { name: /^I Pay Dues/ }))).toBe("4px");
    const banner = main.getByText(/Changes take effect from the next billing cycle/);
    expect(await radius(banner.locator(".."))).toBe("4px");
    expect(await banner.locator("..").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(204, 218, 255)",
    );
    await page.screenshot({
      path: test.info().outputPath("admin-mobile-role.png"),
      fullPage: true,
    });
  });

  test("account security follows the phone frame", async ({ page }) => {
    await page.goto(`/dashboard/settings/account/security?community=${C}`);
    const main = page.getByRole("main").first();
    // Password rules stay hidden until New Password is focused.
    const rule = main.getByText("At least 8 characters");
    await expect(rule).toBeHidden();
    const newPassword = main.getByLabel("New Password", { exact: true });
    await newPassword.focus();
    await expect(rule).toBeVisible();
    // Leaving with a valid password hides them again. (Leaving it invalid
    // keeps them up -- they are the only explanation of that error.)
    await newPassword.fill("Glass123!");
    await main.getByLabel("Current Password", { exact: true }).focus();
    await expect(rule).toBeHidden();

    // Phone frame (iPhone 16 - 99) copy, and a switch in place of Enable.
    await expect(main.getByText("Two Factor Authentication")).toBeVisible();
    await expect(
      main.getByText("Add an extra layer of protection to your account", { exact: true }),
    ).toBeVisible();
    const twoFa = main.getByRole("switch", { name: "Enable 2FA" });
    await expect(twoFa).toHaveAttribute("aria-checked", "false");
    await expect(main.getByRole("button", { name: "Enable", exact: true })).toBeHidden();
    // SMS row keeps its "Coming soon" badge but drops the leading shield tile.
    await expect(main.getByText("Coming soon")).toBeVisible();
    const smsTitle = main.getByText("SMS Verification", { exact: true });
    expect(
      await smsTitle.evaluate((el) => {
        const tile = el.parentElement.previousElementSibling;
        return tile ? getComputedStyle(tile).display : "none";
      }),
    ).toBe("none");
    await page.screenshot({
      path: test.info().outputPath("admin-mobile-security.png"),
      fullPage: true,
    });

    // The switch opens the existing setup flow rather than flipping on its own.
    // Fill Current Password first: leaving it empty shows its "required"
    // message on blur, which shifts the switch down mid-tap.
    await main.getByLabel("Current Password", { exact: true }).fill("OldPass123!");
    await twoFa.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(twoFa).toHaveAttribute("aria-checked", "false");
  });

  test("community profile follows the phone frame", async ({ page }) => {
    await page.goto(`/dashboard/settings/community/profile?community=${C}`);
    const main = page.getByRole("main").first();
    // Phone frame (iPhone 16 - 105): dotted initials, "Upload Picture", no
    // card heading, full-width Save Changes and Delete.
    await expect(main.getByText("K.C", { exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "Upload Picture" })).toBeVisible();
    await expect(main.getByText("Community Information")).toBeHidden();
    const save = main.getByRole("button", { name: "Save Changes" });
    const del = main.getByRole("button", { name: "Delete", exact: true });
    for (const button of [save, del]) {
      const width = await button.evaluate((el) => el.getBoundingClientRect().width);
      const cardWidth = await button.evaluate(
        (el) => el.closest(".border").getBoundingClientRect().width,
      );
      expect(width).toBeGreaterThan(cardWidth - 40);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: test.info().outputPath("admin-mobile-community-profile.png"),
      fullPage: true,
    });
  });

  test("create payment opens as a full page on the phone", async ({ page }) => {
    await page.goto(`/dashboard/payments?community=${C}`);
    // The seeded community has a plan, so the header action opens the flow
    // (the empty state's "Create Collection" opens the same component).
    const open = page.getByRole("button", { name: "Create Payment Plan" });
    await open.click();

    // Phone frame (iPhone 16 - 74): a full page, not a pop-up.
    const heading = page.getByRole("heading", { name: "Create Payment", exact: true });
    await expect(heading).toBeVisible();
    await expect(page.getByText("You can edit or pause plan at any time.")).toBeVisible();
    const back = page.getByRole("button", { name: "Go back" });
    await expect(back).toBeVisible();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeHidden();
    const sheet = await heading.evaluate((el) => {
      let node = el;
      while (node && !node.className.includes("h-full")) node = node.parentElement;
      const r = node.getBoundingClientRect();
      return { width: r.width, height: r.height, radius: getComputedStyle(node).borderRadius };
    });
    const viewport = page.viewportSize();
    expect(sheet.width).toBe(viewport.width);
    expect(sheet.height).toBe(viewport.height);
    expect(sheet.radius).toBe("0px");
    await expect(page.getByText("Choose the type of plan you want to create")).toBeVisible();
    // No footer Cancel/Back on the phone; Continue spans the sheet.
    await expect(page.getByRole("button", { name: /^(Cancel|Back)$/ })).toBeHidden();
    const cont = page.getByRole("button", { name: "Continue" });
    const contWidth = await cont.evaluate((el) => el.getBoundingClientRect().width);
    expect(contWidth).toBeGreaterThan(viewport.width - 40);
    await page.screenshot({ path: test.info().outputPath("admin-mobile-create-payment.png") });

    // Plan Details (step 2) carries the same footer: still no Back button.
    await cont.click();
    await expect(page.getByText("Plan Details", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Cancel|Back)$/ })).toBeHidden();
    expect(await cont.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(
      viewport.width - 40,
    );
    await page.screenshot({ path: test.info().outputPath("admin-mobile-plan-details.png") });
    // The top button steps back to step 1 first.
    await back.click();
    await expect(page.getByText("Choose the type of plan you want to create")).toBeVisible();

    // On step 1 the back button leaves the flow.
    await back.click();
    await expect(heading).toBeHidden();
    await expect(open).toBeVisible();
  });

  test("members table remains available on the phone", async ({ page }) => {
    await page.goto(`/dashboard/members?community=${C}`);
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Ada Admin" })).toHaveCount(0);
  });
});
