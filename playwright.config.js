import { defineConfig, devices } from "@playwright/test";

// E2E runs against a local Vite dev server with every backend call mocked
// via page.route — no real API, no real money (see e2e/README note in
// docs/testing-strategy.md). The member app is device-gated to mobile
// (MemberDeviceGuard), so payment tests use the Pixel profile; public pages
// run on desktop Chrome.
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Values are public (inlined into the client bundle) — same set CI
      // already hardcodes for the unit/build job. TEST_MODE=true so a stray
      // unmocked payment call can never hit live keys in this harness.
      VITE_API_BASE_URL: "https://api.glasspay.app",
      VITE_CLOUDINARY_CLOUD_NAME: "ece5jmhy",
      VITE_TEST_MODE: "true",
      VITE_APP_URL: "http://127.0.0.1:4173",
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile UA + viewport so MemberDeviceGuard lets /member/* render.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
