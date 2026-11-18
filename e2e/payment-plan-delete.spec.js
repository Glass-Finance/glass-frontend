import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage, ok } from "./support.js";

const persona = {
  ...ADMIN_PERSONA,
  user: { ...ADMIN_PERSONA.user, role: "USER", isPlatformAdmin: false, isAdmin: true },
  profile: { ...ADMIN_PERSONA.profile, platformRole: "USER" },
};
const community = {
  id: "delete-crew",
  slug: "delete-crew",
  name: "Delete Crew",
  owned: true,
  memberRole: "COMMUNITY_OWNER",
  memberStatus: "ACTIVE",
  metrics: {},
};
const pageOf = (content) => ({ content, totalElements: content.length, totalPages: 1, last: true });

test("only deletes a draft after confirmation and refreshes the plan list", async ({ page }) => {
  let plans = [
    {
      id: "draft-1",
      title: "Draft Dues",
      status: "DRAFT",
      amount: 500,
      paymentType: "ONE_TIME",
      metrics: {},
    },
    {
      id: "active-1",
      title: "Active Dues",
      status: "ACTIVE",
      amount: 500,
      paymentType: "ONE_TIME",
      metrics: {},
    },
  ];
  let deletions = 0;
  const scenario = createScenario({ persona });
  scenario.overrides.push({
    match: (u) =>
      u.pathname.startsWith("/api/v1/communities/") ||
      u.pathname.startsWith("/api/v1/roles/community/"),
    handle: async (route, request, url) => {
      const path = url.pathname;
      if (path === "/api/v1/communities/me") await ok(route, pageOf([community]));
      else if (path === "/api/v1/roles/community/COMMUNITY_OWNER") {
        await ok(route, { permissions: [{ code: "community.payment_links.delete" }] });
      } else if (path === "/api/v1/communities/delete-crew") await ok(route, community);
      else if (path === "/api/v1/communities/delete-crew/payment-links")
        await ok(route, pageOf(plans));
      else if (
        path === "/api/v1/communities/delete-crew/payment-links/draft-1" &&
        request.method() === "DELETE"
      ) {
        deletions += 1;
        expect(request.postData()).toBeNull();
        plans = plans.filter((plan) => plan.id !== "draft-1");
        await ok(route, "Payment link deleted");
      } else return false;
      return true;
    },
  });
  await preparePage(page, persona);
  await installNetworkMock(page, scenario);
  await page.goto("/dashboard/payments?community=delete-crew");

  const draft = page.getByText("Draft Dues", { exact: true });
  const draftCard = draft.locator("..");
  await expect(draft).toBeVisible();
  await draftCard.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete Plan" })).toBeVisible();
  expect(deletions).toBe(0);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(draft).toHaveCount(0);
  expect(deletions).toBe(1);

  const activeCard = page.getByText("Active Dues", { exact: true }).locator("..");
  await activeCard.getByRole("button", { name: "More options" }).click();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
});
