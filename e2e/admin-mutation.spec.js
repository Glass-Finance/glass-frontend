import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

// One representative destructive admin mutation, end to end: confirmation
// modal → PATCH → refetched row + success toast.
test("suspends a user through the confirmation flow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "dashboard is desktop");
  const scenario = createScenario();
  await installNetworkMock(page, scenario);
  await preparePage(page, ADMIN_PERSONA);

  await page.goto("/dashboard/admin-panel");
  await expect(page.getByRole("heading", { name: "Platform Admin" })).toBeVisible();

  // Default tab is Communities — switch to Users (tab button; the section
  // heading and filter options carry the same words but aren't buttons).
  await page.getByRole("button", { name: "Users", exact: true }).click();

  const row = page.getByRole("row", { name: /member@example\.test/ });
  await expect(row).toBeVisible();
  // Row-scoped: "Suspended" also exists as a filter option label.
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  // Row actions are opacity-0 group-hover:opacity-100 — hover first.
  await row.hover();
  await row.getByRole("button", { name: "Suspend", exact: true }).click();

  // ModalShell renders no role="dialog" — scope by the modal's own content.
  await expect(page.getByText("Suspend User")).toBeVisible();
  const confirm = page.locator('button[type="submit"]');
  await expect(confirm).toBeDisabled(); // reason textarea is required

  await page.getByPlaceholder("Why is this user being suspended?").fill("Automated E2E test");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // The mutation reached the API with the exact contract body…
  await expect.poll(() => scenario.calls.suspend ?? null).toBeTruthy();
  expect(scenario.calls.suspend.path).toMatch(/\/admin\/users\/usr-e2e-1\/suspend$/);
  expect(scenario.calls.suspend.body).toEqual({ reason: "Automated E2E test" });

  // …and the UI settles into the resulting state: the refetched row reads
  // Suspended, offers Unsuspend, and the success toast fired.
  await expect(row.getByText("Suspended", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Unsuspend" })).toBeVisible();
  await expect(page.getByText("User suspended")).toBeVisible();
});
