import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 20_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    extraHTTPHeaders: bypassSecret
      ? {
          "x-vercel-protection-bypass": bypassSecret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
