import { test, expect } from "@playwright/test";
import { ADMIN_PERSONA, createScenario, installNetworkMock, preparePage } from "./support.js";

// Callback simulation, admin side: with an isAdmin session, /payment/callback
// renders AdminPaymentCallback, whose isTerminal treats SUCCESSFUL *and*
// FAILED as final — the member PaymentSuccess screen instead keeps polling a
// premature FAILED (up to 30s), which is exactly why failure is asserted here.
test.describe("payment callback verification", () => {
  async function setup(page, scenario) {
    await installNetworkMock(page, scenario);
    await preparePage(page, ADMIN_PERSONA);
  }

  test("settles into the success state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "callback is desktop");
    const scenario = createScenario({ verifyStatus: "SUCCESSFUL" });
    await setup(page, scenario);

    await page.goto("/payment/callback?reference=tx-e2e-success");

    // SuccessBadge animates its message in late and the page auto-redirects
    // after ~5s — assert the settled state promptly with generous timeouts.
    await expect(page.getByText("Payment Successful")).toBeVisible();
    await expect(page.getByText("Ref: tx-e2e-success")).toBeVisible();
    // Two controls share the label (top-left back link + state button).
    await expect(page.getByRole("button", { name: "Back to Dashboard" }).first()).toBeVisible();

    // Verify is contract-bound as a query param on the async verify endpoint.
    expect(scenario.calls.verify.path).toBe("/payments/callback/verify");
    expect(scenario.calls.verify.query).toContain("reference=tx-e2e-success");
  });

  test("shows the failure state when verification reports FAILED", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "callback is desktop");
    const scenario = createScenario({ verifyStatus: "FAILED" });
    await setup(page, scenario);

    await page.goto("/payment/callback?reference=tx-e2e-failed");

    await expect(page.getByText("Payment Failed")).toBeVisible();
    await expect(page.getByText("Ref: tx-e2e-failed")).toBeVisible();
    // Two controls share the label (top-left back link + state button).
    await expect(page.getByRole("button", { name: "Back to Dashboard" }).first()).toBeVisible();

    expect(scenario.calls.verify.query).toContain("reference=tx-e2e-failed");
    expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBe(
      ADMIN_PERSONA.accessToken,
    );
  });
});
