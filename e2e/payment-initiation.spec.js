import { test, expect } from "@playwright/test";
import { MEMBER_PERSONA, createScenario, installNetworkMock, ok, preparePage } from "./support.js";

test.describe("member payment initiation", () => {
  // The payment flow is exercised in a mobile browser to cover its phone
  // layout and touch interactions.
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

  test("reaches the provider authorization boundary without a real charge", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "member payment flow mobile coverage");
    const scenario = createScenario({ persona: MEMBER_PERSONA });
    scenario.overrides.push({
      method: "GET",
      match: (url) => url.pathname.startsWith("/api/v1/payment-links/"),
      handle: async (route) => {
        await ok(route, {
          paymentLink: {
            id: "pl-e2e",
            title: "September Dues",
            amount: 250000,
            recurringPlan: null,
            status: "ACTIVE",
            community: { id: "cmm-e2e", name: "Sunrise Estate" },
          },
        });
        return true;
      },
    });
    await installNetworkMock(page, scenario);
    await preparePage(page, MEMBER_PERSONA);

    await page.goto("/member/pay/pl-e2e?via=link");

    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Member app navigation" })).toBeHidden();
    const savePaymentMethod = page.getByRole("switch", { name: "Save payment method" });
    await expect(savePaymentMethod).toHaveAttribute("aria-checked", "false");

    const payButton = page.getByRole("button", { name: "Make Payment" });
    await expect(payButton).toBeVisible(); // link data loaded, button actionable
    await payButton.click();

    // window.location.href = authorizationUrl — the redirect is intercepted
    // and served a local stub instead of the real provider.
    await page.waitForURL("https://checkout.paystack.com/e2e-session");
    await expect(page.getByRole("heading", { name: "Paystack Checkout (stub)" })).toBeVisible();

    // The initiation request hit the documented endpoint with the documented
    // payload — the authorization boundary was crossed, nothing was charged.
    expect(scenario.calls.initiate.path).toBe("/payments/pay/payment-links/pl-e2e");
    expect(scenario.calls.initiate.body.idempotencyKey).toBeTruthy();
    expect(scenario.calls.initiate.body.amount).toBe(250000);
    expect(scenario.calls.initiate.body.savePaymentMethod).toBe(false);
  });
});
