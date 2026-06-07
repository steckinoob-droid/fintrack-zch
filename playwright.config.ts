import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration.
 *
 * Required env vars (copy .env.playwright.example → .env.playwright):
 *   TEST_EMAIL     — email of a real Supabase test account
 *   TEST_PASSWORD  — password for that account
 *   BASE_URL       — defaults to http://localhost:3000
 *
 * First run:  npx playwright test --project=setup
 * All tests:  npx playwright test
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["line"]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    storageState: "tests/.auth/user.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // 1. Auth setup — logs in once and saves session to tests/.auth/user.json
    {
      name: "setup",
      testMatch: "**/global.setup.ts",
      use: { storageState: undefined },
    },
    // 2. Desktop tests — depend on setup
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    // 3. Mobile tests — depend on setup
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      dependencies: ["setup"],
    },
  ],
});
